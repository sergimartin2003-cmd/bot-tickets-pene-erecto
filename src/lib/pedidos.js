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
 * Un "pedido" son las cuentas apuntadas en un ticket, contadas por nivel:
 * { level1: 2, level2: 5, level3: 1 }
 */

function pedidoVacio() {
  return Object.fromEntries(config.niveles.map((n) => [n.id, 0]));
}

function getPedido(canalId) {
  const ticket = store.getTicket(canalId);
  return { ...pedidoVacio(), ...(ticket?.pedido || {}) };
}

function setPedido(canalId, pedido) {
  const limpio = pedidoVacio();
  for (const nivel of config.niveles) {
    limpio[nivel.id] = normalizarCantidad(pedido[nivel.id]);
  }
  store.setTicket(canalId, { pedido: limpio });
  return limpio;
}

/** Suma (o resta, si delta es negativo) cantidad a un nivel concreto. */
function sumarNivel(canalId, nivelId, delta) {
  const pedido = getPedido(canalId);
  pedido[nivelId] = normalizarCantidad((pedido[nivelId] || 0) + delta);
  return setPedido(canalId, pedido);
}

function limpiarPedido(canalId) {
  return setPedido(canalId, pedidoVacio());
}

const MAX_POR_NIVEL = 999;

function normalizarCantidad(valor) {
  const numero = Math.trunc(Number(valor));
  if (!Number.isFinite(numero) || numero < 0) return 0;
  return Math.min(numero, MAX_POR_NIVEL);
}

function totalCuentas(pedido) {
  return config.niveles.reduce((suma, n) => suma + (pedido[n.id] || 0), 0);
}

function totalPrecio(pedido) {
  return config.niveles.reduce((suma, n) => suma + (pedido[n.id] || 0) * n.precio, 0);
}

function formatearPrecio(cantidad) {
  const numero = Math.round(cantidad * 100) / 100;
  const texto = Number.isInteger(numero) ? String(numero) : numero.toFixed(2);
  return `${texto}${config.moneda}`;
}

/** Resumen en una linea: "2x Level 1, 5x Level 2, 1x Level 3" */
function resumenCorto(pedido) {
  const partes = config.niveles
    .filter((n) => (pedido[n.id] || 0) > 0)
    .map((n) => `${pedido[n.id]}x ${n.nombre}`);
  return partes.length ? partes.join(', ') : 'sin cuentas';
}

function embedPedido(pedido, { confirmado = false } = {}) {
  const total = totalCuentas(pedido);
  const precio = totalPrecio(pedido);

  const lineas = config.niveles.map((nivel) => {
    const cantidad = pedido[nivel.id] || 0;
    const emoji = nivel.emoji ? `${nivel.emoji} ` : '';
    const subtotal = nivel.precio > 0 ? ` — ${formatearPrecio(cantidad * nivel.precio)}` : '';
    const marca = cantidad > 0 ? '**' : '';
    return `${emoji}${marca}${nivel.nombre}${marca} · \`${cantidad}\` cuenta(s)${cantidad > 0 ? subtotal : ''}`;
  });

  const embed = new EmbedBuilder()
    .setTitle(confirmado ? '🧾 Pedido confirmado' : '🧾 Pedido de cuentas')
    .setColor(confirmado ? config.colores.exito : config.colores.principal)
    .setDescription(lineas.join('\n'))
    .addFields(
      { name: 'Total de cuentas', value: `\`${total}\``, inline: true },
      { name: 'Precio total', value: `\`${formatearPrecio(precio)}\``, inline: true },
    )
    .setFooter({
      text: confirmado
        ? 'Pedido cerrado por el staff'
        : 'Usa los botones de abajo para ajustar las cantidades',
    })
    .setTimestamp();

  return embed;
}

function botonesPedido({ confirmado = false } = {}) {
  if (confirmado) {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('pedido:reabrir')
          .setLabel('Reabrir pedido')
          .setEmoji('✏️')
          .setStyle(ButtonStyle.Secondary),
      ),
    ];
  }

  const selectNiveles = new StringSelectMenuBuilder()
    .setCustomId('pedido:nivel')
    .setPlaceholder('Añadir cuentas de un nivel concreto...')
    .addOptions(
      config.niveles.map((nivel) => ({
        label: nivel.nombre,
        value: nivel.id,
        emoji: nivel.emoji || undefined,
        description: nivel.precio > 0 ? `${formatearPrecio(nivel.precio)} por cuenta` : undefined,
      })),
    );

  return [
    new ActionRowBuilder().addComponents(selectNiveles),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('pedido:editar')
        .setLabel('Editar cantidades')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('pedido:limpiar')
        .setLabel('Vaciar')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('pedido:confirmar')
        .setLabel('Confirmar (staff)')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
    ),
  ];
}

/**
 * Reescribe el mensaje fijado del pedido dentro del ticket. Si no existe (o
 * lo han borrado), lo crea de nuevo y guarda su id.
 */
async function refrescarMensajePedido(canal) {
  const ticket = store.getTicket(canal.id);
  if (!ticket) return null;

  const pedido = getPedido(canal.id);
  const confirmado = Boolean(ticket.pedidoConfirmado);
  const contenido = {
    embeds: [embedPedido(pedido, { confirmado })],
    components: botonesPedido({ confirmado }),
  };

  if (ticket.mensajePedidoId) {
    try {
      const mensaje = await canal.messages.fetch(ticket.mensajePedidoId);
      return await mensaje.edit(contenido);
    } catch {
      // Mensaje borrado: seguimos y creamos uno nuevo.
    }
  }

  const mensaje = await canal.send(contenido);
  store.setTicket(canal.id, { mensajePedidoId: mensaje.id });
  try {
    await mensaje.pin();
  } catch {
    // Sin permiso para fijar mensajes: no es critico.
  }
  return mensaje;
}

module.exports = {
  pedidoVacio,
  getPedido,
  setPedido,
  sumarNivel,
  limpiarPedido,
  normalizarCantidad,
  totalCuentas,
  totalPrecio,
  formatearPrecio,
  resumenCorto,
  embedPedido,
  botonesPedido,
  refrescarMensajePedido,
  MAX_POR_NIVEL,
};
