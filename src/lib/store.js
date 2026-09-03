'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { ROOT } = require('../config');

const DIR = path.join(ROOT, 'data');
const RUTA = path.join(DIR, 'db.json');

const VACIO = { guilds: {}, tickets: {} };

let db = VACIO;
let guardadoPendiente = null;

function leer() {
  try {
    const crudo = fs.readFileSync(RUTA, 'utf8');
    const datos = JSON.parse(crudo);
    db = { guilds: datos.guilds || {}, tickets: datos.tickets || {} };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('[store] db.json ilegible, se empieza de cero:', err.message);
    }
    db = structuredClone(VACIO);
  }
}

function escribir() {
  fs.mkdirSync(DIR, { recursive: true });
  // Escritura atomica: si el proceso muere a media escritura, db.json
  // sigue siendo el ultimo estado valido.
  const tmp = `${RUTA}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, RUTA);
}

// Agrupa las escrituras del mismo tick: un pedido puede tocar varias claves.
function guardar() {
  if (guardadoPendiente) return;
  guardadoPendiente = setTimeout(() => {
    guardadoPendiente = null;
    try {
      escribir();
    } catch (err) {
      console.error('[store] no se ha podido guardar db.json:', err.message);
    }
  }, 0);
  guardadoPendiente.unref?.();
}

leer();

const CONFIG_GUILD_POR_DEFECTO = {
  categoriaId: null,
  categoriaCerradosId: null,
  logsId: null,
  staffRolId: null,
  contador: 0,
};

function getGuild(guildId) {
  if (!db.guilds[guildId]) {
    db.guilds[guildId] = { ...CONFIG_GUILD_POR_DEFECTO };
    guardar();
  }
  return { ...CONFIG_GUILD_POR_DEFECTO, ...db.guilds[guildId] };
}

function setGuild(guildId, cambios) {
  db.guilds[guildId] = { ...getGuild(guildId), ...cambios };
  guardar();
  return db.guilds[guildId];
}

function siguienteNumero(guildId) {
  const cfg = getGuild(guildId);
  const numero = (cfg.contador || 0) + 1;
  setGuild(guildId, { contador: numero });
  return numero;
}

function getTicket(canalId) {
  return db.tickets[canalId] || null;
}

function setTicket(canalId, datos) {
  db.tickets[canalId] = { ...(db.tickets[canalId] || {}), ...datos };
  guardar();
  return db.tickets[canalId];
}

function borrarTicket(canalId) {
  delete db.tickets[canalId];
  guardar();
}

function ticketsDe(guildId, usuarioId) {
  return Object.entries(db.tickets)
    .filter(([, t]) => t.guildId === guildId && t.usuarioId === usuarioId && !t.cerrado)
    .map(([canalId, t]) => ({ canalId, ...t }));
}

module.exports = {
  getGuild,
  setGuild,
  siguienteNumero,
  getTicket,
  setTicket,
  borrarTicket,
  ticketsDe,
};
