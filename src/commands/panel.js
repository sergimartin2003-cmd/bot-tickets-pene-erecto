'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

const panel = require('../lib/panel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Publica el panel para que la gente abra tickets')
    .addChannelOption((o) =>
      o.setName('canal').setDescription('Canal donde publicar el panel (por defecto, este)').setRequired(false))
    .addStringOption((o) =>
      o.setName('titulo').setDescription('Titulo personalizado del panel').setRequired(false))
    .addStringOption((o) =>
      o.setName('descripcion').setDescription('Descripcion personalizada del panel').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    const canal = interaction.options.getChannel('canal') || interaction.channel;
    const titulo = interaction.options.getString('titulo');
    const descripcion = interaction.options.getString('descripcion');

    if (!canal.isTextBased()) {
      return interaction.reply({ content: '❌ Ese canal no admite mensajes.', flags: MessageFlags.Ephemeral });
    }

    try {
      await canal.send({ embeds: [panel.embedPanel({ titulo, descripcion })], components: [panel.selectPanel()] });
    } catch (err) {
      console.error('[panel] no se ha podido publicar:', err.message);
      return interaction.reply({
        content: `❌ No he podido escribir en ${canal}. Comprueba mis permisos en ese canal.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({ content: `✅ Panel publicado en ${canal}.`, flags: MessageFlags.Ephemeral });
  },
};
