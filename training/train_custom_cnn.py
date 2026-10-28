"""Baseline: custom CNN trained from scratch on cats_vs_dogs.

    python train_custom_cnn.py              # full run (GPU recommended)
    python train_custom_cnn.py --limit 256  # quick test
"""
import keras

import data
from common import parse_args, callbacks
from config import OUT_DIR, ensure_dirs
from evaluate import evaluate_and_save
from models import custom_cnn

NAME = "species_custom_cnn"


def main():
    args = parse_args(__doc__)
    ensure_dirs()
    train, val, test, labels = data.load_species(limit=args.limit, synthetic=args.synthetic)

    model = custom_cnn()
    model.compile(optimizer=keras.optimizers.Adam(1e-3), loss="binary_crossentropy", metrics=["accuracy"])
    model.summary()
    h = model.fit(train, validation_data=val, epochs=args.epochs or 20, callbacks=callbacks(patience=4))

    model.save(OUT_DIR / f"{NAME}.keras")
    evaluate_and_save(model, test, NAME, labels, h.history, binary=True)


if __name__ == "__main__":
    main()
