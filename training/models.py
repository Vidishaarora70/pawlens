"""Model builders.

All models:
  * take raw RGB float pixels 0-255, shape (224, 224, 3)
  * are built with the Keras functional API, with the backbone's layers
    flattened into the model (input_tensor=...). That way Grad-CAM can reach
    the last convolution layer by name.
"""
import keras
from keras import layers

from config import IMG_SIZE

SHAPE = (IMG_SIZE, IMG_SIZE, 3)

# Last convolution layer of each model (used by Grad-CAM in the backend).
LAST_CONV = {
    "species_custom_cnn": "last_conv",
    "species_mobilenetv2": "out_relu",
    "breed_efficientnetb0": "top_activation",
}


def custom_cnn():
    """Baseline CNN from scratch: 4 conv blocks -> GAP -> dropout -> sigmoid."""
    inputs = keras.Input(SHAPE, name="image")
    x = layers.Rescaling(1.0 / 255, name="rescale")(inputs)
    for i, filters in enumerate([32, 64, 128, 256]):
        x = layers.Conv2D(filters, 3, padding="same", use_bias=False, name=f"conv{i + 1}")(x)
        x = layers.BatchNormalization(name=f"bn{i + 1}")(x)
        x = layers.Activation("relu", name="last_conv" if i == 3 else f"relu{i + 1}")(x)
        x = layers.MaxPooling2D(name=f"pool{i + 1}")(x)
    x = layers.GlobalAveragePooling2D(name="gap")(x)
    x = layers.Dropout(0.5, name="dropout")(x)
    outputs = layers.Dense(1, activation="sigmoid", name="dog_probability")(x)
    return keras.Model(inputs, outputs, name="species_custom_cnn")


def mobilenet_species(weights="imagenet"):
    """MobileNetV2 transfer learning for cat (0) vs dog (1).

    Returns (model, base). `base` is used to freeze / unfreeze backbone layers.
    """
    inputs = keras.Input(SHAPE, name="image")
    x = layers.Rescaling(1.0 / 127.5, offset=-1.0, name="rescale")(inputs)  # MobileNetV2 wants [-1, 1]
    base = keras.applications.MobileNetV2(include_top=False, weights=weights, input_tensor=x)
    y = layers.GlobalAveragePooling2D(name="gap")(base.output)
    y = layers.Dropout(0.3, name="dropout")(y)
    outputs = layers.Dense(1, activation="sigmoid", name="dog_probability")(y)
    return keras.Model(inputs, outputs, name="species_mobilenetv2"), base


def efficientnet_breed(n_classes=37, weights="imagenet"):
    """EfficientNetB0 fine-tuned for 37 breeds. Normalisation is built in."""
    inputs = keras.Input(SHAPE, name="image")
    base = keras.applications.EfficientNetB0(include_top=False, weights=weights, input_tensor=inputs)
    y = layers.GlobalAveragePooling2D(name="gap")(base.output)
    y = layers.Dropout(0.3, name="dropout")(y)
    outputs = layers.Dense(n_classes, activation="softmax", name="breed_probabilities")(y)
    return keras.Model(inputs, outputs, name="breed_efficientnetb0"), base


def set_trainable(base, trainable_last_n):
    """Freeze the whole backbone, then unfreeze its last N layers.

    BatchNorm layers stay frozen; unfreezing them with tiny batches hurts.
    """
    base_layer_names = {l.name for l in base.layers}
    for l in base.layers:
        l.trainable = False
    if trainable_last_n > 0:
        for l in base.layers[-trainable_last_n:]:
            if not isinstance(l, layers.BatchNormalization):
                l.trainable = True
    return base_layer_names
