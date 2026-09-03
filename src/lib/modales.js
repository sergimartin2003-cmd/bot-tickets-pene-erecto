'use strict';

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');

const config = require('../config');
const cuentas = require('./cuentas');

/** Formulario con un campo por nivel: cantidades exactas que posee el usuario. */
function modalEditarCuentas(registroActual) {
  const modal = new ModalBuilder()
    .setCustomId('cuentas:editar:modal')
    .setTitle('Cuentas que posee');

  for (const nivel of config.niveles) {
    const actual = registroActual?.[nivel.id] ?? 0;
    const valor = cuentas.valorNivel(nivel);
    const input = new TextInputBuilder()
      .setCustomId(`nivel:${nivel.id}`)
      .setLabel(`Cuentas de ${nivel.nombre}`.slice(0, 45))
      .setPlaceholder(
        `Ej: 2 (0 = ninguna)${valor > 0 ? ` · ${cuentas.formatearValor(valor)} c/u` : ''}`.slice(0, 100),
      )
      .setValue(String(actual))
      .setStyle(TextInputStyle.Short)
      .setMaxLength(3)
      .setRequired(false);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  return modal;
}

/** Formulario de un solo nivel: cuantas cuentas de ese nivel se suman o restan. */
function modalCantidadNivel(nivel) {
  const input = new TextInputBuilder()
    .setCustomId('cantidad')
    .setLabel(`Cuentas de ${nivel.nombre} a sumar`.slice(0, 45))
    .setPlaceholder('Ej: 2 · usa un numero negativo para restar')
    .setValue('1')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(4)
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId(`cuentas:nivel:modal:${nivel.id}`)
    .setTitle(`Cuentas de ${nivel.nombre}`.slice(0, 45))
    .addComponents(new ActionRowBuilder().addComponents(input));
}

/** Motivo del ticket, se pide al abrirlo desde el panel. */
function modalAbrirTicket(tipo) {
  const input = new TextInputBuilder()
    .setCustomId('motivo')
    .setLabel('Cuentanos brevemente que necesitas')
    .setPlaceholder('Ej: no puedo entrar en mi cuenta desde ayer')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(500)
    .setRequired(false);

  return new ModalBuilder()
    .setCustomId(`ticket:abrir:modal:${tipo.id}`)
    .setTitle(`Ticket · ${tipo.nombre}`.slice(0, 45))
    .addComponents(new ActionRowBuilder().addComponents(input));
}

module.exports = { modalEditarCuentas, modalCantidadNivel, modalAbrirTicket };
