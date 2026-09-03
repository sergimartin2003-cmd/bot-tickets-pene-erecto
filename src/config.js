'use strict';

const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config();

const ROOT = path.join(__dirname, '..');

// Discord solo permite 5 campos de texto por formulario, y el formulario de
// cuentas pinta un campo por nivel.
const MAX_NIVELES = 5;

// Un panel son botones: 5 por fila, 5 filas. Con 10 tipos vamos sobrados y el
// panel sigue siendo legible.
const MAX_TIPOS = 10;

function cargarConfig() {
  const ruta = path.join(ROOT, 'config.json');
  const datos = JSON.parse(fs.readFileSync(ruta, 'utf8'));

  if (!Array.isArray(datos.niveles) || datos.niveles.length === 0) {
    throw new Error('config.json: "niveles" debe ser una lista con al menos un nivel.');
  }
  if (datos.niveles.length > MAX_NIVELES) {
    throw new Error(`config.json: como maximo ${MAX_NIVELES} niveles (limite de los formularios de Discord).`);
  }
  for (const nivel of datos.niveles) {
    if (!nivel.id || !nivel.nombre) {
      throw new Error('config.json: cada nivel necesita "id" y "nombre".');
    }
  }

  datos.tiposPorDefecto = Array.isArray(datos.tiposPorDefecto) ? datos.tiposPorDefecto : [];

  return datos;
}

const config = cargarConfig();

module.exports = {
  ...config,
  ROOT,
  MAX_NIVELES,
  MAX_TIPOS,
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID || null,
  deployOnStart: String(process.env.DEPLOY_ON_START || '').toLowerCase() === 'true',
  nivelPorId(id) {
    return config.niveles.find((n) => n.id === id) || null;
  },
};
