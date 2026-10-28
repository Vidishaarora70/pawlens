"""Loads every model once at startup."""
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Optional

import keras
import numpy as np

from .config import GATE_WEIGHTS, IMG_SIZE, MODELS_DIR
from .labels import load_breed_table

log = logging.getLogger("pawlens")

# file name stem -> last conv layer used by Grad-CAM
SPECIES_MODELS = {
    "species_mobilenetv2": "out_relu",   # main model (used first if present)
    "species_custom_cnn": "last_conv",   # baseline
}
BREED_MODEL = ("breed_efficientnetb0", "top_activation")
GATE_NAME = "gate_mobilenetv2_imagenet"
GATE_LAST_CONV = "out_relu"


@dataclass
class Registry:
    gate: keras.Model
    species: dict = field(default_factory=dict)      # name -> model (ordered: main first)
    breed: Optional[keras.Model] = None
    breed_table: list = field(default_factory=list)
    runtime_ms: dict = field(default_factory=dict)   # name -> ms per image on this machine

    @property
    def demo_mode(self) -> bool:
        return not self.species

    @property
    def main_species(self) -> Optional[str]:
        return next(iter(self.species), None)

    def loaded(self) -> list[str]:
        return [GATE_NAME, *self.species, *([BREED_MODEL[0]] if self.breed is not None else [])]


def _time_it(model, x, runs=3) -> float:
    model(x, training=False)  # warm-up
    t = time.perf_counter()
    for _ in range(runs):
        model(x, training=False)
    return round((time.perf_counter() - t) / runs * 1000, 1)


def load_all() -> Registry:
    weights = None if GATE_WEIGHTS.lower() == "none" else GATE_WEIGHTS
    log.info("Loading Pet Gate (MobileNetV2, weights=%s)…", weights)
    gate = keras.applications.MobileNetV2(weights=weights, include_top=True, input_shape=(IMG_SIZE, IMG_SIZE, 3))
    reg = Registry(gate=gate)
    x = np.random.uniform(0, 255, (1, IMG_SIZE, IMG_SIZE, 3)).astype("float32")
    reg.runtime_ms[GATE_NAME] = _time_it(gate, x / 127.5 - 1)

    for name in SPECIES_MODELS:
        path = MODELS_DIR / f"{name}.keras"
        if path.exists():
            try:
                reg.species[name] = keras.models.load_model(path, compile=False)
                reg.runtime_ms[name] = _time_it(reg.species[name], x)
                log.info("Loaded %s", name)
            except Exception as e:  # a broken file should not stop the server
                log.error("Could not load %s: %s", path, e)

    name, _ = BREED_MODEL
    path, labels = MODELS_DIR / f"{name}.keras", MODELS_DIR / "breed_labels.json"
    if path.exists() and labels.exists():
        try:
            reg.breed = keras.models.load_model(path, compile=False)
            reg.breed_table = load_breed_table(labels)
            reg.runtime_ms[name] = _time_it(reg.breed, x)
            log.info("Loaded %s (%d breeds)", name, len(reg.breed_table))
        except Exception as e:
            log.error("Could not load %s: %s", path, e)
            reg.breed = None
    elif path.exists():
        log.warning("Found %s but breed_labels.json is missing — breed model skipped.", path.name)

    if reg.demo_mode:
        log.warning("No trained species model found in %s — running in DEMO MODE (ImageNet only).", MODELS_DIR)
    return reg


def read_metrics(reg: Registry) -> list[dict]:
    """Metrics written by training/evaluate.py, plus the gate model."""
    out = []
    mdir = MODELS_DIR / "metrics"
    if mdir.exists():
        for f in sorted(mdir.glob("*.json")):
            try:
                m = json.loads(f.read_text())
            except json.JSONDecodeError:
                continue
            name = m.get("model", f.stem)
            m["loaded"] = name in reg.loaded()
            m["runtime_ms"] = reg.runtime_ms.get(name)
            out.append(m)
    out.append({
        "model": GATE_NAME,
        "description": "Pretrained ImageNet MobileNetV2 used as the Pet Gate (not retrained)",
        "task": "gate",
        "params": int(reg.gate.count_params()),
        "test_accuracy": None,
        "loaded": True,
        "runtime_ms": reg.runtime_ms.get(GATE_NAME),
    })
    return out
