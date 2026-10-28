"""Grad-CAM (Selvaraju et al., ICCV 2017) and heatmap overlay."""
import base64
from typing import Callable

import cv2
import keras
import numpy as np
import tensorflow as tf
from PIL import Image

from .config import HEATMAP_ALPHA, HEATMAP_MAX_SIDE

_grad_models: dict = {}


def _grad_model(model: keras.Model, layer_name: str) -> keras.Model:
    key = (id(model), layer_name)
    if key not in _grad_models:
        _grad_models[key] = keras.Model(model.inputs, [model.get_layer(layer_name).output, model.output])
    return _grad_models[key]


def compute_cam(model: keras.Model, layer_name: str, x: np.ndarray,
                target: Callable[[tf.Tensor], tf.Tensor]) -> np.ndarray:
    """Return a (h, w) heatmap in [0, 1] for a single image batch `x` of shape (1, H, W, 3).

    `target` picks the score to explain from the model output, e.g. the
    probability of the predicted class.
    """
    gm = _grad_model(model, layer_name)
    x = tf.convert_to_tensor(x)
    with tf.GradientTape() as tape:
        conv, preds = gm(x, training=False)
        score = target(preds)
    grads = tape.gradient(score, conv)
    if grads is None:
        return np.zeros(conv.shape[1:3], dtype=np.float32)
    weights = tf.reduce_mean(grads, axis=(0, 1, 2))           # one weight per channel
    cam = tf.nn.relu(tf.reduce_sum(conv[0] * weights, axis=-1)).numpy()
    peak = cam.max()
    return (cam / peak).astype(np.float32) if peak > 1e-8 else np.zeros_like(cam, dtype=np.float32)


def overlay(img: Image.Image, cam: np.ndarray) -> str:
    """Blend the heatmap over the photo; returns a PNG data URL."""
    w, h = img.size
    scale = min(1.0, HEATMAP_MAX_SIDE / max(w, h))
    size = (max(1, round(w * scale)), max(1, round(h * scale)))
    photo = np.asarray(img.resize(size, Image.BILINEAR), dtype=np.uint8)
    heat = cv2.resize(cam, size, interpolation=cv2.INTER_CUBIC)
    heat = np.clip(heat, 0, 1)
    colored = cv2.applyColorMap(np.uint8(255 * heat), cv2.COLORMAP_JET)
    colored = cv2.cvtColor(colored, cv2.COLOR_BGR2RGB)
    blended = cv2.addWeighted(colored, HEATMAP_ALPHA, photo, 1 - HEATMAP_ALPHA, 0)
    ok, buf = cv2.imencode(".png", cv2.cvtColor(blended, cv2.COLOR_RGB2BGR))
    if not ok:
        return ""
    return "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode()
