"""Backend settings. All can be overridden with environment variables."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

MODELS_DIR = Path(os.getenv("PAWLENS_MODELS_DIR", BASE_DIR / "models"))
FEEDBACK_DIR = Path(os.getenv("PAWLENS_FEEDBACK_DIR", BASE_DIR / "feedback"))
FRONTEND_DIST = Path(os.getenv("PAWLENS_FRONTEND_DIST", BASE_DIR.parent / "frontend" / "dist"))

IMG_SIZE = 224

# If the ImageNet model gives less than this total probability to cat + dog
# classes, the photo is rejected as "no cat or dog found".
GATE_THRESHOLD = float(os.getenv("PAWLENS_GATE_THRESHOLD", "0.35"))

# Weights for the gate model. "imagenet" downloads them once (~14 MB) on first
# start. "none" = random weights, only for automated tests without internet.
GATE_WEIGHTS = os.getenv("PAWLENS_GATE_WEIGHTS", "imagenet")

MAX_FILE_MB = 8
MAX_BATCH = 50
HEATMAP_MAX_SIDE = 448  # heatmap image size returned to the browser
HEATMAP_ALPHA = 0.4

CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("PAWLENS_CORS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if o.strip()
]

VERSION = "1.0.0"
