"""The prediction pipeline: Pet Gate -> species -> breed -> agreement -> Grad-CAM."""
import threading
import time
import uuid
from typing import Optional

import numpy as np
import tensorflow as tf
from PIL import Image

from .config import GATE_THRESHOLD
from .gradcam import compute_cam, overlay
from .images import to_batch
from .labels import CAT_IDS, DOG_IDS, IMAGENET_CATS, IMAGENET_DOGS
from .models_loader import BREED_MODEL, GATE_LAST_CONV, SPECIES_MODELS, Registry


class Engine:
    def __init__(self, reg: Registry):
        self.reg = reg
        self.lock = threading.Lock()  # one inference at a time keeps memory flat
        self._cat_ids = np.array(CAT_IDS)
        self._dog_ids = np.array(DOG_IDS)
        if reg.breed is not None:
            sp = np.array([r["species"] for r in reg.breed_table])
            self._breed_species = sp
            self._breed_names = [r["display"] for r in reg.breed_table]

    # ------------------------------------------------------------ helpers ----
    def cam_models(self) -> list[str]:
        if self.reg.demo_mode:
            return ["gate"]
        names = [n.replace("species_", "") for n in self.reg.species]  # mobilenetv2, custom_cnn
        return names + (["breed"] if self.reg.breed is not None else [])

    def _gate(self, x):
        probs = self.reg.gate(x / 127.5 - 1.0, training=False).numpy()
        cat = probs[:, self._cat_ids].sum(1)
        dog = probs[:, self._dog_ids].sum(1)
        return probs, cat, dog

    # ------------------------------------------------------------ predict ----
    def predict_many(self, images: list[Image.Image], filenames: Optional[list] = None) -> list[dict]:
        x = to_batch(images)
        with self.lock:
            probs, cat_p, dog_p = self._gate(x)
            votes = {n: m(x, training=False).numpy().reshape(-1) for n, m in self.reg.species.items()}
            breed_p = self.reg.breed(x, training=False).numpy() if self.reg.breed is not None else None

        out = []
        for i in range(len(images)):
            pet = float(cat_p[i] + dog_p[i])
            r = {
                "id": uuid.uuid4().hex,
                "filename": filenames[i] if filenames else None,
                "is_pet": pet >= GATE_THRESHOLD,
                "gate_confidence": round(min(pet, 1.0), 4),
                "species": None, "species_confidence": None,
                "breeds": [], "votes": [], "agreement": True, "models_disagree": False,
                "heatmap_png": None, "cam_model": None,
                "demo_mode": self.reg.demo_mode,
            }
            if r["is_pet"]:
                self._fill_species(r, i, probs, cat_p, dog_p, votes, breed_p)
            out.append(r)
        return out

    def _fill_species(self, r, i, probs, cat_p, dog_p, votes, breed_p):
        if votes:
            for name, p in votes.items():
                dog = float(p[i])
                sp = "dog" if dog >= 0.5 else "cat"
                r["votes"].append({"model": name.replace("species_", ""), "species": sp,
                                   "confidence": round(dog if sp == "dog" else 1 - dog, 4)})
            main = r["votes"][0]
            r["species"], r["species_confidence"] = main["species"], main["confidence"]
        else:  # demo mode: decide from ImageNet probabilities
            total = cat_p[i] + dog_p[i]
            sp = "dog" if dog_p[i] >= cat_p[i] else "cat"
            r["species"] = sp
            r["species_confidence"] = round(float(max(cat_p[i], dog_p[i]) / total), 4)
            r["votes"].append({"model": "imagenet_gate", "species": sp, "confidence": r["species_confidence"]})

        sp = r["species"]
        if breed_p is not None:
            p = breed_p[i]
            top1_species = self._breed_species[int(p.argmax())]
            r["agreement"] = bool(top1_species == sp)
            idx = [j for j in np.argsort(-p) if self._breed_species[j] == sp][:3]
            r["breeds"] = [{"name": self._breed_names[j], "confidence": round(float(p[j]), 4)} for j in idx]
        elif self.reg.demo_mode:
            ids, names = (self._dog_ids, IMAGENET_DOGS) if sp == "dog" else (self._cat_ids, IMAGENET_CATS)
            sub = probs[i, ids]
            total = float(cat_p[i] + dog_p[i]) or 1.0
            r["breeds"] = [{"name": names[int(ids[j])], "confidence": round(float(sub[j]) / total, 4)}
                           for j in np.argsort(-sub)[:3]]
            # does the single most likely pet class agree with the species?
            r["agreement"] = bool((probs[i, self._dog_ids].max() >= probs[i, self._cat_ids].max()) == (sp == "dog"))
        if len(r["votes"]) > 1 and len({v["species"] for v in r["votes"]}) > 1:
            r["models_disagree"] = True

    def predict_one(self, img: Image.Image, gradcam=True, cam_model=None, filename=None) -> dict:
        t = time.perf_counter()
        r = self.predict_many([img], [filename] if filename else None)[0]
        if gradcam and r["is_pet"]:
            cam_model = self._resolve_cam(cam_model)
            cam = self._cam(img, r, cam_model)
            if cam is not None:
                r["heatmap_png"], r["cam_model"] = overlay(img, cam), cam_model
        r["inference_ms"] = round((time.perf_counter() - t) * 1000, 1)
        return r

    # ----------------------------------------------------------- grad-cam ----
    def _resolve_cam(self, requested):
        options = self.cam_models()
        return requested if requested in options else options[0]

    def _cam(self, img, r, cam_model):
        x = to_batch([img])
        sp = r["species"]
        with self.lock:
            if cam_model == "gate":
                ids = tf.constant(self._dog_ids if sp == "dog" else self._cat_ids)
                return compute_cam(self.reg.gate, GATE_LAST_CONV, x / 127.5 - 1.0,
                                   lambda p: tf.reduce_sum(tf.gather(p[0], ids)))
            if cam_model == "breed" and self.reg.breed is not None and r["breeds"]:
                j = self._breed_names.index(r["breeds"][0]["name"])
                return compute_cam(self.reg.breed, BREED_MODEL[1], x, lambda p: p[0, j])
            name = "species_" + cam_model
            if name in self.reg.species:
                layer = SPECIES_MODELS[name]
                return compute_cam(self.reg.species[name], layer, x,
                                   (lambda p: p[0, 0]) if sp == "dog" else (lambda p: 1.0 - p[0, 0]))
        return None
