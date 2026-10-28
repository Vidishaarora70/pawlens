"""Reading uploads and turning them into model inputs."""
import io

import numpy as np
import tensorflow as tf
from PIL import Image, ImageOps, UnidentifiedImageError

from .config import IMG_SIZE, MAX_FILE_MB

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "MPO"}  # MPO = JPEG from some phone cameras


class BadImage(ValueError):
    pass


def read_image(data: bytes) -> Image.Image:
    if not data:
        raise BadImage("The file is empty.")
    if len(data) > MAX_FILE_MB * 1024 * 1024:
        raise BadImage(f"Image is larger than {MAX_FILE_MB} MB.")
    try:
        img = Image.open(io.BytesIO(data))
        fmt = img.format
        img.load()
    except (UnidentifiedImageError, OSError):
        raise BadImage("This file is not a readable image. Use JPG, PNG or WEBP.")
    if fmt not in ALLOWED_FORMATS:
        raise BadImage(f"{fmt} images are not supported. Use JPG, PNG or WEBP.")
    img = ImageOps.exif_transpose(img)  # respect phone rotation
    return img.convert("RGB")


def to_input(img: Image.Image) -> np.ndarray:
    """PIL image -> float32 array (224, 224, 3), pixels 0-255.

    Uses tf.image.resize (bilinear, aspect ratio not kept) so inference matches
    exactly how the training pipeline resized images.
    """
    arr = np.asarray(img, dtype=np.float32)
    return tf.image.resize(arr, (IMG_SIZE, IMG_SIZE)).numpy()


def to_batch(images: list[Image.Image]) -> np.ndarray:
    return np.stack([to_input(i) for i in images])
