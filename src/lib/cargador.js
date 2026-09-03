'use strict';

const fs = require('node:fs');
const path = require('node:path');

/** Devuelve los modulos .js de una carpeta, ya requeridos. */
function cargarCarpeta(carpeta) {
  if (!fs.existsSync(carpeta)) return [];
  return fs
    .readdirSync(carpeta)
    .filter((f) => f.endsWith('.js'))
    .map((f) => require(path.join(carpeta, f)));
}

function cargarComandos() {
  const comandos = cargarCarpeta(path.join(__dirname, '..', 'commands'));
  const validos = [];

  for (const comando of comandos) {
    if (!comando?.data || typeof comando.execute !== 'function') {
      console.warn('[cargador] comando ignorado: le falta "data" o "execute".');
      continue;
    }
    validos.push(comando);
  }

  return validos;
}

function cargarEventos() {
  return cargarCarpeta(path.join(__dirname, '..', 'events')).filter((e) => e?.name && e.execute);
}

module.exports = { cargarComandos, cargarEventos };
