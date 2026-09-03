'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

const config = require('../config');
const store = require('../lib/store');
const cuentas = require('../lib/cuentas');
const { esAdmin, AVISO_SOLO_ADMIN } = require('../lib/permisos');

// Las opciones de nivel salen de config.json: si añades o quitas niveles, el
// comando se adapta solo.
const opcionesNivel = config.niveles.map((n) => ({ name: n.nombre, value: n.id }));

function opcionNivel(o) {
  return o.setName('nivel').setDescription('Nivel de la cuenta').setRequired(true).addChoices(...opcionesNivel);
}

function opcionUsuario(o) {
  return o
    .setName('usuario')
    .setDescription('De quien son las cuentas (por defecto, quien abrio este ticket)')
    .setRequired(false);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cuentas')
    .setDescription('Registro privado de las cuentas que posee un usuario')
    // Discord esconde el comando a quien no sea administrador; el bot lo
    // vuelve a comprobar por su cuenta antes de responder.
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName('ver')
        .setDescription('Abre el panel privado de cuentas')
        .addUserOption(opcionUsuario))
    .addSubcommand((s) =>
      s
        .setName('añadir')
        .setDescription('Suma cuentas de un nivel')
        .addStringOption(opcionNivel)
        .addIntegerOption((o) =>
          o
            .setName('cantidad')
            .setDescription('Cuantas cuentas sumar')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(cuentas.MAX_POR_NIVEL))
        .addUserOption(opcionUsuario))
    .addSubcommand((s) =>
      s
        .setName('quitar')
        .setDescription('Resta cuentas de un nivel')
        .addStringOption(opcionNivel)
        .addIntegerOption((o) =>
          o
            .setName('cantidad')
            .setDescription('Cuantas cuentas restar')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(cuentas.MAX_POR_NIVEL))
        .addUserOption(opcionUsuario))
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
            .setMaxValue(cuentas.MAX_POR_NIVEL))
        .addUserOption(opcionUsuario))
    .addSubcommand((s) =>
      s
        .setName('vaciar')
        .setDescription('Pone todos los niveles a cero')
        .addUserOption(opcionUsuario)),

  async execute(interaction) {
    if (!esAdmin(interaction.member)) {
      return interaction.reply({ content: AVISO_SOLO_ADMIN, flags: MessageFlags.Ephemeral });
    }

    // Si no dicen usuario, se usa el del ticket donde se escribe el comando.
    const indicado = interaction.options.getUser('usuario');
    const ticket = store.getTicket(interaction.channelId);
    const usuarioId = indicado?.id || ticket?.usuarioId;

    if (!usuarioId) {
      return interaction.reply({
        content: '❌ Fuera de un ticket tienes que decirme de quien son las cuentas: `/cuentas ver usuario:@alguien`.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    let aviso;

    if (sub === 'vaciar') {
      cuentas.limpiarCuentas(guildId, usuarioId);
      aviso = '🗑️ Registro vaciado.';
    } else if (sub !== 'ver') {
      const nivel = config.nivelPorId(interaction.options.getString('nivel'));
      if (!nivel) {
        return interaction.reply({ content: '❌ Ese nivel ya no existe.', flags: MessageFlags.Ephemeral });
      }

      const cantidad = interaction.options.getInteger('cantidad');
      let registro;

      if (sub === 'poner') {
        registro = cuentas.setCuentas(guildId, usuarioId, {
          ...cuentas.getCuentas(guildId, usuarioId),
          [nivel.id]: cantidad,
        });
      } else {
        registro = cuentas.sumarNivel(guildId, usuarioId, nivel.id, sub === 'quitar' ? -cantidad : cantidad);
      }

      aviso = `✅ ${nivel.nombre}: \`${registro[nivel.id]}\` cuenta(s) en total.`;
    }

    if (aviso) await cuentas.refrescarFicha(interaction.guild, usuarioId);

    // Efimero siempre: nadie mas del canal ve estos datos.
    return interaction.reply({
      ...cuentas.vistaPanel(guildId, usuarioId),
      content: aviso || null,
      flags: MessageFlags.Ephemeral,
    });
  },
};
