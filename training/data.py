"""Data loading, splitting and augmentation.

All images leave this module as float32 RGB in the range 0-255, size 224x224.
Every model has its own normalisation layer inside it, so the backend can
feed raw pixels to any model.
"""
import tensorflow as tf
import keras

from config import IMG_SIZE, BATCH_SIZE, SEED, CAT_BREEDS

AUTOTUNE = tf.data.AUTOTUNE

# Augmentation runs in the data pipeline (train split only), not inside the
# saved models. This keeps the saved models clean for inference and Grad-CAM.
_augment = keras.Sequential(
    [
        keras.layers.RandomFlip("horizontal", seed=SEED),
        keras.layers.RandomRotation(0.1, seed=SEED),
        keras.layers.RandomZoom(0.1, seed=SEED),
        keras.layers.RandomContrast(0.1, seed=SEED),
    ],
    name="augment",
)


def _resize(image, label):
    image = tf.image.resize(image, (IMG_SIZE, IMG_SIZE))
    return tf.cast(image, tf.float32), label


def _finish(ds, training, limit=None):
    if limit:
        ds = ds.take(limit)
    ds = ds.map(_resize, num_parallel_calls=AUTOTUNE)
    if training:
        ds = ds.shuffle(2000, seed=SEED)
    ds = ds.batch(BATCH_SIZE)
    if training:
        ds = ds.map(lambda x, y: (_augment(x, training=True), y), num_parallel_calls=AUTOTUNE)
    return ds.prefetch(AUTOTUNE)


# ---------------------------------------------------------------- species ----
def load_species(limit=None, synthetic=False):
    """cats_vs_dogs -> (train, val, test, labels). Label 0 = cat, 1 = dog.

    Split 80/10/10 with a fixed order. TFDS already skips the corrupt files
    that exist in the raw Microsoft/Kaggle download.
    """
    labels = ["cat", "dog"]
    if synthetic:
        return (*_synthetic(2, limit or 64, binary=True), labels)
    import tensorflow_datasets as tfds

    train, val, test = tfds.load(
        "cats_vs_dogs",
        split=["train[:80%]", "train[80%:90%]", "train[90%:]"],
        as_supervised=True,
        shuffle_files=False,
    )
    return (
        _finish(train, True, limit),
        _finish(val, False, limit),
        _finish(test, False, limit),
        labels,
    )


# ----------------------------------------------------------------- breeds ----
def breed_table(names):
    """List of {index, name, display, species} for the 37 Oxford-IIIT breeds."""
    table = []
    for i, n in enumerate(names):
        key = n.lower()
        table.append(
            {
                "index": i,
                "name": key,
                "display": n.replace("_", " ").title(),
                "species": "cat" if key in CAT_BREEDS else "dog",
            }
        )
    return table


def load_breeds(limit=None, synthetic=False, one_hot=True):
    """oxford_iiit_pet -> (train, val, test, breed_table).

    TFDS ships it as train (3,680) + test (3,669). We re-split all 7,349
    images 80/10/10: train + first 60% of test for training, then 20% / 20%
    of the test split for validation and test.
    """
    if synthetic:
        names = sorted(CAT_BREEDS) + [f"dog_breed_{i}" for i in range(25)]
        train, val, test = _synthetic(37, limit or 64, binary=False, one_hot=one_hot)
        return train, val, test, breed_table(names)

    import tensorflow_datasets as tfds

    (train, val, test), info = tfds.load(
        "oxford_iiit_pet",
        split=["train+test[:60%]", "test[60%:80%]", "test[80%:]"],
        with_info=True,
        shuffle_files=False,
    )
    names = info.features["label"].names
    n = len(names)

    def pick(ex):
        y = ex["label"]
        if one_hot:
            y = tf.one_hot(y, n)
        return ex["image"], y

    train, val, test = (d.map(pick, num_parallel_calls=AUTOTUNE) for d in (train, val, test))
    return (
        _finish(train, True, limit),
        _finish(val, False, limit),
        _finish(test, False, limit),
        breed_table(names),
    )


# -------------------------------------------------------------- synthetic ----
def _synthetic(n_classes, n, binary, one_hot=False):
    """Random images for testing the code path without downloading data."""
    def make(count):
        x = tf.random.uniform((count, IMG_SIZE, IMG_SIZE, 3), 0, 255, seed=SEED)
        y = tf.random.uniform((count,), 0, n_classes, dtype=tf.int32, seed=SEED)
        if binary:
            y = tf.cast(y, tf.float32)
        elif one_hot:
            y = tf.one_hot(y, n_classes)
        return tf.data.Dataset.from_tensor_slices((x, y)).batch(BATCH_SIZE)

    return make(n), make(max(8, n // 4)), make(max(8, n // 4))
