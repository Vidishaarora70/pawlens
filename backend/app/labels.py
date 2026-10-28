"""Label helpers: ImageNet pet classes (for the gate / demo mode) and breed names."""
import json
from pathlib import Path

_PETS = json.loads((Path(__file__).parent / "imagenet_pets.json").read_text())

# ImageNet class index -> readable name
IMAGENET_DOGS = {int(k): v for k, v in _PETS["dog"].items()}  # 151-268 (118 dog breeds)
IMAGENET_CATS = {int(k): v for k, v in _PETS["cat"].items()}  # 281-285 (domestic cats only)

DOG_IDS = sorted(IMAGENET_DOGS)
CAT_IDS = sorted(IMAGENET_CATS)

CAT_BREEDS = {
    "abyssinian", "bengal", "birman", "bombay", "british_shorthair", "egyptian_mau",
    "maine_coon", "persian", "ragdoll", "russian_blue", "siamese", "sphynx",
}


def load_breed_table(path: Path):
    """Read breed_labels.json written by training/train_breed.py."""
    table = json.loads(path.read_text())
    for row in table:
        row.setdefault("display", row["name"].replace("_", " ").title())
        row.setdefault("species", "cat" if row["name"].lower() in CAT_BREEDS else "dog")
    return sorted(table, key=lambda r: r["index"])
