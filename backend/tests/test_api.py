"""API tests. Run from the backend folder:

    PAWLENS_GATE_WEIGHTS=none PAWLENS_GATE_THRESHOLD=0 pytest -q

GATE_WEIGHTS=none uses random weights so the tests work without internet;
GATE_THRESHOLD=0 lets every image through the gate so the full pipeline runs.
Point PAWLENS_MODELS_DIR at a folder with trained .keras files to test
trained mode, or at an empty folder to test demo mode.
"""
import io

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app


def png(w=320, h=240, seed=0):
    rng = np.random.default_rng(seed)
    img = Image.fromarray(rng.integers(0, 255, (h, w, 3), dtype=np.uint8))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "gate_mobilenetv2_imagenet" in body["models_loaded"]
    assert body["cam_models"]


def test_predict_with_heatmap(client):
    r = client.post("/api/predict", files={"file": ("a.png", png(), "image/png")})
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["is_pet"] is True
    assert b["species"] in ("cat", "dog")
    assert 0 <= b["species_confidence"] <= 1
    assert len(b["breeds"]) == 3
    assert b["heatmap_png"].startswith("data:image/png;base64,")
    assert b["votes"]


def test_every_cam_model(client):
    for cam in client.get("/api/health").json()["cam_models"]:
        r = client.post(f"/api/predict?cam_model={cam}", files={"file": ("a.png", png(), "image/png")})
        assert r.status_code == 200, r.text
        assert r.json()["cam_model"] == cam
        assert r.json()["heatmap_png"]


def test_predict_without_heatmap(client):
    r = client.post("/api/predict?gradcam=false", files={"file": ("a.png", png(), "image/png")})
    assert r.status_code == 200
    assert r.json()["heatmap_png"] is None


def test_bad_file(client):
    r = client.post("/api/predict", files={"file": ("a.txt", b"hello", "text/plain")})
    assert r.status_code == 400
    assert "not a readable image" in r.json()["detail"]


def test_batch(client):
    files = [("files", (f"{i}.png", png(seed=i), "image/png")) for i in range(5)]
    r = client.post("/api/predict/batch", files=files)
    assert r.status_code == 200, r.text
    res = r.json()["results"]
    assert [x["filename"] for x in res] == [f"{i}.png" for i in range(5)]


def test_batch_limit(client):
    files = [("files", (f"{i}.png", png(16, 16, i), "image/png")) for i in range(51)]
    assert client.post("/api/predict/batch", files=files).status_code == 400


def test_stress(client):
    r = client.post("/api/stress-test", files={"file": ("a.png", png(), "image/png")})
    assert r.status_code == 200, r.text
    b = r.json()
    assert {t["name"] for t in b["tests"]} == {"blur", "brightness", "rotation", "noise"}
    assert 0 <= b["robustness_score"] <= 100
    for t in b["tests"]:
        assert len(t["levels"]) == len(t["confidence"]) == 6


def test_models(client):
    r = client.get("/api/models")
    assert r.status_code == 200
    assert any(m["task"] == "gate" for m in r.json())


def test_feedback(client, tmp_path, monkeypatch):
    import app.main as m
    monkeypatch.setattr(m, "FEEDBACK_DIR", tmp_path)
    r = client.post("/api/feedback", files={"file": ("a.png", png(), "image/png")},
                    data={"correct_label": "cat", "breed": "Persian", "predicted": "dog"})
    assert r.json() == {"saved": True}
    assert len(list((tmp_path / "cat").glob("*.jpg"))) == 1
    assert (tmp_path / "feedback_log.csv").exists()
    bad = client.post("/api/feedback", files={"file": ("a.png", png(), "image/png")}, data={"correct_label": "horse"})
    assert bad.status_code == 422
