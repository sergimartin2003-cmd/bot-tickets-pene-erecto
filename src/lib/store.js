'use strict';

const fs = require('node:fs');
const path = require('node:path');

const config = require('../config');

const DIR = path.join(config.ROOT, 'data');
const RUTA = path.join(DIR, 'db.json');

const VACIO = { guilds: {}, usuarios: {}, tickets: {} };

let db = VACIO;
let guardadoPendiente = null;

function leer() {
  try {
    const datos = JSON.parse(fs.readFileSync(RUTA, 'utf8'));
    db = {
      guilds: datos.guilds || {},
      usuarios: datos.usuarios || {},
      tickets: datos.tickets || {},
    };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('[store] db.json ilegible, se empieza de cero:', err.message);
    }
    db = structuredClone(VACIO);
  }
}

function escribir() {
  fs.mkdirSync(DIR, { recursive: true });
  // Escritura atomica: si el proceso muere a media escritura, db.json sigue
  // siendo el ultimo estado valido.
  const tmp = `${RUTA}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, RUTA);
}

// Agrupa las escrituras del mismo tick: un cambio puede tocar varias claves.
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

// --- Configuracion del servidor ---

const CONFIG_GUILD_POR_DEFECTO = {
  categoriaId: null,
  categoriaCerradosId: null,
  logsId: null,
  canalCuentasId: null,
  staffRolId: null,
  contador: 0,
  tipos: null,
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
  const numero = (getGuild(guildId).contador || 0) + 1;
  setGuild(guildId, { contador: numero });
  return numero;
}

// --- Tipos de ticket (los botones del panel) ---

/** La primera vez copia los tipos por defecto de config.json. */
function getTipos(guildId) {
  const cfg = getGuild(guildId);
  if (!Array.isArray(cfg.tipos)) {
    const iniciales = structuredClone(config.tiposPorDefecto);
    setGuild(guildId, { tipos: iniciales });
    return iniciales;
  }
  return cfg.tipos;
}

function setTipos(guildId, tipos) {
  setGuild(guildId, { tipos });
  return tipos;
}

function getTipo(guildId, tipoId) {
  return getTipos(guildId).find((t) => t.id === tipoId) || null;
}

// --- Memoria por usuario: cuentas e historial ---

const USUARIO_VACIO = { cuentas: {}, historial: [] };
const MAX_HISTORIAL = 25;

function claveUsuario(guildId, usuarioId) {
  return `${guildId}:${usuarioId}`;
}

function getUsuario(guildId, usuarioId) {
  const datos = db.usuarios[claveUsuario(guildId, usuarioId)];
  return { ...USUARIO_VACIO, ...(datos || {}) };
}

function setUsuario(guildId, usuarioId, cambios) {
  const clave = claveUsuario(guildId, usuarioId);
  db.usuarios[clave] = { ...getUsuario(guildId, usuarioId), ...cambios };
  guardar();
  return db.usuarios[clave];
}

/** Apunta un ticket en el historial del usuario (lo mas nuevo primero). */
function apuntarHistorial(guildId, usuarioId, entrada) {
  const usuario = getUsuario(guildId, usuarioId);
  const historial = [entrada, ...usuario.historial].slice(0, MAX_HISTORIAL);
  setUsuario(guildId, usuarioId, { historial });
  return historial;
}

/** Marca como cerrada la entrada del historial de ese ticket. */
function cerrarEnHistorial(guildId, usuarioId, numero) {
  const usuario = getUsuario(guildId, usuarioId);
  const historial = usuario.historial.map((h) =>
    h.numero === numero ? { ...h, cerradoEn: Date.now() } : h,
  );
  setUsuario(guildId, usuarioId, { historial });
  return historial;
}

// --- Tickets abiertos ---

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
  getTipos,
  setTipos,
  getTipo,
  getUsuario,
  setUsuario,
  apuntarHistorial,
  cerrarEnHistorial,
  getTicket,
  setTicket,
  borrarTicket,
  ticketsDe,
  MAX_HISTORIAL,
};
