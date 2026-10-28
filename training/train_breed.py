"""Breed model: EfficientNetB0 fine-tuned on Oxford-IIIT Pet (37 breeds).

Stage 1: backbone frozen (lr 1e-3, 8 epochs).
Stage 2: unfreeze the last 40 backbone layers (lr 1e-5, 10 epochs).
Label smoothing 0.1. Also writes breed_labels.json for the backend.

    python train_breed.py
    python train_breed.py --limit 256 --epochs 1   # quick test
"""
import json

import keras

import data
from common import parse_args, callbacks
from config import OUT_DIR, ensure_dirs
from evaluate import evaluate_and_save, merge_histories
from models import efficientnet_breed, set_trainable

NAME = "breed_efficientnetb0"


def main():
    args = parse_args(__doc__)
    ensure_dirs()
    train, val, test, table = data.load_breeds(limit=args.limit, synthetic=args.synthetic)
    (OUT_DIR / "breed_labels.json").write_text(json.dumps(table, indent=1))

    model, base = efficientnet_breed(len(table), weights=None if args.no_pretrained else "imagenet")
    loss = keras.losses.CategoricalCrossentropy(label_smoothing=0.1)
    metrics = ["accuracy", keras.metrics.TopKCategoricalAccuracy(k=3, name="top3")]

    set_trainable(base, 0)
    model.compile(optimizer=keras.optimizers.Adam(1e-3), loss=loss, metrics=metrics)
    h1 = model.fit(train, validation_data=val, epochs=args.epochs or 8, callbacks=callbacks(patience=3))

    set_trainable(base, 40)
    model.compile(optimizer=keras.optimizers.Adam(1e-5), loss=loss, metrics=metrics)
    h2 = model.fit(train, validation_data=val, epochs=args.epochs or 10, callbacks=callbacks(patience=4))

    model.save(OUT_DIR / f"{NAME}.keras")
    evaluate_and_save(model, test, NAME, [b["display"] for b in table],
                      merge_histories(h1.history, h2.history), binary=False)


if __name__ == "__main__":
    main()
