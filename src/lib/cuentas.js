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
 * Registro de las cuentas que POSEE el usuario del ticket, contadas por nivel:
 * { level1: 2, level2: 5, level3: 1 }
 *
 * Es informacion privada: solo la ven el dueño del servidor y los
 * administradores, nunca se publica en el canal del ticket.
 */

const MAX_POR_NIVEL = 999;

function registroVacio() {
  return Object.fromEntries(config.niveles.map((n) => [n.id, 0]));
}

function getCuentas(canalId) {
  const ticket = store.getTicket(canalId);
  return { ...registroVacio(), ...(ticket?.cuentas || {}) };
}

function setCuentas(canalId, registro) {
  const limpio = registroVacio();
  for (const nivel of config.niveles) {
    limpio[nivel.id] = normalizarCantidad(registro[nivel.id]);
  }
  store.setTicket(canalId, { cuentas: limpio });
  return limpio;
}

/** Suma (o resta, si delta es negativo) cuentas a un nivel concreto. */
function sumarNivel(canalId, nivelId, delta) {
  const registro = getCuentas(canalId);
  registro[nivelId] = normalizarCantidad((registro[nivelId] || 0) + delta);
  return setCuentas(canalId, registro);
}

function limpiarCuentas(canalId) {
  return setCuentas(canalId, registroVacio());
}

function normalizarCantidad(valor) {
  const numero = Math.trunc(Number(valor));
  if (!Number.isFinite(numero) || numero < 0) return 0;
  return Math.min(numero, MAX_POR_NIVEL);
}

function totalCuentas(registro) {
  return config.niveles.reduce((suma, n) => suma + (registro[n.id] || 0), 0);
}

function valorNivel(nivel) {
  return Number(nivel.valor ?? nivel.precio ?? 0) || 0;
}

function valorTotal(registro) {
  return config.niveles.reduce((suma, n) => suma + (registro[n.id] || 0) * valorNivel(n), 0);
}

/** true si algun nivel tiene valor asignado en config.json. */
function hayValores() {
  return config.niveles.some((n) => valorNivel(n) > 0);
}

function formatearValor(cantidad) {
  const numero = Math.round(cantidad * 100) / 100;
  const texto = Number.isInteger(numero) ? String(numero) : numero.toFixed(2);
  return `${texto}${config.moneda}`;
}

/** Resumen en una linea: "2x Level 1, 5x Level 2, 1x Level 3" */
function resumenCorto(registro) {
  const partes = config.niveles
    .filter((n) => (registro[n.id] || 0) > 0)
    .map((n) => `${registro[n.id]}x ${n.nombre}`);
  return partes.length ? partes.join(', ') : 'ninguna cuenta registrada';
}

function embedCuentas(registro, { usuarioId, numeroTicket, canalId } = {}) {
  const total = totalCuentas(registro);
  const conValores = hayValores();

  const lineas = config.niveles.map((nivel) => {
    const cantidad = registro[nivel.id] || 0;
    const emoji = nivel.emoji ? `${nivel.emoji} ` : '';
    const valor = valorNivel(nivel);
    const subtotal = conValores && valor > 0 && cantidad > 0 ? ` — ${formatearValor(cantidad * valor)}` : '';
    const marca = cantidad > 0 ? '**' : '';
    return `${emoji}${marca}${nivel.nombre}${marca} · \`${cantidad}\` cuenta(s)${subtotal}`;
  });

  const embed = new EmbedBuilder()
    .setTitle('🔐 Cuentas registradas')
    .setColor(config.colores.principal)
    .setDescription(lineas.join('\n'))
    .addFields({ name: 'Total de cuentas', value: `\`${total}\``, inline: true });

  if (conValores) {
    embed.addFields({ name: 'Valor total', value: `\`${formatearValor(valorTotal(registro))}\``, inline: true });
  }

  const contexto = [];
  if (usuarioId) contexto.push(`Usuario: <@${usuarioId}>`);
  if (numeroTicket) contexto.push(canalId ? `Ticket: <#${canalId}> (#${numeroTicket})` : `Ticket #${numeroTicket}`);
  if (contexto.length) embed.addFields({ name: 'Ficha', value: contexto.join(' · ') });

  embed.setFooter({ text: 'Visible solo para el dueño del servidor y los administradores' }).setTimestamp();

  return embed;
}

/**
 * Botones del panel privado. Van dentro de un mensaje efimero, asi que solo
 * los ve el administrador que abre el panel.
 */
function panelCuentas() {
  const selectNiveles = new StringSelectMenuBuilder()
    .setCustomId('cuentas:nivel')
    .setPlaceholder('Sumar o restar cuentas de un nivel...')
    .addOptions(
      config.niveles.map((nivel) => {
        const valor = valorNivel(nivel);
        return {
          label: nivel.nombre,
          value: nivel.id,
          emoji: nivel.emoji || undefined,
          description: valor > 0 ? `${formatearValor(valor)} por cuenta` : undefined,
        };
      }),
    );

  return [
    new ActionRowBuilder().addComponents(selectNiveles),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('cuentas:editar')
        .setLabel('Editar cantidades')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('cuentas:vaciar')
        .setLabel('Vaciar')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('cuentas:refrescar')
        .setLabel('Actualizar')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

/** Contenido completo del panel privado, listo para reply/update efimero. */
function vistaPanel(canalId) {
  const ticket = store.getTicket(canalId);
  return {
    embeds: [
      embedCuentas(getCuentas(canalId), {
        usuarioId: ticket?.usuarioId,
        numeroTicket: ticket?.numero,
      }),
    ],
    components: panelCuentas(),
  };
}

/**
 * Si hay un canal privado de registro configurado, mantiene ahi un mensaje por
 * ticket con las cuentas al dia. Si no hay canal configurado, no hace nada:
 * el registro sigue existiendo y se consulta con el panel privado.
 */
async function refrescarRegistro(guild, canalTicketId) {
  const cfg = store.getGuild(guild.id);
  if (!cfg.canalCuentasId) return null;

  const ticket = store.getTicket(canalTicketId);
  if (!ticket) return null;

  const canal =
    guild.channels.cache.get(cfg.canalCuentasId) ||
    (await guild.channels.fetch(cfg.canalCuentasId).catch(() => null));

  if (!canal?.isTextBased()) return null;

  const contenido = {
    embeds: [
      embedCuentas(getCuentas(canalTicketId), {
        usuarioId: ticket.usuarioId,
        numeroTicket: ticket.numero,
        canalId: canalTicketId,
      }),
    ],
  };

  if (ticket.mensajeRegistroId) {
    try {
      const mensaje = await canal.messages.fetch(ticket.mensajeRegistroId);
      return await mensaje.edit(contenido);
    } catch {
      // El mensaje se ha borrado: creamos uno nuevo mas abajo.
    }
  }

  try {
    const mensaje = await canal.send(contenido);
    store.setTicket(canalTicketId, { mensajeRegistroId: mensaje.id });
    return mensaje;
  } catch (err) {
    console.error('[cuentas] no se ha podido escribir en el canal de registro:', err.message);
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
  totalCuentas,
  valorTotal,
  valorNivel,
  hayValores,
  formatearValor,
  resumenCorto,
  embedCuentas,
  panelCuentas,
  vistaPanel,
  refrescarRegistro,
  MAX_POR_NIVEL,
};
