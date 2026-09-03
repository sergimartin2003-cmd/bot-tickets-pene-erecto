'use strict';

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');

const config = require('../config');
const pedidos = require('./pedidos');

/** Modal con un campo por nivel: cantidades absolutas del pedido. */
function modalEditarPedido(pedidoActual) {
  const modal = new ModalBuilder()
    .setCustomId('pedido:editar:modal')
    .setTitle('Cuentas del pedido');

  for (const nivel of config.niveles) {
    const actual = pedidoActual?.[nivel.id] ?? 0;
    const input = new TextInputBuilder()
      .setCustomId(`nivel:${nivel.id}`)
      .setLabel(`Cuentas de ${nivel.nombre}`.slice(0, 45))
      .setPlaceholder(`Ej: 2 (0 = ninguna) · ${pedidos.formatearPrecio(nivel.precio)} c/u`.slice(0, 100))
      .setValue(String(actual))
      .setStyle(TextInputStyle.Short)
      .setMaxLength(3)
      .setRequired(false);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  return modal;
}

/** Modal de un solo nivel: cuantas cuentas de ese nivel se suman. */
function modalCantidadNivel(nivel) {
  const input = new TextInputBuilder()
    .setCustomId('cantidad')
    .setLabel(`Cuentas de ${nivel.nombre} a añadir`.slice(0, 45))
    .setPlaceholder('Ej: 2 · usa un numero negativo para restar')
    .setValue('1')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(4)
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId(`pedido:nivel:modal:${nivel.id}`)
    .setTitle(`Añadir ${nivel.nombre}`.slice(0, 45))
    .addComponents(new ActionRowBuilder().addComponents(input));
}

/** Modal con el motivo del ticket, se pide al abrirlo. */
function modalAbrirTicket(tipo) {
  const input = new TextInputBuilder()
    .setCustomId('motivo')
    .setLabel('Cuentanos brevemente que necesitas')
    .setPlaceholder(
      tipo.conCuentas
        ? 'Ej: quiero 2 de Level 1, 5 de Level 2 y 1 de Level 3'
        : 'Ej: no me llego el pedido de ayer',
    )
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(500)
    .setRequired(false);

  return new ModalBuilder()
    .setCustomId(`ticket:abrir:modal:${tipo.id}`)
    .setTitle(`Ticket · ${tipo.nombre}`.slice(0, 45))
    .addComponents(new ActionRowBuilder().addComponents(input));
}

module.exports = { modalEditarPedido, modalCantidadNivel, modalAbrirTicket };
