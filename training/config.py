"""Shared settings for all PawLens training scripts."""
import os
from pathlib import Path

IMG_SIZE = 224
BATCH_SIZE = 32
SEED = 42

# Where trained models and metrics are written.
# Default: ../backend/models (so the backend picks them up directly).
OUT_DIR = Path(os.getenv("PAWLENS_OUT_DIR", Path(__file__).resolve().parent.parent / "backend" / "models"))
METRICS_DIR = OUT_DIR / "metrics"
PLOTS_DIR = METRICS_DIR / "plots"

# The 12 cat breeds in the Oxford-IIIT Pet dataset. Every other breed is a dog.
CAT_BREEDS = {
    "abyssinian", "bengal", "birman", "bombay", "british_shorthair", "egyptian_mau",
    "maine_coon", "persian", "ragdoll", "russian_blue", "siamese", "sphynx",
}


def ensure_dirs():
    for d in (OUT_DIR, METRICS_DIR, PLOTS_DIR):
        d.mkdir(parents=True, exist_ok=True)
