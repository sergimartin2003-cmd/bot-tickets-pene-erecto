'use strict';

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');

const config = require('../config');

function campo(id, label, opciones = {}) {
  const input = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label.slice(0, 45))
    .setStyle(opciones.parrafo ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setRequired(Boolean(opciones.obligatorio));

  if (opciones.placeholder) input.setPlaceholder(opciones.placeholder.slice(0, 100));
  if (opciones.valor !== undefined && opciones.valor !== null) input.setValue(String(opciones.valor));
  if (opciones.max) input.setMaxLength(opciones.max);

  return new ActionRowBuilder().addComponents(input);
}

/** Crear un boton del panel. */
function modalCrearTipo() {
  return new ModalBuilder()
    .setCustomId('panel:crear:modal')
    .setTitle('Nuevo boton del panel')
    .addComponents(
      campo('nombre', 'Nombre del boton', {
        placeholder: 'Ej: Dudas',
        obligatorio: true,
        max: 80,
      }),
      campo('emoji', 'Emoji (opcional)', { placeholder: 'Ej: ❓', max: 32 }),
      campo('descripcion', 'Descripcion corta (opcional)', {
        placeholder: 'Ej: Preguntas generales',
        max: 100,
      }),
      campo('mensaje', 'Mensaje al abrir el ticket (opcional)', {
        placeholder: 'Ej: Escribe tu duda y te responderemos',
        parrafo: true,
        max: 500,
      }),
      campo('color', 'Color: azul, gris, verde o rojo (opcional)', { placeholder: 'azul', max: 10 }),
    );
}

/** Titulo y texto del panel antes de publicarlo. */
function modalPublicarPanel(destinoId) {
  return new ModalBuilder()
    .setCustomId(`panel:publicar:modal:${destinoId || 'aqui'}`)
    .setTitle('Publicar panel')
    .addComponents(
      campo('titulo', 'Titulo (opcional)', { placeholder: '🎫 Abrir un ticket', max: 200 }),
      campo('descripcion', 'Texto del panel (opcional)', {
        placeholder: 'Pulsa el boton que encaje con lo que necesitas',
        parrafo: true,
        max: 1000,
      }),
    );
}

/** Motivo del ticket, se pide al pulsar un boton del panel. */
function modalAbrirTicket(tipo) {
  return new ModalBuilder()
    .setCustomId(`ticket:abrir:modal:${tipo.id}`)
    .setTitle(`Ticket · ${tipo.nombre}`.slice(0, 45))
    .addComponents(
      campo('motivo', 'Cuentanos brevemente que necesitas', {
        placeholder: 'Puedes dejarlo vacio y explicarlo dentro del ticket',
        parrafo: true,
        max: 500,
      }),
    );
}

/** Cantidades exactas por nivel. */
function modalEditarCuentas(usuarioId, registroActual) {
  const modal = new ModalBuilder()
    .setCustomId(`cuentas:editar:modal:${usuarioId}`)
    .setTitle('Cuentas que posee');

  for (const nivel of config.niveles) {
    modal.addComponents(
      campo(`nivel:${nivel.id}`, `Cuentas de ${nivel.nombre}`, {
        placeholder: 'Ej: 2 (0 = ninguna)',
        valor: registroActual?.[nivel.id] ?? 0,
        max: 3,
      }),
    );
  }

  return modal;
}

/** Sumar o restar cuentas de un nivel. */
function modalCantidadNivel(usuarioId, nivel) {
  return new ModalBuilder()
    .setCustomId(`cuentas:nivel:modal:${usuarioId}:${nivel.id}`)
    .setTitle(`Cuentas de ${nivel.nombre}`.slice(0, 45))
    .addComponents(
      campo('cantidad', `Cuentas de ${nivel.nombre} a sumar`, {
        placeholder: 'Ej: 2 · usa un numero negativo para restar',
        valor: '1',
        obligatorio: true,
        max: 4,
      }),
    );
}

module.exports = {
  modalCrearTipo,
  modalPublicarPanel,
  modalAbrirTicket,
  modalEditarCuentas,
  modalCantidadNivel,
};
