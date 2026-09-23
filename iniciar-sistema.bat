@echo off
setlocal enabledelayedexpansion
title Sistema POS Ventas - Iniciador
color 0B
cd /d "%~dp0"

:: Configurar rutas criticas en PATH
set "PATH=%SystemRoot%\System32;%SystemRoot%;%SystemRoot%\System32\WindowsPowerShell\v1.0;C:\Program Files\nodejs;%APPDATA%\npm;%LOCALAPPDATA%\Programs\node;%PATH%"

echo =====================================================================
echo                   SISTEMA POS VENTAS - INICIANDO
echo =====================================================================
echo.

:: 1. Verificar servicio de PostgreSQL
echo [1/4] Verificando servicio de PostgreSQL...
sc query postgresql-x64-16 2>nul | find /i "RUNNING" >nul
if errorlevel 1 (
    echo       Iniciando servicio de PostgreSQL...
    net start postgresql-x64-16 >nul 2>&1
) else (
    echo       Servicio PostgreSQL activo y listo.
)

:: 2. Liberar puertos si estaban ocupados previamente
echo [2/4] Limpiando procesos previos en puertos 5000 y 5173...
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -ExecutionPolicy Bypass -File "%~dp0scripts\stop-servers.ps1" >nul 2>&1

:: 3. Iniciar Servidores en ventanas dedicadas
echo [3/4] Iniciando Servidor Backend (Puerto 5000)...
start "POS Ventas - Backend (Puerto 5000)" /min cmd /c "%~dp0scripts\run-backend.bat"

:: 4. Levantar Frontend en puerto 5173
echo [4/4] Iniciando Frontend POS (Puerto 5173)...
start "POS Ventas - Frontend (Puerto 5173)" /min cmd /c "%~dp0scripts\run-frontend.bat"

:: Esperar que los servicios inicien
echo.
echo Esperando que los servidores respondan (4 segundos)...
ping 127.0.0.1 -n 5 >nul

:: Abrir navegador automaticamente
echo Abriendo aplicacion en tu navegador...
start http://localhost:5173

cls
color 0A
echo =====================================================================
echo              SISTEMA POS VENTAS INICIADO CON EXITO
echo =====================================================================
echo.
echo   * Frontend POS:  http://localhost:5173
echo   * Backend API:   http://localhost:5000/api
echo.
echo   Credenciales de Acceso Rapido:
echo   -------------------------------------------------------------
echo   Administrador:  admin@demo.com      /  admin123
echo   Vendedor:       vendedor@demo.com   /  vendedor123
echo   Inventario:     inventario@demo.com /  inventario123
echo.
echo =====================================================================
echo   [D] Detener servidores y cerrar sistema
echo   [R] Recargar navegador web (http://localhost:5173)
echo   [X] Salir de esta ventana (los servidores seguiran corriendo)
echo =====================================================================
echo.

:menu_loop
set /p OPCION="Selecciona una opcion [D/R/X]: "
if /i "!OPCION!"=="D" goto detener
if /i "!OPCION!"=="R" goto recargar
if /i "!OPCION!"=="X" goto salir
echo Opcion no valida. Usa D, R o X.
goto menu_loop

:recargar
start http://localhost:5173
goto menu_loop

:detener
echo.
call "%~dp0detener-sistema.bat"
exit

:salir
exit
