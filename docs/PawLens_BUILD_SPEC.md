# PawLens — Build Spec (for Claude Code)

> Explainable Cat & Dog Image Classification with Breed Detection using Deep Learning
> Project-II, B.Tech CSE (Data Science & AI), Session 2026–27
> Team: Anushka Srivastava (202310101150121), Shikha Verma (202310101150132), Vidisha Arora (202310101150160)

This file is the single source of truth for building the project. Build it in the order given in **Section 10**. Do not skip the acceptance checks in **Section 11**.

---

## 1. What we are building

A web app where a user gives a photo (upload, paste, camera, or many at once) and gets:

1. **Gate result** — is there a cat or a dog in the photo at all? If not, say "No cat or dog found" instead of guessing.
2. **Species** — Cat or Dog, with confidence %.
3. **Breed** — top 3 of 37 breeds (12 cat, 25 dog), with confidence bars.
4. **Why-View** — a Grad-CAM heatmap showing which part of the photo the model looked at.
5. **Agreement check** — if the species model and the breed model disagree (e.g. species says Dog, top breed is a cat breed), show an "Uncertain" badge.

Plus extra modules: Live Camera, Batch Sorter, Stress Test Lab, Model Lab (dashboard), prediction History, and a "Wrong prediction?" feedback button.

---

## 2. Tech stack (use exactly this)

| Layer | Choice |
|---|---|
| Training | Python 3.11, TensorFlow 2.16+ (Keras 3), TensorFlow Datasets, NumPy, Matplotlib, Seaborn, scikit-learn (metrics). Run in **Google Colab (GPU)** |
| Backend | FastAPI + Uvicorn, Pillow, NumPy, OpenCV (headless) for heatmap overlay, python-multipart |
| Frontend | React 18 + Vite + TypeScript, Tailwind CSS, Framer Motion, Recharts, react-dropzone, lucide-react icons, JSZip (batch download) |
| Storage | No database. Models + metrics as files. History in browser localStorage. Feedback images saved to `backend/feedback/<label>/` |

---

## 3. Folder structure

```
pawlens/
├── training/
│   ├── PawLens_Training.ipynb        # Colab notebook that runs all scripts below
│   ├── data.py                       # load, clean, split, augment
│   ├── train_custom_cnn.py           # baseline CNN (cat vs dog)
│   ├── train_species.py              # MobileNetV2 transfer learning (cat vs dog)
│   ├── train_breed.py                # EfficientNetB0 fine-tune (37 breeds)
│   ├── evaluate.py                   # writes metrics JSON + plots
│   └── requirements.txt
├── backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI app, CORS, routes
│   │   ├── models_loader.py          # loads models once at startup
│   │   ├── pipeline.py               # gate -> species -> breed -> agreement
│   │   ├── gradcam.py                # Grad-CAM + overlay PNG (base64)
│   │   ├── stress.py                 # blur / brightness / rotation / noise tests
│   │   ├── schemas.py                # Pydantic response models
│   │   └── labels.py                 # breed names, cat/dog breed sets, ImageNet ids
│   ├── models/                       # *.keras files + metrics/*.json go here
│   ├── feedback/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/ (Home, Camera, Batch, StressLab, ModelLab, History, About)
│   │   ├── components/ (UploadZone, ResultCard, ConfidenceBar, HeatmapSlider,
│   │   │               BreedList, Navbar, ThemeToggle, Skeleton, Toast)
│   │   ├── lib/api.ts                # typed API client
│   │   └── lib/history.ts            # localStorage helpers (try/catch)
│   └── ...
└── README.md                         # setup + run instructions
```

---

## 4. Data

| Dataset | Use | Notes |
|---|---|---|
| `cats_vs_dogs` (TensorFlow Datasets, from Microsoft Asirra) | Species models | ~23,262 images, 2 classes. Some files are corrupt in the raw Kaggle/Microsoft copy — TFDS already skips them; if using raw files, drop any image Pillow can't open |
| `oxford_iiit_pet` (TensorFlow Datasets) | Breed model | 7,349 images, 37 breeds (12 cat, 25 dog). Use the class label only, ignore the segmentation masks |

