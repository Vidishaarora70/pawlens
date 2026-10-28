@echo off
rem Starts PawLens at http://localhost:8000 (backend + built frontend).
rem The first run builds backend\.venv with a Python that TensorFlow supports; later runs reuse it.
setlocal
cd /d "%~dp0backend"

rem TensorFlow ships for 64-bit Python 3.10-3.13. Anaconda is skipped: its python.exe sits next to
rem an old msvcp140.dll, and TensorFlow fails to load against it inside a virtual environment.
set "CHECK=import os, sys; v = sys.version_info[:2]; conda = os.path.isdir(os.path.join(sys.base_prefix, 'conda-meta')) or 'Anaconda' in sys.version; sys.exit(0 if (3, 10) <= v <= (3, 13) and sys.maxsize > 2**32 and not conda else 1)"

rem Reuse a working environment. The marker is written only after TensorFlow imported cleanly.
if exist .venv\.pawlens-ready (
  .venv\Scripts\python -c "import uvicorn" >nul 2>&1 && goto run
)
if exist .venv\Scripts\python.exe (
  echo Checking the existing Python environment...
  .venv\Scripts\python -c "import tensorflow, fastapi, uvicorn" >nul 2>&1 && (
    type nul > .venv\.pawlens-ready
    goto run
  )
)
if exist .venv (
  echo The Python environment in backend\.venv is broken or incomplete, rebuilding it...
  rmdir /s /q .venv
)

set "PY="
for %%v in (3.12 3.11 3.13 3.10) do if not defined PY py -%%v -c "%CHECK%" >nul 2>&1 && set "PY=py -%%v"
if not defined PY python -c "%CHECK%" >nul 2>&1 && set "PY=python"
if not defined PY (
  echo.
  echo PawLens needs 64-bit Python 3.10 to 3.13. TensorFlow does not support Python 3.14 yet,
  echo and Anaconda's Python cannot load TensorFlow inside a virtual environment.
  echo Install Python 3.12 from https://www.python.org/downloads/ and run start.bat again.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%i in ('%PY% --version') do set "PYVER=%%i"
echo Creating backend\.venv with %PYVER%. First run only, this takes a few minutes...
%PY% -m venv .venv || goto setup_failed
.venv\Scripts\python -m pip install --upgrade pip || goto setup_failed
.venv\Scripts\python -m pip install -r requirements.txt || goto setup_failed
.venv\Scripts\python -c "import tensorflow, fastapi, uvicorn" || goto setup_failed
type nul > .venv\.pawlens-ready

:run
echo.
echo PawLens is starting. Open http://localhost:8000 when you see "Application startup complete".
echo.
.venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
pause
exit /b

:setup_failed
echo.
echo Setting up the Python environment failed, see the messages above.
echo The half-built backend\.venv is removed so the next run starts clean.
if exist .venv rmdir /s /q .venv
pause
exit /b 1
