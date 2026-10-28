"""Command-line options and callbacks shared by the train_*.py scripts."""
import argparse
import keras


def parse_args(description):
    ap = argparse.ArgumentParser(description=description)
    ap.add_argument("--epochs", type=int, default=None, help="override epochs (each stage)")
    ap.add_argument("--limit", type=int, default=None, help="use only N images per split (quick test)")
    ap.add_argument("--synthetic", action="store_true", help="random images, no download (code test only)")
    ap.add_argument("--no-pretrained", action="store_true", help="do not load ImageNet weights (code test only)")
    return ap.parse_args()


def callbacks(patience=4):
    return [
        keras.callbacks.EarlyStopping(monitor="val_loss", patience=patience, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, min_lr=1e-7),
    ]
