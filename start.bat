@echo off
rem Starts PawLens at http://localhost:8000 (backend + built frontend).
cd /d "%~dp0backend"
if not exist .venv (
  echo Creating Python environment ^(first run only, takes a few minutes^)...
  py -3 -m venv .venv || python -m venv .venv
  .venv\Scripts\python -m pip install --upgrade pip
  .venv\Scripts\pip install -r requirements.txt
)
echo.
echo PawLens is starting. Open http://localhost:8000 when you see "Application startup complete".
echo.
.venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
pause