- Split: 80% train / 10% validation / 10% test (fixed seed 42). Never touch the test set until final evaluation.
- Input size: 224 × 224 × 3.
- Augmentation (train only, as Keras layers): RandomFlip("horizontal"), RandomRotation(0.1), RandomZoom(0.1), RandomContrast(0.1).
- Normalisation: use each backbone's own `preprocess_input`. Custom CNN: Rescaling(1/255).
- Pipelines: `tf.data` with `.cache().shuffle().batch(32).prefetch(AUTOTUNE)`.

---

## 5. Models

### 5.1 Pet Gate (no training)
- `MobileNetV2(weights="imagenet", include_top=True)`.
- Sum softmax probability of ImageNet ids **151–268** (dog breeds) and **281–285** (domestic cats: tabby, tiger cat, Persian, Siamese, Egyptian cat). Do NOT count big cats (286+).
- If `dog_prob + cat_prob < 0.35` → return `is_pet = false`, stop the pipeline. Keep threshold in a config constant.
- **Bonus:** this model also works as a **demo mode** fallback: if the trained `.keras` files are missing, the backend still runs using gate probabilities for species and ImageNet dog-breed names. Show a "Demo mode" banner in the UI when this happens.

### 5.2 Baseline: Custom CNN (cat vs dog)
- 4 blocks of Conv2D(32→64→128→256, 3×3, relu) + BatchNorm + MaxPool, then GlobalAveragePooling, Dropout(0.5), Dense(1, sigmoid).
- Adam(1e-3), binary cross-entropy, 15–20 epochs, EarlyStopping(patience 4, restore best).
- Purpose: comparison only. Target ≥ 85% test accuracy.

