@echo off
title Secure Infrastructure Access System - Service Launcher
echo ========================================================
echo Starting Secure Infrastructure Access Management System
echo ========================================================
echo.

:: Ensure current working directory is the repository root
cd /d "%~dp0"

echo [0/4] Starting Docker infrastructure (Postgres, Redis, Target Server)...
docker compose up -d

echo [1/4] Seeding Database...
cd backend
call npm run seed
cd ..

echo [2/4] Starting Backend (npm start)...
start "Backend" cmd /k "cd backend && npm start"

echo [3/4] Starting SSH Gateway (python app/main.py)...
start "SSH Gateway" cmd /k "cd gateway && .\.venv\Scripts\activate && python app/main.py"

echo [4/4] Starting Frontend (npm run dev)...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo All 3 services have been launched in separate windows!
echo - Backend:     http://localhost:5000 (or configured port)
echo - SSH Gateway: Port 2222 (or configured port)
echo - Frontend:    http://localhost:5173
echo ========================================================
