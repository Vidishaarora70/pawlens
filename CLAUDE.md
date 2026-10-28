# Notes for Claude Code

- Spec: `docs/PawLens_BUILD_SPEC.md` (section 14 lists what was actually built).
- Backend: FastAPI in `backend/app`. Run tests with
  `cd backend && PAWLENS_GATE_WEIGHTS=none PAWLENS_GATE_THRESHOLD=0 pytest -q`
  (no internet needed). To test trained mode offline, smoke-train tiny models:
  `cd training && PAWLENS_OUT_DIR=/tmp/m python train_species.py --synthetic --no-pretrained --epochs 1`
  (same for the other two scripts), then set `PAWLENS_MODELS_DIR=/tmp/m`.
- Frontend: React 19 + TS + Tailwind v4 + Framer Motion + Recharts 3 in `frontend/`.
  `npm run build` must pass with no TypeScript errors; the backend serves `frontend/dist`.
- Never hard-code accuracy numbers in the UI; the Model lab reads `backend/models/metrics/*.json`.
- Keep the model input contract: raw RGB 0–255, 224×224, normalisation inside the model.
