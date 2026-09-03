'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');

const config = require('../config');
const store = require('../lib/store');
const pedidos = require('../lib/pedidos');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configura el sistema de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName('categoria')
        .setDescription('Categoria donde se crean los tickets abiertos')
        .addChannelOption((o) =>
          o
            .setName('categoria')
            .setDescription('Categoria de destino')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)))
    .addSubcommand((s) =>
      s
        .setName('categoria-cerrados')
        .setDescription('Categoria a la que se mueven los tickets cerrados')
        .addChannelOption((o) =>
          o
            .setName('categoria')
            .setDescription('Categoria de destino')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)))
    .addSubcommand((s) =>
      s
        .setName('logs')
        .setDescription('Canal donde se registran aperturas y cierres')
        .addChannelOption((o) =>
          o
            .setName('canal')
            .setDescription('Canal de logs')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand((s) =>
      s
        .setName('staff')
        .setDescription('Rol que puede ver y gestionar los tickets')
        .addRoleOption((o) => o.setName('rol').setDescription('Rol de staff').setRequired(true)))
    .addSubcommand((s) => s.setName('ver').setDescription('Muestra la configuracion actual')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'categoria') {
      const categoria = interaction.options.getChannel('categoria');
      store.setGuild(guildId, { categoriaId: categoria.id });
      return interaction.reply({
        content: `✅ Los tickets se crearan en **${categoria.name}**.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'categoria-cerrados') {
      const categoria = interaction.options.getChannel('categoria');
      store.setGuild(guildId, { categoriaCerradosId: categoria.id });
      return interaction.reply({
        content: `✅ Los tickets cerrados se moveran a **${categoria.name}**.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'logs') {
      const canal = interaction.options.getChannel('canal');
      store.setGuild(guildId, { logsId: canal.id });
      return interaction.reply({ content: `✅ Logs en ${canal}.`, flags: MessageFlags.Ephemeral });
    }

    if (sub === 'staff') {
      const rol = interaction.options.getRole('rol');
      store.setGuild(guildId, { staffRolId: rol.id });
      return interaction.reply({
        content: `✅ Rol de staff: ${rol}. Se le dara acceso a los tickets nuevos.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const cfg = store.getGuild(guildId);
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Configuracion de tickets')
      .setColor(config.colores.principal)
      .addFields(
        { name: 'Categoria abiertos', value: cfg.categoriaId ? `<#${cfg.categoriaId}>` : '`sin configurar`', inline: true },
        { name: 'Categoria cerrados', value: cfg.categoriaCerradosId ? `<#${cfg.categoriaCerradosId}>` : '`sin configurar`', inline: true },
        { name: 'Canal de logs', value: cfg.logsId ? `<#${cfg.logsId}>` : '`sin configurar`', inline: true },
        { name: 'Rol de staff', value: cfg.staffRolId ? `<@&${cfg.staffRolId}>` : '`sin configurar`', inline: true },
        { name: 'Tickets creados', value: `\`${cfg.contador}\``, inline: true },
        {
          name: 'Niveles (se editan en config.json)',
          value: config.niveles
            .map((n) => `${n.emoji || '•'} **${n.nombre}** — ${pedidos.formatearPrecio(n.precio)}`)
            .join('\n'),
        },
      );

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
