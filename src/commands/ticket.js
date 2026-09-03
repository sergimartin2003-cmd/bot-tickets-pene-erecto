'use strict';

const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');

const store = require('../lib/store');
const tickets = require('../lib/tickets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Acciones sobre el ticket actual')
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName('cerrar')
        .setDescription('Cierra este ticket')
        .addStringOption((o) => o.setName('motivo').setDescription('Motivo del cierre').setRequired(false)))
    .addSubcommand((s) => s.setName('reabrir').setDescription('Reabre este ticket'))
    .addSubcommand((s) =>
      s
        .setName('añadir-usuario')
        .setDescription('Da acceso a alguien a este ticket')
        .addUserOption((o) => o.setName('usuario').setDescription('A quien dar acceso').setRequired(true)))
    .addSubcommand((s) =>
      s
        .setName('quitar-usuario')
        .setDescription('Quita el acceso a alguien de este ticket')
        .addUserOption((o) => o.setName('usuario').setDescription('A quien quitar el acceso').setRequired(true)))
    .addSubcommand((s) => s.setName('reclamar').setDescription('Marca que tu atiendes este ticket'))
    .addSubcommand((s) => s.setName('transcripcion').setDescription('Genera la transcripcion del ticket')),

  async execute(interaction) {
    const canal = interaction.channel;
    const ticket = store.getTicket(canal.id);

    if (!ticket) {
      return interaction.reply({
        content: '❌ Este comando solo funciona dentro de un ticket.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const sub = interaction.options.getSubcommand();
    const esStaff = tickets.esStaff(interaction.member);
    const esAutor = ticket.usuarioId === interaction.user.id;

    if (sub === 'cerrar') {
      if (!esStaff && !esAutor) {
        return interaction.reply({
          content: '❌ Solo el autor del ticket o el staff pueden cerrarlo.',
          flags: MessageFlags.Ephemeral,
        });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const res = await tickets.cerrarTicket(canal, interaction.user, interaction.options.getString('motivo'));
      return interaction.editReply(res.error ? `❌ ${res.error}` : '✅ Ticket cerrado.');
    }

    if (sub === 'reabrir') {
      if (!esStaff) {
        return interaction.reply({ content: '❌ Solo el staff puede reabrir tickets.', flags: MessageFlags.Ephemeral });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const res = await tickets.reabrirTicket(canal, interaction.user);
      return interaction.editReply(res.error ? `❌ ${res.error}` : '✅ Ticket reabierto.');
    }

    if (sub === 'reclamar') {
      if (!esStaff) {
        return interaction.reply({ content: '❌ Solo el staff puede reclamar tickets.', flags: MessageFlags.Ephemeral });
      }
      if (ticket.reclamadoPor) {
        return interaction.reply({
          content: `❌ Ya lo reclamo <@${ticket.reclamadoPor}>.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      store.setTicket(canal.id, { reclamadoPor: interaction.user.id });
      return interaction.reply(`🙋 ${interaction.user} atiende este ticket.`);
    }

    if (sub === 'añadir-usuario' || sub === 'quitar-usuario') {
      if (!esStaff) {
        return interaction.reply({
          content: '❌ Solo el staff puede gestionar el acceso al ticket.',
          flags: MessageFlags.Ephemeral,
        });
      }
      const usuario = interaction.options.getUser('usuario');
      const añadir = sub === 'añadir-usuario';

      try {
        if (añadir) {
          await canal.permissionOverwrites.edit(usuario.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
          });
        } else if (usuario.id === ticket.usuarioId) {
          return interaction.reply({
            content: '❌ No puedes quitar del ticket a quien lo abrio. Cierralo en su lugar.',
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await canal.permissionOverwrites.delete(usuario.id);
        }
      } catch (err) {
        console.error('[ticket] error cambiando permisos:', err.message);
        return interaction.reply({
          content: '❌ No he podido cambiar los permisos. Revisa que tengo **Gestionar roles** y **Gestionar canales**.',
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply(añadir ? `✅ ${usuario} añadido al ticket.` : `✅ ${usuario} quitado del ticket.`);
    }

    // transcripcion
    if (!esStaff) {
      return interaction.reply({
        content: '❌ Solo el staff puede generar transcripciones.',
        flags: MessageFlags.Ephemeral,
      });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const fichero = await tickets.generarTranscripcion(canal);
    if (!fichero) {
      return interaction.editReply('❌ No he podido generar la transcripcion.');
    }
    return interaction.editReply({ content: '📄 Aqui tienes la transcripcion:', files: [fichero] });
  },
};
