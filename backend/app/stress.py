"""Stress Test Lab: how does confidence change when the photo gets worse?"""
import time

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

TESTS = {
    # name: (unit, levels). The first level of each test is "no change".
    "blur": ("px radius", [0, 1, 2, 3, 5, 8]),
    "brightness": ("% light", [100, 80, 60, 40, 25, 10]),
    "rotation": ("degrees", [0, 30, 60, 90, 135, 180]),
    "noise": ("noise level", [0, 10, 20, 35, 50, 75]),
}


def _apply(img: Image.Image, name: str, level: float, rng) -> Image.Image:
    if level == TESTS[name][1][0]:
        return img
    if name == "blur":
        # scale radius with image size so results don't depend on resolution
        return img.filter(ImageFilter.GaussianBlur(level * max(img.size) / 224))
    if name == "brightness":
        return ImageEnhance.Brightness(img).enhance(level / 100)
    if name == "rotation":
        return img.rotate(level, resample=Image.BILINEAR, expand=True, fillcolor=(128, 128, 128))
    arr = np.asarray(img, dtype=np.float32)
    arr = arr + rng.normal(0, level, arr.shape)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def run(engine, img: Image.Image) -> dict:
    t = time.perf_counter()
    small = img.copy()
    small.thumbnail((640, 640))  # faster, and enough detail for 224x224 models
    base = engine.predict_many([small])[0]
    if not base["is_pet"]:
        raise ValueError("No cat or dog found in this photo. The stress test needs a pet photo.")
    label, base_conf = base["species"], base["species_confidence"]

    rng = np.random.default_rng(42)
    variants, index = [], []
    for name, (_, levels) in TESTS.items():
        for lv in levels:
            variants.append(_apply(small, name, lv, rng))
            index.append((name, lv))
    results = engine.predict_many(variants)

    tests, kept = [], []
    for name, (unit, levels) in TESTS.items():
        conf, correct, flipped = [], [], None
        for lv in levels:
            r = results[index.index((name, lv))]
            ok = r["is_pet"] and r["species"] == label
            c = r["species_confidence"] if ok else (1 - r["species_confidence"] if r["is_pet"] else 0.0)
            conf.append(round(float(c), 4))
            correct.append(bool(ok))
            if not ok and flipped is None:
                flipped = lv
            if lv != levels[0]:
                kept.append(min(1.0, (c if ok else 0.0) / base_conf))
        tests.append({"name": name, "unit": unit, "levels": levels, "confidence": conf,
                      "still_correct": correct, "label_flipped_at": flipped})

    return {
        "base_label": label,
        "base_confidence": base_conf,
        "tests": tests,
        "robustness_score": round(100 * float(np.mean(kept)), 1),
        "inference_ms": round((time.perf_counter() - t) * 1000, 1),
        "demo_mode": engine.reg.demo_mode,
    }
