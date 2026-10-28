# PawLens in one container: the FastAPI backend serves the API and the built web app on $PORT.
#   docker build -t pawlens .
#   docker run -p 8000:8000 pawlens          -> http://localhost:8000
# Trained models in backend/models/ are baked in if present; without them it runs in demo mode.

# ---- 1. build the frontend from source, so the image never ships a stale dist/ ----
FROM node:20-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- 2. Python runtime ----
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TF_CPP_MIN_LOG_LEVEL=2 \
    KERAS_HOME=/opt/keras \
    PORT=8000
WORKDIR /app/backend

COPY backend/requirements.txt ./
RUN pip install -r requirements.txt
# Bake the ImageNet weights (~14 MB) into the image so the container starts without internet access
RUN python -c "import keras; keras.applications.MobileNetV2(weights='imagenet')"

COPY backend/ ./
COPY --from=web /web/dist /app/frontend/dist

# Run as an unprivileged user (uid 1000 also suits Hugging Face Spaces); feedback photos need a writable folder
RUN useradd --create-home --uid 1000 pawlens && mkdir -p feedback && chown pawlens feedback
USER pawlens

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/api/health' % os.environ['PORT'], timeout=4)"
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
