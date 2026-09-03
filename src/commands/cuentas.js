'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

const config = require('../config');
const store = require('../lib/store');
const cuentas = require('../lib/cuentas');
const { esAdmin, AVISO_SOLO_ADMIN } = require('../lib/permisos');

// Las opciones de nivel salen de config.json, asi que el comando se adapta
// solo si añades o quitas niveles.
const opcionesNivel = config.niveles.map((n) => ({ name: n.nombre, value: n.id }));

function opcionNivel(o) {
  return o.setName('nivel').setDescription('Nivel de la cuenta').setRequired(true).addChoices(...opcionesNivel);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cuentas')
    .setDescription('Registro privado de las cuentas que posee el usuario del ticket')
    // Discord esconde el comando a quien no sea administrador; el bot lo
    // vuelve a comprobar por su cuenta antes de responder.
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((s) => s.setName('ver').setDescription('Abre el panel privado de cuentas de este ticket'))
    .addSubcommand((s) =>
      s
        .setName('poner')
        .setDescription('Fija cuantas cuentas de un nivel posee')
        .addStringOption(opcionNivel)
        .addIntegerOption((o) =>
          o
            .setName('cantidad')
            .setDescription('Cantidad exacta (0 para dejarlo a cero)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(cuentas.MAX_POR_NIVEL)))
    .addSubcommand((s) =>
      s
        .setName('añadir')
        .setDescription('Suma cuentas de un nivel al registro')
        .addStringOption(opcionNivel)
        .addIntegerOption((o) =>
          o
            .setName('cantidad')
            .setDescription('Cuantas cuentas sumar')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(cuentas.MAX_POR_NIVEL)))
    .addSubcommand((s) =>
      s
        .setName('quitar')
        .setDescription('Resta cuentas de un nivel del registro')
        .addStringOption(opcionNivel)
        .addIntegerOption((o) =>
          o
            .setName('cantidad')
            .setDescription('Cuantas cuentas restar')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(cuentas.MAX_POR_NIVEL)))
    .addSubcommand((s) => s.setName('vaciar').setDescription('Pone todos los niveles a cero')),

  async execute(interaction) {
    if (!esAdmin(interaction.member)) {
      return interaction.reply({ content: AVISO_SOLO_ADMIN, flags: MessageFlags.Ephemeral });
    }

    const canalId = interaction.channelId;
    if (!store.getTicket(canalId)) {
      return interaction.reply({
        content: '❌ Este comando solo funciona dentro de un ticket.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const sub = interaction.options.getSubcommand();

    // Toda la respuesta es efimera: nadie mas del canal ve estos datos.
    if (sub === 'ver') {
      return interaction.reply({ ...cuentas.vistaPanel(canalId), flags: MessageFlags.Ephemeral });
    }

    let aviso;

    if (sub === 'vaciar') {
      cuentas.limpiarCuentas(canalId);
      aviso = '🗑️ Registro vaciado.';
    } else {
      const nivel = config.nivelPorId(interaction.options.getString('nivel'));
      if (!nivel) {
        return interaction.reply({ content: '❌ Ese nivel ya no existe.', flags: MessageFlags.Ephemeral });
      }

      const cantidad = interaction.options.getInteger('cantidad');
      let registro;

      if (sub === 'poner') {
        registro = cuentas.setCuentas(canalId, { ...cuentas.getCuentas(canalId), [nivel.id]: cantidad });
      } else {
        registro = cuentas.sumarNivel(canalId, nivel.id, sub === 'quitar' ? -cantidad : cantidad);
      }

      aviso = `✅ ${nivel.nombre}: \`${registro[nivel.id]}\` cuenta(s) en total.`;
    }

    await cuentas.refrescarRegistro(interaction.guild, canalId);

    return interaction.reply({
      ...cuentas.vistaPanel(canalId),
      content: aviso,
      flags: MessageFlags.Ephemeral,
    });
  },
};
