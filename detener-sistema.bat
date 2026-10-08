@echo off
title Detener Sistema POS Ventas
color 0C

set "PATH=%SystemRoot%\System32;%SystemRoot%;%SystemRoot%\System32\WindowsPowerShell\v1.0;%PATH%"
cd /d "%~dp0"

echo =======================================================
echo           DETENIENDO SISTEMA POS VENTAS
echo =======================================================
echo.

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -ExecutionPolicy Bypass -File "%~dp0scripts\stop-servers.ps1"

echo.
echo =======================================================
echo       Los servidores han sido detenidos con exito.
echo =======================================================
echo.
echo Puedes cerrar esta ventana o se cerrara en 3 segundos...
ping 127.0.0.1 -n 4 >nul
exit
