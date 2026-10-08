@echo off
title Crear Acceso Directo al Sistema POS
color 0B

set "PATH=%SystemRoot%\System32;%SystemRoot%;%SystemRoot%\System32\WindowsPowerShell\v1.0;%PATH%"
cd /d "%~dp0"

echo =====================================================================
echo           CREANDO ACCESO DIRECTO EN EL ESCRITORIO
echo =====================================================================
echo.

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -ExecutionPolicy Bypass -File "%~dp0scripts\create-shortcut.ps1"

echo.
echo Presiona cualquier tecla para salir...
pause >nul
exit
