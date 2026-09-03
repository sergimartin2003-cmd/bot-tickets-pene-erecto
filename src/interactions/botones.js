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
const pedidos = require('../lib/pedidos');
const tickets = require('../lib/tickets');
const modales = require('../lib/modales');

function efimero(contenido) {
  return { content: contenido, flags: MessageFlags.Ephemeral };
}

/** Comprueba que estamos en un ticket y que quien pulsa puede tocarlo. */
function comprobarTicket(interaction, { requiereAbierto = true, requiereStaff = false } = {}) {
  const ticket = store.getTicket(interaction.channelId);
  if (!ticket) return { error: '❌ Este canal ya no consta como ticket.' };
  if (requiereAbierto && ticket.cerrado) return { error: '❌ Este ticket esta cerrado.' };
  if (requiereStaff && !tickets.esStaff(interaction.member)) {
    return { error: '❌ Solo el staff puede hacer esto.' };
  }
  return { ticket };
}

function puedeEditarPedido(interaction, ticket) {
  const esAutor = ticket.usuarioId === interaction.user.id;
  const esStaff = tickets.esStaff(interaction.member);
  if (!esAutor && !esStaff) return '❌ Solo el autor del ticket o el staff pueden modificar el pedido.';
  if (ticket.pedidoConfirmado && !esStaff) {
    return '🔒 El pedido ya esta confirmado por el staff. Pideles que lo reabran si quieres cambiarlo.';
  }
  return null;
}

const handlers = {
  // --- Pedido de cuentas por nivel ---

  async 'pedido:editar'(interaction) {
    const { ticket, error } = comprobarTicket(interaction);
    if (error) return interaction.reply(efimero(error));

    const aviso = puedeEditarPedido(interaction, ticket);
    if (aviso) return interaction.reply(efimero(aviso));

    return interaction.showModal(modales.modalEditarPedido(pedidos.getPedido(interaction.channelId)));
  },

  async 'pedido:limpiar'(interaction) {
    const { ticket, error } = comprobarTicket(interaction);
    if (error) return interaction.reply(efimero(error));

    const aviso = puedeEditarPedido(interaction, ticket);
    if (aviso) return interaction.reply(efimero(aviso));

    pedidos.limpiarPedido(interaction.channelId);
    await pedidos.refrescarMensajePedido(interaction.channel);
    return interaction.reply(efimero('🗑️ Pedido vaciado.'));
  },

  async 'pedido:confirmar'(interaction) {
    const { ticket, error } = comprobarTicket(interaction, { requiereStaff: true });
    if (error) return interaction.reply(efimero(error));

    const pedido = pedidos.getPedido(interaction.channelId);
    if (pedidos.totalCuentas(pedido) === 0) {
      return interaction.reply(efimero('❌ El pedido esta vacio, no hay nada que confirmar.'));
    }

    store.setTicket(interaction.channelId, { pedidoConfirmado: true, confirmadoPor: interaction.user.id });
    await pedidos.refrescarMensajePedido(interaction.channel);

    await tickets.log(interaction.guild, {
      titulo: `✅ Pedido confirmado · Ticket #${ticket.numero}`,
      color: config.colores.exito,
      campos: [
        { name: 'Cliente', value: `<@${ticket.usuarioId}>`, inline: true },
        { name: 'Confirmado por', value: `${interaction.user}`, inline: true },
        { name: 'Pedido', value: pedidos.resumenCorto(pedido) },
        { name: 'Total', value: pedidos.formatearPrecio(pedidos.totalPrecio(pedido)), inline: true },
      ],
    });

    return interaction.reply(
      `✅ Pedido confirmado por ${interaction.user}: **${pedidos.resumenCorto(pedido)}** · **${pedidos.formatearPrecio(pedidos.totalPrecio(pedido))}**`,
    );
  },

  async 'pedido:reabrir'(interaction) {
    const { error } = comprobarTicket(interaction, { requiereStaff: true });
    if (error) return interaction.reply(efimero(error));

    store.setTicket(interaction.channelId, { pedidoConfirmado: false });
    await pedidos.refrescarMensajePedido(interaction.channel);
    return interaction.reply(efimero('✏️ Pedido reabierto, ya se puede editar.'));
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
    if (res.error) {
      return interaction.editReply({ content: `❌ ${res.error}` });
    }
    return interaction.editReply({ content: '✅ Ticket cerrado.' });
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
