"""PawLens API.

Run:  uvicorn app.main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
import csv
import logging
import re
import time
import uuid
from contextlib import asynccontextmanager
from typing import Literal, Optional

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import stress
from .config import CORS_ORIGINS, FEEDBACK_DIR, FRONTEND_DIST, GATE_THRESHOLD, MAX_BATCH, MAX_FILE_MB, VERSION
from .images import BadImage, read_image
from .models_loader import load_all, read_metrics
from .pipeline import Engine
from .schemas import BatchResult, Health, PredictionResult, StressResult

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("pawlens")

state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    t = time.perf_counter()
    state["engine"] = Engine(load_all())
    log.info("Models ready in %.1f s", time.perf_counter() - t)
    yield
    state.clear()


app = FastAPI(title="PawLens API", version=VERSION, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])


def engine() -> Engine:
    e = state.get("engine")
    if e is None:
        raise HTTPException(503, "Models are still loading. Try again in a few seconds.")
    return e


async def load(file: UploadFile):
    data = await file.read(MAX_FILE_MB * 1024 * 1024 + 1)
    try:
        return read_image(data)
    except BadImage as e:
        raise HTTPException(400, f"{file.filename or 'Image'}: {e}")


# ----------------------------------------------------------------- routes ----
@app.get("/api/health", response_model=Health)
def health():
    e = engine()
    return {
        "status": "ok", "version": VERSION, "demo_mode": e.reg.demo_mode,
        "models_loaded": e.reg.loaded(), "cam_models": e.cam_models(),
        "gate_threshold": GATE_THRESHOLD, "max_batch": MAX_BATCH, "max_file_mb": MAX_FILE_MB,
    }


@app.post("/api/predict", response_model=PredictionResult)
async def predict(
    file: UploadFile = File(...),
    gradcam: bool = Query(True),
    cam_model: Optional[str] = Query(None, description="mobilenetv2 | custom_cnn | breed | gate"),
):
    e = engine()
    img = await load(file)
    return e.predict_one(img, gradcam=gradcam, cam_model=cam_model, filename=file.filename)


@app.post("/api/predict/batch", response_model=BatchResult)
async def predict_batch(files: list[UploadFile] = File(...)):
    e = engine()
    if len(files) > MAX_BATCH:
        raise HTTPException(400, f"Send at most {MAX_BATCH} images at a time.")
    images, names = [], []
    for f in files:
        images.append(await load(f))
        names.append(f.filename)
    t = time.perf_counter()
    results = e.predict_many(images, names)
    ms = round((time.perf_counter() - t) * 1000, 1)
    for r in results:
        r["inference_ms"] = round(ms / len(results), 1)
    return {"results": results, "inference_ms": ms}


@app.post("/api/stress-test", response_model=StressResult)
async def stress_test(file: UploadFile = File(...)):
    e = engine()
    img = await load(file)
    try:
        return stress.run(e, img)
    except ValueError as err:
        raise HTTPException(400, str(err))


@app.get("/api/models")
def models():
    return read_metrics(engine().reg)


@app.post("/api/feedback")
async def feedback(
    file: UploadFile = File(...),
    correct_label: Literal["cat", "dog", "not_pet"] = Form(...),
    breed: str = Form(""),
    predicted: str = Form(""),
):
    img = await load(file)
    folder = FEEDBACK_DIR / correct_label
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex[:12]}.jpg"
    img.thumbnail((1024, 1024))
    img.save(folder / name, quality=90)
    clean = lambda s: re.sub(r"[^\w\s\-]", "", s)[:60]
    log_path = FEEDBACK_DIR / "feedback_log.csv"
    new = not log_path.exists()
    with log_path.open("a", newline="") as fh:
        w = csv.writer(fh)
        if new:
            w.writerow(["time", "file", "correct_label", "breed", "predicted"])
        w.writerow([time.strftime("%Y-%m-%d %H:%M:%S"), f"{correct_label}/{name}", correct_label,
                    clean(breed), clean(predicted)])
    return {"saved": True}


# ------------------------------------------- serve the built frontend app ----
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "Not found")
        file = (FRONTEND_DIST / path).resolve()
        if path and file.is_file() and FRONTEND_DIST.resolve() in file.parents:
            return FileResponse(file)
        return FileResponse(FRONTEND_DIST / "index.html")
