'use strict';

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

const config = require('../config');
const store = require('../lib/store');
const cuentas = require('../lib/cuentas');
const tickets = require('../lib/tickets');
const modales = require('../lib/modales');
const { esAdmin, AVISO_SOLO_ADMIN } = require('../lib/permisos');

function efimero(contenido) {
  return { content: contenido, flags: MessageFlags.Ephemeral };
}

function comprobarTicket(interaction, { requiereAbierto = true, requiereStaff = false } = {}) {
  const ticket = store.getTicket(interaction.channelId);
  if (!ticket) return { error: '❌ Este canal ya no consta como ticket.' };
  if (requiereAbierto && ticket.cerrado) return { error: '❌ Este ticket esta cerrado.' };
  if (requiereStaff && !tickets.esStaff(interaction.member)) {
    return { error: '❌ Solo el staff puede hacer esto.' };
  }
  return { ticket };
}

/** El registro de cuentas es solo para el dueño del servidor y los admins. */
function comprobarAcceso(interaction) {
  if (!esAdmin(interaction.member)) return { error: AVISO_SOLO_ADMIN };
  const ticket = store.getTicket(interaction.channelId);
  if (!ticket) return { error: '❌ Este canal ya no consta como ticket.' };
  return { ticket };
}

const handlers = {
  // --- Registro privado de cuentas ---

  async 'cuentas:editar'(interaction) {
    const { error } = comprobarAcceso(interaction);
    if (error) return interaction.reply(efimero(error));

    return interaction.showModal(modales.modalEditarCuentas(cuentas.getCuentas(interaction.channelId)));
  },

  async 'cuentas:vaciar'(interaction) {
    const { error } = comprobarAcceso(interaction);
    if (error) return interaction.reply(efimero(error));

    cuentas.limpiarCuentas(interaction.channelId);
    await cuentas.refrescarRegistro(interaction.guild, interaction.channelId);
    return interaction.update(cuentas.vistaPanel(interaction.channelId));
  },

  async 'cuentas:refrescar'(interaction) {
    const { error } = comprobarAcceso(interaction);
    if (error) return interaction.reply(efimero(error));

    return interaction.update(cuentas.vistaPanel(interaction.channelId));
  },

  // --- Ticket ---

  async 'ticket:cerrar'(interaction) {
    const { ticket, error } = comprobarTicket(interaction);
    if (error) return interaction.reply(efimero(error));

    if (ticket.usuarioId !== interaction.user.id && !tickets.esStaff(interaction.member)) {
      return interaction.reply(efimero('❌ Solo el autor del ticket o el staff pueden cerrarlo.'));
    }

    const confirmar = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket:cerrar:si')
        .setLabel('Si, cerrar')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger),
    );

    return interaction.reply({
      content: '¿Seguro que quieres cerrar el ticket?',
      components: [confirmar],
      flags: MessageFlags.Ephemeral,
    });
  },

  async 'ticket:cerrar:si'(interaction) {
    const { ticket, error } = comprobarTicket(interaction);
    if (error) return interaction.reply(efimero(error));

    if (ticket.usuarioId !== interaction.user.id && !tickets.esStaff(interaction.member)) {
      return interaction.reply(efimero('❌ Solo el autor del ticket o el staff pueden cerrarlo.'));
    }

    await interaction.update({ content: '🔒 Cerrando el ticket...', components: [] });
    const res = await tickets.cerrarTicket(interaction.channel, interaction.user, null);
    return interaction.editReply({ content: res.error ? `❌ ${res.error}` : '✅ Ticket cerrado.' });
  },

  async 'ticket:reabrir'(interaction) {
    const { error } = comprobarTicket(interaction, { requiereAbierto: false, requiereStaff: true });
    if (error) return interaction.reply(efimero(error));

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const res = await tickets.reabrirTicket(interaction.channel, interaction.user);
    return interaction.editReply(res.error ? `❌ ${res.error}` : '✅ Ticket reabierto.');
  },

  async 'ticket:reclamar'(interaction) {
    const { ticket, error } = comprobarTicket(interaction, { requiereStaff: true });
    if (error) return interaction.reply(efimero(error));

    if (ticket.reclamadoPor) {
      return interaction.reply(efimero(`❌ Ya lo reclamo <@${ticket.reclamadoPor}>.`));
    }

    store.setTicket(interaction.channelId, { reclamadoPor: interaction.user.id });
    return interaction.reply(`🙋 ${interaction.user} atiende este ticket.`);
  },

  async 'ticket:transcript'(interaction) {
    const { error } = comprobarTicket(interaction, { requiereAbierto: false, requiereStaff: true });
    if (error) return interaction.reply(efimero(error));

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const fichero = await tickets.generarTranscripcion(interaction.channel);
    if (!fichero) return interaction.editReply('❌ No he podido generar la transcripcion.');
    return interaction.editReply({ content: '📄 Aqui tienes la transcripcion:', files: [fichero] });
  },

  async 'ticket:borrar'(interaction) {
    const { ticket, error } = comprobarTicket(interaction, { requiereAbierto: false, requiereStaff: true });
    if (error) return interaction.reply(efimero(error));

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(config.colores.peligro)
          .setDescription('⛔ Borrando el canal en 5 segundos...'),
      ],
    });

    setTimeout(async () => {
      try {
        await interaction.channel.delete(`Ticket #${ticket.numero} borrado por ${interaction.user.tag}`);
        store.borrarTicket(interaction.channelId);
      } catch (err) {
        console.error('[ticket] no se ha podido borrar el canal:', err.message);
      }
    }, 5000);

    return undefined;
  },
};

async function manejar(interaction) {
  const handler = handlers[interaction.customId];
  if (!handler) return false;
  await handler(interaction);
  return true;
}

module.exports = { manejar };
