#!/usr/bin/env bash
# Arranca el bot en Linux o macOS: ./start.sh
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "[X] No tienes Node.js instalado."
  echo "    Instalalo desde https://nodejs.org (version 18 o superior) y vuelve a intentarlo."
  echo
  exit 1
fi

version=$(node -p "process.versions.node.split('.')[0]")
if [ "$version" -lt 18 ]; then
  echo "[X] Tienes Node.js $version y hace falta la 18 o superior."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Instalando dependencias, esto tarda un poco la primera vez..."
  npm install
fi

if [ ! -f .env ]; then
  echo "No hay configuracion todavia. Vamos a crearla."
  npm run configurar
  if [ ! -f .env ]; then
    echo "[X] Sin .env no se puede arrancar."
    exit 1
  fi
fi

echo
echo "Arrancando el bot. Pulsa Ctrl+C para pararlo."
echo
exec npm start
