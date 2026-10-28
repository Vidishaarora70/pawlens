"""Response shapes (also shown in the auto-generated API docs at /docs)."""
from typing import Literal, Optional

from pydantic import BaseModel

Species = Literal["cat", "dog"]


class Breed(BaseModel):
    name: str
    confidence: float


class Vote(BaseModel):
    model: str
    species: Species
    confidence: float


class PredictionResult(BaseModel):
    id: str
    filename: Optional[str] = None
    is_pet: bool
    gate_confidence: float            # probability that a cat or dog is in the photo
    species: Optional[Species] = None
    species_confidence: Optional[float] = None
    breeds: list[Breed] = []          # top 3, only breeds of the predicted species
    votes: list[Vote] = []            # what every loaded species model says
    agreement: bool = True            # species model and breed model agree
    models_disagree: bool = False     # the species models give different answers
    heatmap_png: Optional[str] = None  # data URL, only when gradcam=true
    cam_model: Optional[str] = None
    inference_ms: float
    demo_mode: bool


class BatchResult(BaseModel):
    results: list[PredictionResult]
    inference_ms: float


class StressTest(BaseModel):
    name: Literal["blur", "brightness", "rotation", "noise"]
    unit: str
    levels: list[float]
    confidence: list[float]   # confidence in the original label at each level (0 if rejected as non-pet)
    still_correct: list[bool]
    label_flipped_at: Optional[float] = None


class StressResult(BaseModel):
    base_label: Species
    base_confidence: float
    tests: list[StressTest]
    robustness_score: float   # 0-100: how much confidence is kept across all changes
    inference_ms: float
    demo_mode: bool


class Health(BaseModel):
    status: str
    version: str
    demo_mode: bool
    models_loaded: list[str]
    cam_models: list[str]
    gate_threshold: float
    max_batch: int
    max_file_mb: int
