'use strict';

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');

const config = require('../config');
const store = require('./store');

/**
 * Registro de las cuentas que POSEE cada usuario, contadas por nivel:
 * { level1: 2, level2: 5, level3: 1 }
 *
 * Se guarda por usuario, no por ticket: si abre otro ticket mas adelante, sus
 * cuentas siguen ahi. Solo lo ven el dueño del servidor y los administradores.
 */

const MAX_POR_NIVEL = 999;

function registroVacio() {
  return Object.fromEntries(config.niveles.map((n) => [n.id, 0]));
}

function getCuentas(guildId, usuarioId) {
  return { ...registroVacio(), ...(store.getUsuario(guildId, usuarioId).cuentas || {}) };
}

function setCuentas(guildId, usuarioId, registro) {
  const limpio = registroVacio();
  for (const nivel of config.niveles) {
    limpio[nivel.id] = normalizarCantidad(registro[nivel.id]);
  }
  store.setUsuario(guildId, usuarioId, { cuentas: limpio });
  return limpio;
}

/** Suma (o resta, si delta es negativo) cuentas de un nivel. */
function sumarNivel(guildId, usuarioId, nivelId, delta) {
  const registro = getCuentas(guildId, usuarioId);
  registro[nivelId] = normalizarCantidad((registro[nivelId] || 0) + delta);
  return setCuentas(guildId, usuarioId, registro);
}

function limpiarCuentas(guildId, usuarioId) {
  return setCuentas(guildId, usuarioId, registroVacio());
}

function normalizarCantidad(valor) {
  const numero = Math.trunc(Number(valor));
  if (!Number.isFinite(numero) || numero < 0) return 0;
  return Math.min(numero, MAX_POR_NIVEL);
}

function total(registro) {
  return config.niveles.reduce((suma, n) => suma + (registro[n.id] || 0), 0);
}

/** Resumen en una linea: "2x Level 1, 5x Level 2, 1x Level 3" */
function resumenCorto(registro) {
  const partes = config.niveles
    .filter((n) => (registro[n.id] || 0) > 0)
    .map((n) => `${registro[n.id]}x ${n.nombre}`);
  return partes.length ? partes.join(', ') : 'ninguna cuenta';
}

function embedCuentas(guildId, usuarioId) {
  const registro = getCuentas(guildId, usuarioId);
  const usuario = store.getUsuario(guildId, usuarioId);

  const lineas = config.niveles.map((nivel) => {
    const cantidad = registro[nivel.id] || 0;
    const emoji = nivel.emoji ? `${nivel.emoji} ` : '';
    const marca = cantidad > 0 ? '**' : '';
    return `${emoji}${marca}${nivel.nombre}${marca} · \`${cantidad}\` cuenta(s)`;
  });

  const embed = new EmbedBuilder()
    .setTitle('🔐 Cuentas registradas')
    .setColor(config.colores.principal)
    .setDescription(lineas.join('\n'))
    .addFields(
      { name: 'Usuario', value: `<@${usuarioId}>`, inline: true },
      { name: 'Total', value: `\`${total(registro)}\` cuenta(s)`, inline: true },
    );

  // Memoria: los tickets que ha abierto antes.
  const historial = usuario.historial || [];
  if (historial.length) {
    const ultimos = historial
      .slice(0, 5)
      .map((h) => {
        const fecha = `<t:${Math.floor(h.abiertoEn / 1000)}:d>`;
        return `\`#${h.numero}\` ${h.tipoNombre || h.tipoId} · ${fecha} · ${h.cerradoEn ? 'cerrado' : 'abierto'}`;
      })
      .join('\n');
    embed.addFields({ name: `Tickets abiertos en total: ${historial.length}`, value: ultimos });
  }

  return embed.setFooter({ text: 'Visible solo para el dueño del servidor y los administradores' }).setTimestamp();
}

/** Botones del panel privado. Van en un mensaje efimero. */
function panelCuentas(usuarioId) {
  const selectNiveles = new StringSelectMenuBuilder()
    .setCustomId(`cuentas:nivel:${usuarioId}`)
    .setPlaceholder('Sumar o restar cuentas de un nivel...')
    .addOptions(
      config.niveles.map((nivel) => ({
        label: nivel.nombre,
        value: nivel.id,
        emoji: nivel.emoji || undefined,
      })),
    );

  return [
    new ActionRowBuilder().addComponents(selectNiveles),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`cuentas:editar:${usuarioId}`)
        .setLabel('Editar cantidades')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`cuentas:vaciar:${usuarioId}`)
        .setLabel('Vaciar')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`cuentas:refrescar:${usuarioId}`)
        .setLabel('Actualizar')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

/** Contenido del panel privado, listo para responder en efimero. */
function vistaPanel(guildId, usuarioId) {
  return {
    embeds: [embedCuentas(guildId, usuarioId)],
    components: panelCuentas(usuarioId),
  };
}

/**
 * Si hay canal privado de fichas configurado, mantiene ahi un mensaje por
 * usuario con sus cuentas al dia.
 */
async function refrescarFicha(guild, usuarioId) {
  const cfg = store.getGuild(guild.id);
  if (!cfg.canalCuentasId) return null;

  const canal =
    guild.channels.cache.get(cfg.canalCuentasId) ||
    (await guild.channels.fetch(cfg.canalCuentasId).catch(() => null));

  if (!canal?.isTextBased()) return null;

  const contenido = { embeds: [embedCuentas(guild.id, usuarioId)] };
  const usuario = store.getUsuario(guild.id, usuarioId);

  if (usuario.mensajeFichaId) {
    try {
      const mensaje = await canal.messages.fetch(usuario.mensajeFichaId);
      return await mensaje.edit(contenido);
    } catch {
      // La ficha se ha borrado: creamos otra.
    }
  }

  try {
    const mensaje = await canal.send(contenido);
    store.setUsuario(guild.id, usuarioId, { mensajeFichaId: mensaje.id });
    return mensaje;
  } catch (err) {
    console.error('[cuentas] no se ha podido escribir en el canal de fichas:', err.message);
    return null;
  }
}

module.exports = {
  registroVacio,
  getCuentas,
  setCuentas,
  sumarNivel,
  limpiarCuentas,
  normalizarCantidad,
  total,
  resumenCorto,
  embedCuentas,
  panelCuentas,
  vistaPanel,
  refrescarFicha,
  MAX_POR_NIVEL,
};
