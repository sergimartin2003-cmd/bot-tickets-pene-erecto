'use strict';

const { MessageFlags } = require('discord.js');

const config = require('../config');
const store = require('../lib/store');
const pedidos = require('../lib/pedidos');
const tickets = require('../lib/tickets');

function efimero(contenido) {
  return { content: contenido, flags: MessageFlags.Ephemeral };
}

/** Lee un campo del modal y lo convierte a numero entero (admite vacio). */
function leerNumero(interaction, campoId, { permitirNegativo = false } = {}) {
  const crudo = (interaction.fields.getTextInputValue(campoId) || '').trim().replace(',', '.');
  if (crudo === '') return { valor: 0 };

  const numero = Number(crudo);
  if (!Number.isFinite(numero)) return { error: `\`${crudo}\` no es un numero valido.` };
  if (!permitirNegativo && numero < 0) return { error: 'La cantidad no puede ser negativa.' };

  return { valor: Math.trunc(numero) };
}

async function manejar(interaction) {
  const { customId } = interaction;

  // Abrir ticket desde el panel.
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

    if (res.error) {
      await interaction.editReply(`❌ ${res.error}`);
      return true;
    }

    await interaction.editReply(`✅ Ticket abierto: ${res.canal}`);
    return true;
  }

  // Editar todas las cantidades del pedido de una vez.
  if (customId === 'pedido:editar:modal') {
    const ticket = store.getTicket(interaction.channelId);
    if (!ticket || ticket.cerrado) {
      await interaction.reply(efimero('❌ Este ticket no esta abierto.'));
      return true;
    }

    const pedido = pedidos.getPedido(interaction.channelId);
    const errores = [];

    for (const nivel of config.niveles) {
      const { valor, error } = leerNumero(interaction, `nivel:${nivel.id}`);
      if (error) {
        errores.push(`**${nivel.nombre}**: ${error}`);
        continue;
      }
      pedido[nivel.id] = valor;
    }

    if (errores.length) {
      await interaction.reply(efimero(`❌ No he guardado nada:\n${errores.join('\n')}`));
      return true;
    }

    const guardado = pedidos.setPedido(interaction.channelId, pedido);
    await pedidos.refrescarMensajePedido(interaction.channel);

    await interaction.reply(
      efimero(
        `✅ Pedido actualizado: **${pedidos.resumenCorto(guardado)}** · **${pedidos.formatearPrecio(pedidos.totalPrecio(guardado))}**`,
      ),
    );
    return true;
  }

  // Sumar cuentas de un nivel concreto.
  if (customId.startsWith('pedido:nivel:modal:')) {
    const nivel = config.nivelPorId(customId.split(':')[3]);
    if (!nivel) {
      await interaction.reply(efimero('❌ Ese nivel ya no existe.'));
      return true;
    }

    const ticket = store.getTicket(interaction.channelId);
    if (!ticket || ticket.cerrado) {
      await interaction.reply(efimero('❌ Este ticket no esta abierto.'));
      return true;
    }

    const { valor, error } = leerNumero(interaction, 'cantidad', { permitirNegativo: true });
    if (error) {
      await interaction.reply(efimero(`❌ ${error}`));
      return true;
    }

    const guardado = pedidos.sumarNivel(interaction.channelId, nivel.id, valor);
    await pedidos.refrescarMensajePedido(interaction.channel);

    await interaction.reply(
      efimero(
        `✅ ${nivel.nombre}: \`${guardado[nivel.id]}\` cuenta(s).\n**Pedido:** ${pedidos.resumenCorto(guardado)} · **${pedidos.formatearPrecio(pedidos.totalPrecio(guardado))}**`,
      ),
    );
    return true;
  }

  return false;
}

module.exports = { manejar };
