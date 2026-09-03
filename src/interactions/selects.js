'use strict';

const { MessageFlags } = require('discord.js');

const config = require('../config');
const store = require('../lib/store');
const pedidos = require('../lib/pedidos');
const tickets = require('../lib/tickets');
const modales = require('../lib/modales');

async function manejar(interaction) {
  // Panel publico: el usuario elige el tipo de ticket.
  if (interaction.customId === 'ticket:abrir') {
    const tipo = tickets.tipoPorId(interaction.values[0]);
    if (!tipo) {
      await interaction.reply({
        content: '❌ Ese tipo de ticket ya no existe. Avisa a un administrador.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
    await interaction.showModal(modales.modalAbrirTicket(tipo));
    return true;
  }

  // Dentro del ticket: elegir un nivel para añadir cuentas.
  if (interaction.customId === 'pedido:nivel') {
    const ticket = store.getTicket(interaction.channelId);
    if (!ticket || ticket.cerrado) {
      await interaction.reply({
        content: '❌ Este ticket no esta abierto.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const esAutor = ticket.usuarioId === interaction.user.id;
    const esStaff = tickets.esStaff(interaction.member);
    if (!esAutor && !esStaff) {
      await interaction.reply({
        content: '❌ Solo el autor del ticket o el staff pueden modificar el pedido.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
    if (ticket.pedidoConfirmado && !esStaff) {
      await interaction.reply({
        content: '🔒 El pedido ya esta confirmado por el staff.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const nivel = config.nivelPorId(interaction.values[0]);
    if (!nivel) {
      await interaction.reply({ content: '❌ Ese nivel ya no existe.', flags: MessageFlags.Ephemeral });
      return true;
    }

    await interaction.showModal(modales.modalCantidadNivel(nivel));
    return true;
  }

  return false;
}

module.exports = { manejar, pedidos };
