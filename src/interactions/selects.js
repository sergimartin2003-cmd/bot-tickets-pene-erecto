'use strict';

const { MessageFlags } = require('discord.js');

const config = require('../config');
const store = require('../lib/store');
const tickets = require('../lib/tickets');
const modales = require('../lib/modales');
const { esAdmin, AVISO_SOLO_ADMIN } = require('../lib/permisos');

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

  // Panel privado de cuentas: elegir nivel para sumar o restar.
  if (interaction.customId === 'cuentas:nivel') {
    if (!esAdmin(interaction.member)) {
      await interaction.reply({ content: AVISO_SOLO_ADMIN, flags: MessageFlags.Ephemeral });
      return true;
    }

    if (!store.getTicket(interaction.channelId)) {
      await interaction.reply({
        content: '❌ Este canal ya no consta como ticket.',
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

module.exports = { manejar };
