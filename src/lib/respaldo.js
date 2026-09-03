'use strict';

const fs = require('node:fs');

const { AttachmentBuilder } = require('discord.js');

const store = require('./store');

/**
 * Respaldo de la memoria del bot en un canal de Discord.
 *
 * En los hostings gratuitos el disco es efimero: cada reinicio o despliegue se
 * lleva por delante data/db.json, o sea los paneles, las cuentas y el
 * historial. Para evitarlo, el bot sube ese archivo a un canal privado cada
 * pocas horas y lo recupera solo si al arrancar no lo encuentra.
 *
 * Se activa poniendo RESPALDO_CANAL_ID en el .env (el canal tiene que ser
 * privado: dentro va toda la base de datos). No se coge de la configuracion
 * del servidor a proposito: si se ha perdido db.json, esa configuracion
 * tampoco esta.
 */

function canalRespaldoId() {
  return process.env.RESPALDO_CANAL_ID || null;
}

const NOMBRE = 'db.json';

async function buscarCanal(client) {
  const id = canalRespaldoId();
  if (!id) return null;

  const canal = client.channels.cache.get(id) || (await client.channels.fetch(id).catch(() => null));
  if (!canal?.isTextBased()) {
    console.error(`⚠️  RESPALDO_CANAL_ID (${id}) no es un canal de texto al que yo pueda acceder.`);
    return null;
  }
  return canal;
}

function hayDatos() {
  try {
    return fs.statSync(store.RUTA).size > 2;
  } catch {
    return false;
  }
}

/** Sube la base de datos al canal de respaldo. */
async function subir(client, motivo = 'automatico') {
  const canal = await buscarCanal(client);
  if (!canal) return false;
  if (!hayDatos()) return false;

  try {
    const fichero = new AttachmentBuilder(fs.readFileSync(store.RUTA), { name: NOMBRE });
    await canal.send({
      content: `🗄️ Respaldo (${motivo}) · <t:${Math.floor(Date.now() / 1000)}:f>`,
      files: [fichero],
    });
    return true;
  } catch (err) {
    console.error('[respaldo] no se ha podido subir:', err.message);
    return false;
  }
}

/**
 * Si al arrancar no hay base de datos, baja la ultima del canal. Asi un
 * reinicio del hosting no se lleva por delante los paneles ni las cuentas.
 */
async function restaurarSiHaceFalta(client) {
  if (hayDatos()) return false;

  const canal = await buscarCanal(client);
  if (!canal) return false;

  try {
    const mensajes = await canal.messages.fetch({ limit: 50 });
    const conRespaldo = mensajes
      .filter((m) => m.author.id === client.user.id && m.attachments.some((a) => a.name === NOMBRE))
      .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
      .first();

    if (!conRespaldo) {
      console.log('ℹ️  No hay ningun respaldo todavia en el canal. Empezamos de cero.');
      return false;
    }

    const adjunto = conRespaldo.attachments.find((a) => a.name === NOMBRE);
    const res = await fetch(adjunto.url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`descarga fallida (${res.status})`);

    const texto = await res.text();
    // Si no es JSON valido, mejor arrancar vacio que corromper la memoria.
    JSON.parse(texto);

    fs.mkdirSync(require('node:path').dirname(store.RUTA), { recursive: true });
    fs.writeFileSync(store.RUTA, texto);
    store.recargar();

    console.log(`♻️  Memoria restaurada del respaldo del <t:${Math.floor(conRespaldo.createdTimestamp / 1000)}>.`);
    return true;
  } catch (err) {
    console.error('[respaldo] no se ha podido restaurar:', err.message);
    return false;
  }
}

/** Programa los respaldos periodicos. */
function iniciarRespaldos(client, { horas = Number(process.env.RESPALDO_HORAS) || 6 } = {}) {
  if (!canalRespaldoId()) {
    console.log('ℹ️  Respaldo desactivado (no hay RESPALDO_CANAL_ID). Recomendado en hostings gratuitos.');
    return null;
  }

  const intervalo = Math.max(0.01, horas) * 60 * 60 * 1000;
  console.log(`🗄️  Respaldo de la memoria cada ${horas} h en el canal ${canalRespaldoId()}`);

  const temporizador = setInterval(() => {
    subir(client, 'automatico').catch(() => {});
  }, intervalo);

  temporizador.unref?.();
  return { temporizador, parar: () => clearInterval(temporizador) };
}

module.exports = { subir, restaurarSiHaceFalta, iniciarRespaldos, canalRespaldoId };