### 5.3 Main species model: MobileNetV2 transfer learning
- **Build with the functional API so Grad-CAM can reach the last conv layer:**
  `base = MobileNetV2(include_top=False, weights="imagenet", input_tensor=inputs)` → GlobalAveragePooling → Dropout(0.3) → Dense(1, sigmoid).
  (Do NOT wrap the base model as a single nested layer — Grad-CAM then can't find `out_relu`.)
- Stage 1: freeze base, Adam(1e-3), 5 epochs. Stage 2: unfreeze last 30 layers, Adam(1e-5), 5 epochs.
- Target ≥ 95% test accuracy.
- Save as `models/species_mobilenetv2.keras`. Save custom CNN as `models/species_custom_cnn.keras`.

### 5.4 Breed model: EfficientNetB0 fine-tune (37 classes)
- Same functional pattern, Dense(37, softmax). Last conv layer name: `top_activation`.
- Stage 1 frozen (1e-3, 8 epochs), Stage 2 unfreeze last 40 layers (1e-5, 10 epochs). Label smoothing 0.1.
- Targets: ≥ 85% top-1, ≥ 95% top-3 test accuracy.
- Save as `models/breed_efficientnetb0.keras` + `models/breed_labels.json` (index → name, species).
- In the pipeline, show only breeds of the predicted species in the top 3, but keep the raw top-1 for the agreement check.

### 5.5 Grad-CAM
- Standard Grad-CAM (Selvaraju et al., 2017) using `tf.GradientTape` on the last conv layer of the species model (default) — the user can switch to the breed model in the UI.
- Output: heatmap resized to the original image, JET colour map, blended at 40% over the photo, returned as base64 PNG.

### 5.6 Evaluation output (`evaluate.py`)
For each model write `models/metrics/<model_name>.json`:
```json
{
  "model": "species_mobilenetv2",
  "params": 2259265,
  "test_accuracy": 0.97,
  "precision": 0.97, "recall": 0.97, "f1": 0.97,
  "top3_accuracy": null,
  "confusion_matrix": [[1150, 30], [25, 1120]],
  "labels": ["cat", "dog"],
  "history": {"accuracy": [], "val_accuracy": [], "loss": [], "val_loss": []},
  "avg_inference_ms_cpu": 45
}
```
Numbers above are format examples only — always write real results. Never hard-code accuracy in the UI.

---

## 6. Backend API

Base URL: `/api`. All image inputs are multipart `file` fields. Max 8 MB per image; accept JPG, PNG, WEBP. Convert to RGB. Load all models **once** at startup.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | – | `{status, demo_mode, models_loaded: []}` |
| POST | `/predict` | `file`, query `gradcam=true\|false`, `cam_model=species\|breed` | `PredictionResult` |
| POST | `/predict/batch` | `files[]` (max 50) | `{results: PredictionResult[]}` (no Grad-CAM, for speed) |
| POST | `/stress-test` | `file` | `StressResult` |
| GET | `/models` | – | list of metrics JSON objects |
| POST | `/feedback` | `file`, `correct_label` | `{saved: true}` |

```ts
type PredictionResult = {
  id: string;                  // uuid
  is_pet: boolean;
  gate_confidence: number;     // 0..1
  species: "cat" | "dog" | null;
  species_confidence: number | null;
  breeds: { name: string; confidence: number }[];   // top 3, empty if not pet
  agreement: boolean;          // species model vs breed model top-1
  heatmap_png: string | null;  // base64, only when gradcam=true
  inference_ms: number;
  demo_mode: boolean;
};

type StressResult = {
  base_label: string;
  tests: {
    name: "blur" | "brightness" | "rotation" | "noise";
    levels: number[];          // e.g. blur radius 0..8
    confidence: number[];      // confidence in base_label at each level
    label_flipped_at: number | null;
  }[];
  robustness_score: number;    // 0..100, mean confidence kept across all levels
};
```

Errors: return `{detail: "..."}` with 400 for bad file/size, 503 if models still loading. CORS: allow the Vite dev origin.

Performance targets (CPU laptop): single `/predict` with Grad-CAM < 1 s; without < 300 ms.

---

## 7. Frontend

### 7.1 Pages
1. **Home / Classify** — big drag-and-drop zone (also click, paste from clipboard, sample images row with 6 bundled samples incl. one non-pet). After upload → animated **ResultCard**:
   - Species chip with icon, confidence ring/meter.
   - Top-3 breed bars (animated width).
   - **HeatmapSlider**: drag a vertical handle to compare original ↔ Grad-CAM overlay.
   - "Uncertain" badge if `agreement=false`; "No cat or dog found" state if `is_pet=false` (friendly illustration, show gate confidence).
   - Buttons: Download result card (PNG), Wrong prediction? (opens small form → `/feedback`).
2. **Live Camera** — `getUserMedia`, front/back camera switch on mobile, sends a frame every 500 ms (skip if previous request still pending), shows label + confidence overlaid on video, FPS counter, "Freeze & explain" button that takes a snapshot and runs full `/predict` with Grad-CAM.
3. **Batch Sorter** — drop up to 50 images, progress bar, results grid with filter tabs (All / Cats / Dogs / Not a pet / Uncertain), sort by confidence, export **CSV** and **ZIP** (folders `cats/`, `dogs/`, `other/`) using JSZip — all client-side.
4. **Stress Test Lab** — upload one image → line charts (Recharts) of confidence vs blur, brightness, rotation, noise; mark where the label flips; big robustness score (0–100). Also live sliders that apply CSS/canvas filters to preview the effect.
5. **Model Lab** — cards per model (accuracy, F1, params, inference ms), training curves, confusion matrix heatmap, side-by-side **Custom CNN vs MobileNetV2** comparison. Data from `/models`.
6. **History** — last 30 predictions from localStorage (small thumbnails, 128px), clear button. Wrap every localStorage call in try/catch.
7. **About** — how it works (simple animated pipeline diagram), team names, datasets and references.

### 7.2 Design system
- Feel: clean, friendly, modern. Not childish.
- Colours: background `#0F1222` (dark) / `#F7F7FB` (light); primary orange `#FF7A45`; secondary teal `#2EC4B6`; cat accent `#9B5DE5`, dog accent `#FF7A45`; error `#E63946`.
- Dark + light theme with toggle; follow system theme by default.
- Font: Inter (Google Fonts) for UI, JetBrains Mono for numbers.
- Motion (Framer Motion): page fade/slide 200 ms, result card spring-in, breed bars grow, skeleton loaders while waiting. Respect `prefers-reduced-motion`.
- Responsive: mobile-first. Breakpoints 640 / 1024 / 1280. Bottom tab bar on mobile, top navbar on desktop. No horizontal scroll at 360 px width.
- Accessibility: all buttons keyboard reachable, visible focus ring, alt text, colour contrast ≥ 4.5:1, labels never shown by colour alone.

---

## 8. Non-functional rules
- No hard-coded predictions or fake accuracy anywhere.
- Validate file type and size on both frontend and backend.
- Uploaded images are not stored, except when the user submits feedback.
- Type everything (TypeScript strict, Pydantic models).
- `README.md` must explain: how to train in Colab, where to put the `.keras` files, how to run backend and frontend, and demo mode.

---

## 9. Run commands (expected)
```bash
# backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# frontend
cd frontend && npm install && npm run dev   # http://localhost:5173
```

---

## 10. Build order (milestones)
1. Backend skeleton + `/health` + Pet Gate + demo mode → `/predict` works with no trained models.
2. Frontend shell: theme, navbar/tab bar, Home page with UploadZone + ResultCard wired to `/predict`.
3. Grad-CAM + HeatmapSlider.
4. Training scripts + Colab notebook + `evaluate.py` (run in Colab by the team; copy outputs into `backend/models/`).
5. Pipeline switches from demo mode to trained models automatically when files exist; breed + agreement check.
6. Batch Sorter, then Live Camera.
7. Stress Test Lab, then Model Lab.
8. History, feedback, About page, README, polish (loading states, empty states, errors).

---

## 11. Acceptance checks
- [ ] A photo of a car / person / food returns "No cat or dog found".
- [ ] Cat and dog photos return correct species with heatmap over the animal, not the background.
- [ ] Breed top 3 only contains breeds of the predicted species.
- [ ] Batch of 20 images finishes and exports a correct CSV and ZIP.
- [ ] Camera page works on a phone browser (HTTPS or localhost).
- [ ] Stress Test Lab shows 4 charts and a robustness score.
- [ ] Model Lab shows real numbers read from `models/metrics/*.json`.
- [ ] App works at 360 px, 768 px and 1440 px widths with no layout breaks.
- [ ] Lighthouse accessibility score ≥ 90.

---

## 12. Must-have vs stretch
- **Must-have (for final demo):** Gate, species (both models), breed, Grad-CAM, Home page, Batch, Model Lab.
- **Stretch (only after must-haves work):** Live Camera, Stress Test Lab, History, feedback, deployment (backend on Hugging Face Spaces/Render, frontend on Vercel).

## 13. References
- Parkhi, Vedaldi, Zisserman, Jawahar — "Cats and Dogs", CVPR 2012 (Oxford-IIIT Pet dataset).
- Sandler et al. — "MobileNetV2: Inverted Residuals and Linear Bottlenecks", CVPR 2018.
- Tan & Le — "EfficientNet: Rethinking Model Scaling for CNNs", ICML 2019.
- Selvaraju et al. — "Grad-CAM: Visual Explanations from Deep Networks via Gradient-based Localization", ICCV 2017.
- Elson et al. — "Asirra: A CAPTCHA that Exploits Interest-Aligned Manual Image Categorization", ACM CCS 2007 (source of the cats vs dogs images).

---

## 14. Implementation notes (what was built, and where it differs from the plan above)
- **All models take raw RGB pixels 0–255 at 224×224.** Normalisation is a layer inside each model (Rescaling for the CNN and MobileNetV2, built-in for EfficientNetB0). Augmentation runs in the `tf.data` pipeline, not inside the saved models.
- Backbones are built with `input_tensor=...`, so their layers are flattened into the model and Grad-CAM reaches `out_relu` / `top_activation` / `last_conv` by name.
- `PredictionResult` also has `votes` (what each species model says) and `models_disagree`. "Uncertain" is shown when the breed model's top breed is the other species **or** the species models disagree.
- `cam_model` values: `mobilenetv2`, `custom_cnn`, `breed`, or `gate` (demo mode).
- Stress test levels: blur 0–8, brightness 100%→10% (shown as "Low light"), rotation 0–180°, noise σ 0–75. Robustness score = mean share of the original confidence kept across all changed levels (0 when the answer flips or the pet check fails).
- Oxford-IIIT Pet split: `train + test[:60%]` / `test[60%:80%]` / `test[80%:]` = 80/10/10 of 7,349 images.
- No bundled sample photos (licensing); users paste or upload their own.
- The backend serves `frontend/dist`, so the whole app runs on port 8000.
