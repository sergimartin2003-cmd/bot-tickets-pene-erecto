'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} = require('discord.js');

const panel = require('../lib/panel');
const { esAdmin } = require('../lib/permisos');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Menu para crear los botones del panel y publicarlo')
    .addChannelOption((o) =>
      o
        .setName('canal')
        .setDescription('Canal donde se publicara el panel (por defecto, este)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    if (!esAdmin(interaction.member)) {
      return interaction.reply({
        content: '❌ Solo los administradores pueden gestionar los paneles.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const destino = interaction.options.getChannel('canal');

    // Menu efimero: se crean los botones y desde ahi se publica el panel.
    return interaction.reply({
      ...panel.vistaGestion(interaction.guildId, { destinoId: destino?.id || null }),
      flags: MessageFlags.Ephemeral,
    });
  },
};
