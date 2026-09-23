@echo off
title POS Ventas - Frontend (Puerto 5173)
color 0B

:: Asegurar PATH con Node y pnpm
set "PATH=%SystemRoot%\System32;%SystemRoot%;C:\Program Files\nodejs;%APPDATA%\npm;%LOCALAPPDATA%\Programs\node;%PATH%"

cd /d "%~dp0..\artifacts\pos-ventas"

:: Variables de entorno del Frontend
set "PORT=5173"
set "BASE_PATH=/"
set "VITE_API_URL=http://localhost:5000/api"

echo =====================================================================
echo                POS VENTAS - SERVIDOR FRONTEND (VITE)
echo                Puerto: 5173  ^|  URL: http://localhost:5173
echo =====================================================================
echo.

call pnpm run dev

if errorlevel 1 (
    echo.
    echo [ERROR] El servidor Frontend se detuvo con errores.
    pause
)
