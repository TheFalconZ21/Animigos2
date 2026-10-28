@echo off
chcp 65001 > nul
title Animigos - Iniciador de Entorno Local

echo ========================================================
echo          ANIMIGOS - LEVANTAR SERVICIOS LOCALES
echo ========================================================
echo.

set ROOT_DIR=%~dp0

echo 1. Iniciando servidor Backend (Django en http://127.0.0.1:8000)...
start "Animigos - Backend (Django)" cmd /k "cd /d "%ROOT_DIR%animigos-backend" && .venv\Scripts\activate && python manage.py runserver 127.0.0.1:8000"

echo 2. Iniciando servidor Frontend (Vite en http://localhost:5173)...
start "Animigos - Frontend (Vite)" cmd /k "cd /d "%ROOT_DIR%animigos-frontend" && npm run dev"

echo.
echo ========================================================
echo ¡Ambos servidores se estan ejecutando en consolas separadas!
echo.
echo - Frontend:  http://localhost:5173/
echo - Backend:   http://127.0.0.1:8000/
echo.
echo Presiona cualquier tecla para cerrar esta ventana auxiliar.
echo (Las ventanas de los servidores se mantendran abiertas)
echo ========================================================
pause > nul

