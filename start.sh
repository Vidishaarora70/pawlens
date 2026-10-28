#!/usr/bin/env bash
# Starts PawLens at http://localhost:8000 (backend + built frontend).
# The first run builds backend/.venv with a Python that TensorFlow supports; later runs reuse it.
set -e
cd "$(dirname "$0")/backend"

# TensorFlow ships for 64-bit Python 3.10-3.13. Set PYTHON=/path/to/python to pick one yourself.
supported() {
  "$1" -c 'import sys; sys.exit(0 if (3, 10) <= sys.version_info[:2] <= (3, 13) and sys.maxsize > 2**32 else 1)' 2>/dev/null
}

# Reuse a working environment. The marker is written only after TensorFlow imported cleanly.
if [ -f .venv/.pawlens-ready ] && .venv/bin/python -c "import uvicorn" 2>/dev/null; then
  :
elif [ -x .venv/bin/python ] && .venv/bin/python -c "import tensorflow, fastapi, uvicorn" 2>/dev/null; then
  touch .venv/.pawlens-ready
else
  if [ -d .venv ]; then
    echo "The Python environment in backend/.venv is broken or incomplete, rebuilding it..."
    rm -rf .venv
  fi
  PY=""
  for c in ${PYTHON:-} python3.12 python3.11 python3.13 python3.10 python3; do
    if command -v "$c" >/dev/null 2>&1 && supported "$c"; then PY=$c; break; fi
  done
  if [ -z "$PY" ]; then
    echo "PawLens needs 64-bit Python 3.10 to 3.13. TensorFlow does not support newer versions yet."
    echo "Install Python 3.12 (python.org, Homebrew or your package manager) and run ./start.sh again."
    exit 1
  fi
  echo "Creating backend/.venv with $("$PY" --version 2>&1). First run only, this takes a few minutes..."
  trap 'echo; echo "Setup failed, see the messages above. The half-built backend/.venv is removed."; rm -rf .venv' ERR
  "$PY" -m venv .venv
  .venv/bin/python -m pip install --upgrade pip
  .venv/bin/python -m pip install -r requirements.txt
  .venv/bin/python -c "import tensorflow, fastapi, uvicorn"
  trap - ERR
  touch .venv/.pawlens-ready
fi

echo ""
echo "PawLens is starting. Open http://localhost:8000 when you see 'Application startup complete'."
echo ""
exec .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
