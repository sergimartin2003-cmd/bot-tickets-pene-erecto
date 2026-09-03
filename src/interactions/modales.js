'use strict';

const { MessageFlags } = require('discord.js');

const config = require('../config');
const store = require('../lib/store');
const cuentas = require('../lib/cuentas');
const tickets = require('../lib/tickets');
const { esAdmin, AVISO_SOLO_ADMIN } = require('../lib/permisos');

function efimero(contenido) {
  return { content: contenido, flags: MessageFlags.Ephemeral };
}

/** Lee un campo del formulario y lo convierte a numero entero (admite vacio). */
function leerNumero(interaction, campoId, { permitirNegativo = false } = {}) {
  const crudo = (interaction.fields.getTextInputValue(campoId) || '').trim().replace(',', '.');
  if (crudo === '') return { valor: 0 };

  const numero = Number(crudo);
  if (!Number.isFinite(numero)) return { error: `\`${crudo}\` no es un numero valido.` };
  if (!permitirNegativo && numero < 0) return { error: 'La cantidad no puede ser negativa.' };

  return { valor: Math.trunc(numero) };
}

/**
 * Tras guardar, repinta el panel privado. Si el formulario se abrio desde el
 * propio panel efimero, lo actualiza en su sitio; si no, responde con uno nuevo.
 */
async function responderConPanel(interaction, aviso) {
  const vista = cuentas.vistaPanel(interaction.channelId);
  if (interaction.isFromMessage()) {
    return interaction.update({ ...vista, content: aviso });
  }
  return interaction.reply({ ...vista, content: aviso, flags: MessageFlags.Ephemeral });
}

async function manejar(interaction) {
  const { customId } = interaction;

  // Abrir ticket desde el panel publico.
  if (customId.startsWith('ticket:abrir:modal:')) {
    const tipo = tickets.tipoPorId(customId.split(':')[3]);
    if (!tipo) {
      await interaction.reply(efimero('❌ Ese tipo de ticket ya no existe.'));
      return true;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const motivo = interaction.fields.getTextInputValue('motivo')?.trim() || null;
    const res = await tickets.crearTicket({
      guild: interaction.guild,
      miembro: interaction.member,
      tipo,
      motivo,
    });

    await interaction.editReply(res.error ? `❌ ${res.error}` : `✅ Ticket abierto: ${res.canal}`);
    return true;
  }

  // A partir de aqui todo es registro de cuentas: solo owner y admins.
  if (customId === 'cuentas:editar:modal' || customId.startsWith('cuentas:nivel:modal:')) {
    if (!esAdmin(interaction.member)) {
      await interaction.reply(efimero(AVISO_SOLO_ADMIN));
      return true;
    }
    if (!store.getTicket(interaction.channelId)) {
      await interaction.reply(efimero('❌ Este canal ya no consta como ticket.'));
      return true;
    }
  }

  // Editar todas las cantidades de una vez.
  if (customId === 'cuentas:editar:modal') {
    const registro = cuentas.getCuentas(interaction.channelId);
    const errores = [];

    for (const nivel of config.niveles) {
      const { valor, error } = leerNumero(interaction, `nivel:${nivel.id}`);
      if (error) {
        errores.push(`**${nivel.nombre}**: ${error}`);
        continue;
      }
      registro[nivel.id] = valor;
    }

    if (errores.length) {
      await interaction.reply(efimero(`❌ No he guardado nada:\n${errores.join('\n')}`));
      return true;
    }

    const guardado = cuentas.setCuentas(interaction.channelId, registro);
    await cuentas.refrescarRegistro(interaction.guild, interaction.channelId);
    await responderConPanel(interaction, `✅ Guardado: **${cuentas.resumenCorto(guardado)}**`);
    return true;
  }

  // Sumar o restar cuentas de un nivel concreto.
  if (customId.startsWith('cuentas:nivel:modal:')) {
    const nivel = config.nivelPorId(customId.split(':')[3]);
    if (!nivel) {
      await interaction.reply(efimero('❌ Ese nivel ya no existe.'));
      return true;
    }

    const { valor, error } = leerNumero(interaction, 'cantidad', { permitirNegativo: true });
    if (error) {
      await interaction.reply(efimero(`❌ ${error}`));
      return true;
    }

    const guardado = cuentas.sumarNivel(interaction.channelId, nivel.id, valor);
    await cuentas.refrescarRegistro(interaction.guild, interaction.channelId);
    await responderConPanel(
      interaction,
      `✅ ${nivel.nombre}: \`${guardado[nivel.id]}\` cuenta(s) en total.`,
    );
    return true;
  }

  return false;
}

module.exports = { manejar };
