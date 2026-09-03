@echo off
REM Doble clic aqui para arrancar el bot en Windows.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [X] No tienes Node.js instalado.
  echo     Bajalo de https://nodejs.org ^(version 18 o superior^) y vuelve a intentarlo.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias, esto tarda un poco la primera vez...
  call npm install
  if errorlevel 1 (
    echo.
    echo [X] Fallo la instalacion de dependencias.
    pause
    exit /b 1
  )
)

if not exist ".env" (
  echo No hay configuracion todavia. Vamos a crearla.
  call npm run configurar
  if not exist ".env" (
    echo.
    echo [X] Sin .env no se puede arrancar.
    pause
    exit /b 1
  )
)

echo.
echo Arrancando el bot. Cierra esta ventana o pulsa Ctrl+C para pararlo.
echo.
call npm start

echo.
echo El bot se ha parado.
pause
