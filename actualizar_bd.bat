@echo off
chcp 65001 > nul
title Animigos - Sincronizacion Nocturna de Base de Datos
cd /d "%~dp0\animigos-backend"

echo ========================================================
echo    ANIMIGOS - ACTUALIZACION DE BASE DE DATOS
echo ========================================================
echo Fecha y hora de inicio: %date% %time%
echo.

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] No se encontro el entorno virtual en animigos-backend\.venv
    pause
    exit /b 1
)

echo Ejecutando sincronizacion con MyAnimeList...
echo - Alcance: Temporada actual, proxima y Top 5,000 animes
echo - Pausa conservadora: 2.5s entre peticiones para evitar bloqueos
echo - Guardando registro en actualizacion_nocturna.log
echo.

.venv\Scripts\python.exe manage.py sync_mal_monthly --scope=full --pages=100 --delay=2.5 >> actualizacion_nocturna.log 2>&1

echo ========================================================
echo Proceso finalizado: %date% %time%
echo ========================================================
echo.
echo Resumen del proceso (ultimas lineas del registro):
powershell -Command "Get-Content actualizacion_nocturna.log -Tail 15"
echo.
pause
