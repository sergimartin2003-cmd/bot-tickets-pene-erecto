'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');

const config = require('../config');
const store = require('../lib/store');
const pedidos = require('../lib/pedidos');
const tickets = require('../lib/tickets');

// Las opciones de nivel salen de config.json, asi que el comando se adapta
// solo si añades o quitas niveles.
const opcionesNivel = config.niveles.map((n) => ({ name: n.nombre, value: n.id }));

function opcionNivel(o) {
  return o.setName('nivel').setDescription('Nivel de la cuenta').setRequired(true).addChoices(...opcionesNivel);
}

function opcionCantidad(o, descripcion) {
  return o
    .setName('cantidad')
    .setDescription(descripcion)
    .setRequired(true)
    .setMinValue(1)
    .setMaxValue(pedidos.MAX_POR_NIVEL);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cuentas')
    .setDescription('Gestiona las cuentas por nivel de este ticket')
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName('añadir')
        .setDescription('Suma cuentas de un nivel al pedido')
        .addStringOption(opcionNivel)
        .addIntegerOption((o) => opcionCantidad(o, 'Cuantas cuentas sumar')))
    .addSubcommand((s) =>
      s
        .setName('quitar')
        .setDescription('Resta cuentas de un nivel del pedido')
        .addStringOption(opcionNivel)
        .addIntegerOption((o) => opcionCantidad(o, 'Cuantas cuentas restar')))
    .addSubcommand((s) =>
      s
        .setName('poner')
        .setDescription('Fija la cantidad exacta de un nivel')
        .addStringOption(opcionNivel)
        .addIntegerOption((o) =>
          o
            .setName('cantidad')
            .setDescription('Cantidad exacta (0 para dejarlo a cero)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(pedidos.MAX_POR_NIVEL)))
    .addSubcommand((s) => s.setName('ver').setDescription('Muestra el pedido actual'))
    .addSubcommand((s) => s.setName('vaciar').setDescription('Pone todos los niveles a cero')),

  async execute(interaction) {
    const canal = interaction.channel;
    const ticket = store.getTicket(canal.id);

    if (!ticket) {
      return interaction.reply({
        content: '❌ Este comando solo funciona dentro de un ticket.',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (ticket.cerrado) {
      return interaction.reply({
        content: '❌ Este ticket esta cerrado. Reabrelo para tocar el pedido.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'ver') {
      return interaction.reply({
        embeds: [pedidos.embedPedido(pedidos.getPedido(canal.id), { confirmado: ticket.pedidoConfirmado })],
        flags: MessageFlags.Ephemeral,
      });
    }

    // A partir de aqui se modifica el pedido: solo el autor o el staff.
    const esAutor = ticket.usuarioId === interaction.user.id;
    if (!esAutor && !tickets.esStaff(interaction.member)) {
      return interaction.reply({
        content: '❌ Solo el autor del ticket o el staff pueden modificar el pedido.',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (ticket.pedidoConfirmado && !tickets.esStaff(interaction.member)) {
      return interaction.reply({
        content: '🔒 El pedido ya esta confirmado por el staff. Pideles que lo reabran si quieres cambiarlo.',
        flags: MessageFlags.Ephemeral,
      });
    }

    let resultado;
    let mensaje;

    if (sub === 'vaciar') {
      resultado = pedidos.limpiarPedido(canal.id);
      mensaje = '🗑️ Pedido vaciado.';
    } else {
      const nivelId = interaction.options.getString('nivel');
      const cantidad = interaction.options.getInteger('cantidad');
      const nivel = config.nivelPorId(nivelId);

      if (!nivel) {
        return interaction.reply({ content: '❌ Ese nivel ya no existe.', flags: MessageFlags.Ephemeral });
      }

      if (sub === 'poner') {
        const pedido = pedidos.getPedido(canal.id);
        pedido[nivel.id] = cantidad;
        resultado = pedidos.setPedido(canal.id, pedido);
        mensaje = `✅ ${nivel.nombre}: \`${resultado[nivel.id]}\` cuenta(s).`;
      } else {
        const delta = sub === 'quitar' ? -cantidad : cantidad;
        resultado = pedidos.sumarNivel(canal.id, nivel.id, delta);
        mensaje = `✅ ${nivel.nombre}: \`${resultado[nivel.id]}\` cuenta(s) en total.`;
      }
    }

    await pedidos.refrescarMensajePedido(canal);

    return interaction.reply({
      content: `${mensaje}\n**Pedido:** ${pedidos.resumenCorto(resultado)} · **${pedidos.formatearPrecio(pedidos.totalPrecio(resultado))}**`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
