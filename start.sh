#!/usr/bin/env bash
# Starts PawLens at http://localhost:8000 (backend + built frontend).
set -e
cd "$(dirname "$0")/backend"
PY=${PYTHON:-python3}
if [ ! -d .venv ]; then
  echo "Creating Python environment (first run only)..."
  $PY -m venv .venv
  .venv/bin/pip install --upgrade pip
  .venv/bin/pip install -r requirements.txt
fi
echo ""
echo "PawLens is starting. Open http://localhost:8000 when you see 'Application startup complete'."
echo ""
exec .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
