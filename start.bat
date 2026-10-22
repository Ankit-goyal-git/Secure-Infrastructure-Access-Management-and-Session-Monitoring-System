@echo off
title Secure Infrastructure Access System - Service Launcher
echo ========================================================
echo Starting Secure Infrastructure Access Management System
echo ========================================================
echo.

:: Ensure current working directory is the repository root
cd /d "%~dp0"

echo [1/3] Starting Backend (npm start)...
start "Backend" cmd /k "cd backend && npm start"

echo [2/3] Starting SSH Gateway (python app/main.py)...
start "SSH Gateway" cmd /k "cd gateway && .\.venv\Scripts\activate && python app/main.py"

echo [3/3] Starting Frontend (npm run dev)...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo All 3 services have been launched in separate windows!
echo - Backend:     http://localhost:5000 (or configured port)
echo - SSH Gateway: Port 2222 (or configured port)
echo - Frontend:    http://localhost:5173
echo ========================================================
