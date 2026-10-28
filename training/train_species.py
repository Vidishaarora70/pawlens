"""Main species model: MobileNetV2 transfer learning on cats_vs_dogs.

Stage 1: backbone frozen, train only the new head (lr 1e-3, 5 epochs).
Stage 2: unfreeze the last 30 backbone layers and fine-tune (lr 1e-5, 5 epochs).

    python train_species.py
    python train_species.py --limit 256 --epochs 1   # quick test
"""
import keras

import data
from common import parse_args, callbacks
from config import OUT_DIR, ensure_dirs
from evaluate import evaluate_and_save, merge_histories
from models import mobilenet_species, set_trainable

NAME = "species_mobilenetv2"


def main():
    args = parse_args(__doc__)
    ensure_dirs()
    train, val, test, labels = data.load_species(limit=args.limit, synthetic=args.synthetic)
    model, base = mobilenet_species(weights=None if args.no_pretrained else "imagenet")

    # Stage 1 — frozen backbone
    set_trainable(base, 0)
    model.compile(optimizer=keras.optimizers.Adam(1e-3), loss="binary_crossentropy", metrics=["accuracy"])
    h1 = model.fit(train, validation_data=val, epochs=args.epochs or 5, callbacks=callbacks(patience=3))

    # Stage 2 — fine-tune the top of the backbone
    set_trainable(base, 30)
    model.compile(optimizer=keras.optimizers.Adam(1e-5), loss="binary_crossentropy", metrics=["accuracy"])
    h2 = model.fit(train, validation_data=val, epochs=args.epochs or 5, callbacks=callbacks(patience=3))

    model.save(OUT_DIR / f"{NAME}.keras")
    evaluate_and_save(model, test, NAME, labels, merge_histories(h1.history, h2.history), binary=True)


if __name__ == "__main__":
    main()
