# PawLens

Explainable cat and dog image classification with breed detection.
Project-II, B.Tech CSE (Data Science & AI), session 2026–27.

PawLens takes a photo and:

1. **Checks for a pet** – an ImageNet MobileNetV2 decides whether a cat or dog is in the photo at all. If not, it says "No cat or dog found" instead of guessing.
2. **Names the species** – our MobileNetV2 (transfer learning) says cat or dog. The custom CNN gives a second opinion.
3. **Ranks the breed** – EfficientNetB0 ranks 37 breeds (Oxford-IIIT Pet). If it disagrees with the species model, the answer is marked **Uncertain**.
4. **Explains itself** – a Grad-CAM heatmap shows which part of the photo drove the answer.

Web app pages: **Classify**, **Live camera**, **Batch sorter** (CSV/ZIP export), **Stress test lab**, **Model lab** (real training metrics), **History**, **About**.

---

## Folder structure

```
vivaan/
├── training/              Colab notebook + training scripts
├── backend/
│   ├── app/               FastAPI server (pipeline, Grad-CAM, stress test)
│   ├── models/            put trained .keras files + metrics/ here
│   ├── feedback/          "Wrong answer?" photos are saved here
│   └── tests/             API tests
├── frontend/              React + TypeScript app (dist/ is already built)
├── docs/                  project PPT and build spec
├── start.sh / start.bat   one-command start
└── README.md
```

---

## Quick start (no training needed)

Needs **Python 3.10–3.12** and internet on first start (TensorFlow downloads the ImageNet weights once, about 14 MB).

**Windows:** double-click `start.bat`
**Mac / Linux:** `./start.sh`

Then open **http://localhost:8000**.

Without trained models the app runs in **demo mode**: the ImageNet model handles everything, and breed names come from ImageNet's 118 dog classes and 5 cat classes. A yellow banner says so. Everything else (camera, batch, stress test, heatmaps) works.

---

## Train the real models (Google Colab, ~1 hour)

1. Zip the `training/` folder as `training.zip`.
2. Open `training/PawLens_Training.ipynb` in [Google Colab](https://colab.research.google.com) and set **Runtime → Change runtime type → T4 GPU**.
3. Upload `training.zip` in the Colab file panel and run all cells.
4. Download `pawlens_models.zip` at the end and unzip it into `backend/models/`, so it contains:
   ```
   backend/models/species_mobilenetv2.keras
   backend/models/species_custom_cnn.keras
   backend/models/breed_efficientnetb0.keras
   backend/models/breed_labels.json
   backend/models/metrics/*.json  (+ plots/)
   ```
5. Restart the server. The banner disappears and the Model lab shows your real results.

You can also train on your own machine with a GPU: `cd training && pip install -r requirements.txt && python train_species.py` (same for the other two scripts). Every script has `--limit 64 --epochs 1` for a quick test run.

| Script | Model | Data | Target |
|---|---|---|---|
| `train_custom_cnn.py` | Custom CNN, 4 conv blocks | cats_vs_dogs (~23k images) | ≥ 85% accuracy |
| `train_species.py` | MobileNetV2, 2-stage fine-tune | cats_vs_dogs | ≥ 95% accuracy |
| `train_breed.py` | EfficientNetB0, 2-stage fine-tune | Oxford-IIIT Pet (7,349 images) | ≥ 85% top-1, ≥ 95% top-3 |

Splits are 80% train, 10% validation, 10% test with a fixed order. The test split is only used once, at the end, by `evaluate.py`.

---

## Development mode (hot reload)

Two terminals:

```bash
# 1. backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows   (Mac/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 2. frontend (needs Node.js 20+)
cd frontend
npm install
npm run dev                     # http://localhost:5173 (calls /api on port 8000)
```

After changing the frontend, run `npm run build` so the backend serves the new version at port 8000.

API docs: **http://localhost:8000/docs**

| Method | Path | What it does |
|---|---|---|
| GET | `/api/health` | status, demo mode, loaded models |
| POST | `/api/predict?gradcam=true&cam_model=mobilenetv2` | one photo → full result + heatmap |
| POST | `/api/predict/batch` | up to 50 photos → results (no heatmaps) |
| POST | `/api/stress-test` | one photo → confidence under blur, low light, rotation, noise |
| GET | `/api/models` | training metrics for the Model lab |
| POST | `/api/feedback` | photo + correct label → saved in `backend/feedback/` |

`cam_model` can be `mobilenetv2`, `custom_cnn`, `breed` (trained mode) or `gate` (demo mode).

---

## Tests

```bash
cd backend
pip install pytest httpx
# random gate weights + threshold 0 = runs offline and exercises the full pipeline
PAWLENS_GATE_WEIGHTS=none PAWLENS_GATE_THRESHOLD=0 pytest -q
```

On Windows PowerShell: `$env:PAWLENS_GATE_WEIGHTS="none"; $env:PAWLENS_GATE_THRESHOLD="0"; pytest -q`

---

## Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PAWLENS_GATE_THRESHOLD` | `0.35` | minimum cat+dog probability to accept a photo as a pet |
| `PAWLENS_MODELS_DIR` | `backend/models` | where trained models are loaded from |
| `PAWLENS_FEEDBACK_DIR` | `backend/feedback` | where feedback photos go |
| `PAWLENS_CORS` | `http://localhost:5173,...` | allowed frontend origins (comma separated) |
| `VITE_API_URL` | empty | frontend: API address if the backend is on another host |

---

## Using the camera on a phone

Browsers only allow the camera on `https://` or `localhost`. To test on a phone on the same Wi-Fi, use a tunnel such as `ngrok http 8000` or `cloudflared tunnel --url http://localhost:8000` and open the https link it gives.

---

## Known limits

- The pet check uses ImageNet classes, so cartoon or heavily edited pets may be rejected. Lower `PAWLENS_GATE_THRESHOLD` if that matters for a demo.
- Breed accuracy is lower for look-alike breeds (e.g. Staffordshire vs American Pit Bull Terrier). The confusion matrix in the Model lab shows exactly which.
- Accuracy numbers are only real after you train. Never quote the targets above as results.
