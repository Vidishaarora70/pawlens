"""Evaluate a trained model on the test split and write metrics JSON + plots.

Used automatically at the end of every train_*.py script. Can also be run on
its own to re-evaluate saved models:

    python evaluate.py --model species_mobilenetv2
    python evaluate.py --model breed_efficientnetb0
"""
import argparse
import json
import time

import numpy as np
import keras
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support

from config import OUT_DIR, METRICS_DIR, PLOTS_DIR, IMG_SIZE, ensure_dirs

DESCRIPTIONS = {
    "species_custom_cnn": "Baseline CNN trained from scratch (cat vs dog)",
    "species_mobilenetv2": "MobileNetV2 transfer learning (cat vs dog)",
    "breed_efficientnetb0": "EfficientNetB0 fine-tuned on 37 breeds",
}


def _collect(model, test_ds, binary):
    y_true, y_prob = [], []
    for x, y in test_ds:
        p = model(x, training=False).numpy()
        y_prob.append(p)
        y = y.numpy()
        if not binary and y.ndim == 2:  # one-hot -> index
            y = y.argmax(1)
        y_true.append(y.reshape(-1))
    return np.concatenate(y_true).astype(int), np.concatenate(y_prob)


def _cpu_ms(model, runs=20):
    x = np.random.uniform(0, 255, (1, IMG_SIZE, IMG_SIZE, 3)).astype("float32")
    model(x, training=False)  # warm-up
    t = time.perf_counter()
    for _ in range(runs):
        model(x, training=False)
    return round((time.perf_counter() - t) / runs * 1000, 1)


def _plots(name, history, cm, labels):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import seaborn as sns
    except ImportError:
        return
    if history and history.get("accuracy"):
        fig, ax = plt.subplots(1, 2, figsize=(11, 4))
        ax[0].plot(history["accuracy"], label="train")
        ax[0].plot(history.get("val_accuracy", []), label="validation")
        ax[0].set_title("Accuracy"); ax[0].legend()
        ax[1].plot(history["loss"], label="train")
        ax[1].plot(history.get("val_loss", []), label="validation")
        ax[1].set_title("Loss"); ax[1].legend()
        fig.tight_layout(); fig.savefig(PLOTS_DIR / f"{name}_curves.png", dpi=120); plt.close(fig)
    big = len(labels) > 5
    fig, ax = plt.subplots(figsize=(14, 12) if big else (5, 4))
    sns.heatmap(cm, annot=not big, fmt="d", cmap="Oranges", xticklabels=labels, yticklabels=labels, ax=ax)
    ax.set_xlabel("Predicted"); ax.set_ylabel("True"); ax.set_title(name)
    fig.tight_layout(); fig.savefig(PLOTS_DIR / f"{name}_confusion.png", dpi=120); plt.close(fig)


def evaluate_and_save(model, test_ds, name, labels, history=None, binary=True, extra=None):
    """Compute metrics on the test set and write metrics/<name>.json."""
    ensure_dirs()
    y_true, y_prob = _collect(model, test_ds, binary)
    if binary:
        y_pred = (y_prob.reshape(-1) >= 0.5).astype(int)
        avg, top3 = "binary", None
    else:
        y_pred = y_prob.argmax(1)
        avg = "macro"
        top3_idx = np.argsort(-y_prob, axis=1)[:, :3]
        top3 = float(np.mean([t in row for t, row in zip(y_true, top3_idx)]))

    p, r, f1, _ = precision_recall_fscore_support(y_true, y_pred, average=avg, zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=list(range(len(labels))))
    metrics = {
        "model": name,
        "description": DESCRIPTIONS.get(name, name),
        "task": "species" if binary else "breed",
        "params": int(model.count_params()),
        "test_samples": int(len(y_true)),
        "test_accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision": round(float(p), 4),
        "recall": round(float(r), 4),
        "f1": round(float(f1), 4),
        "top3_accuracy": round(top3, 4) if top3 is not None else None,
        "confusion_matrix": cm.tolist(),
        "labels": labels,
        "history": {k: [round(float(v), 4) for v in vals] for k, vals in (history or {}).items()},
        "avg_inference_ms_cpu": _cpu_ms(model),
        "trained_at": time.strftime("%Y-%m-%d %H:%M"),
    }
    if extra:
        metrics.update(extra)
    path = METRICS_DIR / f"{name}.json"
    path.write_text(json.dumps(metrics, indent=1))
    _plots(name, history, cm, labels)
    print(f"\n{name}: test accuracy {metrics['test_accuracy']:.2%}"
          + (f", top-3 {metrics['top3_accuracy']:.2%}" if top3 is not None else "")
          + f"  ->  {path}")
    return metrics


def merge_histories(*hs):
    """Join the history dicts of training stage 1 and stage 2."""
    out = {}
    for h in hs:
        for k, v in (h or {}).items():
            out.setdefault(k, []).extend(v)
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, choices=list(DESCRIPTIONS))
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    import data
    model = keras.models.load_model(OUT_DIR / f"{args.model}.keras")
    old = METRICS_DIR / f"{args.model}.json"
    history = json.loads(old.read_text()).get("history") if old.exists() else None
    if args.model.startswith("breed"):
        _, _, test, table = data.load_breeds(limit=args.limit)
        evaluate_and_save(model, test, args.model, [b["display"] for b in table], history, binary=False)
    else:
        _, _, test, labels = data.load_species(limit=args.limit)
        evaluate_and_save(model, test, args.model, labels, history, binary=True)
