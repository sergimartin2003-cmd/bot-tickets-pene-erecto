'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const config = require('../config');
const store = require('../lib/store');
const cuentas = require('../lib/cuentas');
const tickets = require('../lib/tickets');
const panel = require('../lib/panel');
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

/**
 * Enruta por prefijo: los customId llevan datos detras (id del tipo, id del
 * usuario...), asi que no basta con comparar la cadena entera.
 */
async function manejar(interaction) {
  const [grupo, accion, ...resto] = interaction.customId.split(':');

  if (grupo === 'ticket' && accion === 'abrir') {
    return abrirTicket(interaction, resto[0]);
  }
  if (grupo === 'ticket') return accionesTicket(interaction, accion, resto);
  if (grupo === 'panel') return gestionPanel(interaction, accion, resto);
  if (grupo === 'cuentas') return accionesCuentas(interaction, accion, resto);

  return false;
}

// --- Panel publico: abrir ticket ---

async function abrirTicket(interaction, tipoId) {
  const tipo = store.getTipo(interaction.guildId, tipoId);
  if (!tipo) {
    await interaction.reply(efimero('❌ Ese boton ya no existe. Avisa a un administrador.'));
    return true;
  }
  await interaction.showModal(modales.modalAbrirTicket(tipo));
  return true;
}

// --- Menu de gestion de paneles (solo admins) ---

async function gestionPanel(interaction, accion, resto) {
  if (!esAdmin(interaction.member)) {
    await interaction.reply(efimero('❌ Solo los administradores pueden gestionar los paneles.'));
    return true;
  }

  const destinoId = resto[0] || null;

  if (accion === 'crear') {
    if (store.getTipos(interaction.guildId).length >= config.MAX_TIPOS) {
      await interaction.reply(efimero(`❌ Ya tienes el maximo de ${config.MAX_TIPOS} botones.`));
      return true;
    }
    await interaction.showModal(modales.modalCrearTipo());
    return true;
  }

  if (accion === 'refrescar') {
    await interaction.update(panel.vistaGestion(interaction.guildId, { destinoId }));
    return true;
  }

  if (accion === 'publicar') {
    await interaction.showModal(modales.modalPublicarPanel(destinoId));
    return true;
  }

  return false;
}

// --- Acciones del ticket ---

async function accionesTicket(interaction, accion, resto) {
  if (accion === 'cerrar' && resto[0] !== 'si') {
    const { ticket, error } = comprobarTicket(interaction);
    if (error) {
      await interaction.reply(efimero(error));
      return true;
    }

    if (ticket.usuarioId !== interaction.user.id && !tickets.esStaff(interaction.member)) {
      await interaction.reply(efimero('❌ Solo quien abrio el ticket o el staff pueden cerrarlo.'));
      return true;
    }

    await interaction.reply({
      content: '¿Seguro que quieres cerrar el ticket?',
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket:cerrar:si')
            .setLabel('Si, cerrar')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger),
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (accion === 'cerrar' && resto[0] === 'si') {
    const { ticket, error } = comprobarTicket(interaction);
    if (error) {
      await interaction.reply(efimero(error));
      return true;
    }

    if (ticket.usuarioId !== interaction.user.id && !tickets.esStaff(interaction.member)) {
      await interaction.reply(efimero('❌ Solo quien abrio el ticket o el staff pueden cerrarlo.'));
      return true;
    }

    await interaction.update({ content: '🔒 Cerrando el ticket...', components: [] });
    const res = await tickets.cerrarTicket(interaction.channel, interaction.user, null);
    await interaction.editReply({ content: res.error ? `❌ ${res.error}` : '✅ Ticket cerrado.' });
    return true;
  }

  if (accion === 'reabrir') {
    const { error } = comprobarTicket(interaction, { requiereAbierto: false, requiereStaff: true });
    if (error) {
      await interaction.reply(efimero(error));
      return true;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const res = await tickets.reabrirTicket(interaction.channel, interaction.user);
    await interaction.editReply(res.error ? `❌ ${res.error}` : '✅ Ticket reabierto.');
    return true;
  }

  if (accion === 'reclamar') {
    const { ticket, error } = comprobarTicket(interaction, { requiereStaff: true });
    if (error) {
      await interaction.reply(efimero(error));
      return true;
    }

    if (ticket.reclamadoPor) {
      await interaction.reply(efimero(`❌ Ya lo reclamo <@${ticket.reclamadoPor}>.`));
      return true;
    }

    store.setTicket(interaction.channelId, { reclamadoPor: interaction.user.id });
    await interaction.reply(`🙋 ${interaction.user} atiende este ticket.`);
    return true;
  }

  if (accion === 'transcript') {
    const { error } = comprobarTicket(interaction, { requiereAbierto: false, requiereStaff: true });
    if (error) {
      await interaction.reply(efimero(error));
      return true;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const fichero = await tickets.generarTranscripcion(interaction.channel);
    await interaction.editReply(
      fichero
        ? { content: '📄 Aqui tienes la transcripcion:', files: [fichero] }
        : '❌ No he podido generar la transcripcion.',
    );
    return true;
  }

  if (accion === 'borrar') {
    const { ticket, error } = comprobarTicket(interaction, { requiereAbierto: false, requiereStaff: true });
    if (error) {
      await interaction.reply(efimero(error));
      return true;
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder().setColor(config.colores.peligro).setDescription('⛔ Borrando el canal en 5 segundos...'),
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

    return true;
  }

  return false;
}

// --- Registro privado de cuentas (solo owner y admins) ---

async function accionesCuentas(interaction, accion, resto) {
  if (!esAdmin(interaction.member)) {
    await interaction.reply(efimero(AVISO_SOLO_ADMIN));
    return true;
  }

  const usuarioId = resto[0];
  if (!usuarioId) {
    await interaction.reply(efimero('❌ No se de que usuario son estas cuentas. Vuelve a abrir el panel.'));
    return true;
  }

  if (accion === 'editar') {
    await interaction.showModal(
      modales.modalEditarCuentas(usuarioId, cuentas.getCuentas(interaction.guildId, usuarioId)),
    );
    return true;
  }

  if (accion === 'vaciar') {
    cuentas.limpiarCuentas(interaction.guildId, usuarioId);
    await cuentas.refrescarFicha(interaction.guild, usuarioId);
    await interaction.update(cuentas.vistaPanel(interaction.guildId, usuarioId));
    return true;
  }

  if (accion === 'refrescar') {
    await interaction.update(cuentas.vistaPanel(interaction.guildId, usuarioId));
    return true;
  }

  return false;
}

module.exports = { manejar };
