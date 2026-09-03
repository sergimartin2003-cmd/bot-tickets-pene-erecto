'use strict';

const { MessageFlags } = require('discord.js');

const config = require('../config');
const store = require('../lib/store');
const panel = require('../lib/panel');
const modales = require('../lib/modales');
const { esAdmin, AVISO_SOLO_ADMIN } = require('../lib/permisos');

async function manejar(interaction) {
  const [grupo, accion, ...resto] = interaction.customId.split(':');

  // Menu de gestion: borrar un boton del panel.
  if (grupo === 'panel' && accion === 'borrar') {
    if (!esAdmin(interaction.member)) {
      await interaction.reply({
        content: '❌ Solo los administradores pueden gestionar los paneles.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const tipoId = interaction.values[0];
    const tipos = store.getTipos(interaction.guildId);
    const tipo = tipos.find((t) => t.id === tipoId);

    if (!tipo) {
      await interaction.update(
        panel.vistaGestion(interaction.guildId, { aviso: '❌ Ese boton ya no existe.', destinoId: resto[0] }),
      );
      return true;
    }

    store.setTipos(
      interaction.guildId,
      tipos.filter((t) => t.id !== tipoId),
    );

    await interaction.update(
      panel.vistaGestion(interaction.guildId, {
        aviso: `🗑️ Boton **${tipo.nombre}** borrado. Los paneles ya publicados hay que volver a publicarlos.`,
        destinoId: resto[0],
      }),
    );
    return true;
  }

  // Panel privado de cuentas: elegir nivel para sumar o restar.
  if (grupo === 'cuentas' && accion === 'nivel') {
    if (!esAdmin(interaction.member)) {
      await interaction.reply({ content: AVISO_SOLO_ADMIN, flags: MessageFlags.Ephemeral });
      return true;
    }

    const usuarioId = resto[0];
    const nivel = config.nivelPorId(interaction.values[0]);

    if (!usuarioId || !nivel) {
      await interaction.reply({
        content: '❌ No he podido identificar el nivel o el usuario. Vuelve a abrir el panel.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    await interaction.showModal(modales.modalCantidadNivel(usuarioId, nivel));
    return true;
  }

  return false;
}

module.exports = { manejar };
