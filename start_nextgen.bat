@echo off
title Launching NeuraStitch AI
color 0B

echo =========================================================================
echo                     NEURASTITCH AI LAUNCHER
echo =========================================================================
echo.
echo Phase 1 Stack: Next.js + FastAPI + Qdrant Cloud + Neon PostgreSQL
echo.

:: --- 1. Detect and Validate Python / Virtual Environment ---
echo [*] Checking Python environment...
if exist ".venv" (
    echo [OK] Found virtual environment in .venv.
    set PYTHON_CMD=.venv\Scripts\python
    set PIP_CMD=.venv\Scripts\pip
    set VENV_ACTIVE=true
) else (
    python --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo [ERR] Python is not installed or not in PATH. Please install Python 3.11+.
        pause
        exit /b
    )
    echo [OK] Global Python is ready.
    set PYTHON_CMD=python
    set PIP_CMD=pip
    set VENV_ACTIVE=false
)

:: --- 2. Validate Node.js & NPM Installation ---
echo [*] Checking Node.js and NPM...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERR] Node.js is not installed or not in PATH. Please install Node.js (v18+).
    pause
    exit /b
)
echo [OK] Node.js is ready.

:: --- 3. Install Backend Dependencies ---
echo.
echo =========================================================================
echo [*] Installing FastAPI Backend dependencies...
echo =========================================================================
if "%VENV_ACTIVE%"=="true" (
    %PIP_CMD% install -r backend/requirements.txt
) else (
    cd backend
    pip install -r requirements.txt
    cd ..
)
if %errorlevel% neq 0 (
    echo [ERR] Failed to install backend requirements.
    pause
    exit /b
)
echo [OK] Backend packages installed successfully.

:: --- 4. Install Frontend Dependencies ---
echo.
echo =========================================================================
echo [*] Installing Next.js Frontend dependencies...
echo =========================================================================
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo [ERR] Failed to install Next.js frontend requirements.
    pause
    exit /b
)
echo [OK] Frontend packages installed successfully.
cd ..

:: --- 5. Spawn Multi-Server Terminals ---
echo.
echo =========================================================================
echo [*] Spawning Backend & Frontend servers side-by-side...
echo =========================================================================
echo.
echo [*] Starting FastAPI Backend on http://localhost:8000
if "%VENV_ACTIVE%"=="true" (
    start "NeuraStitch FastAPI Backend" cmd /k "cd backend && ..\.venv\Scripts\uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
) else (
    start "NeuraStitch FastAPI Backend" cmd /k "cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
)

echo [*] Starting Next.js Web Frontend on http://localhost:3000
start "NeuraStitch Next.js Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo [SUCCESS] Both servers are spawning.
echo.
echo  - Next.js Web App:  http://localhost:3000
echo  - FastAPI Backend:  http://localhost:8000
echo.
echo NOTE: Make sure to rename '/backend/.env.example' to '.env' and populate
echo your Neon PostgreSQL database string and Qdrant Cloud keys before chatting!
echo.
pause
