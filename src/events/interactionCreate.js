'use strict';

const { Events, MessageFlags } = require('discord.js');

const botones = require('../interactions/botones');
const selects = require('../interactions/selects');
const modales = require('../interactions/modales');

async function responderError(interaction, mensaje) {
  const carga = { content: mensaje, flags: MessageFlags.Ephemeral };
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(carga);
    } else {
      await interaction.reply(carga);
    }
  } catch {
    // La interaccion ha caducado (3 s) o ya se respondio: nada que hacer.
  }
}

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    if (!interaction.inGuild()) {
      if (interaction.isRepliable()) {
        await responderError(interaction, '❌ Este bot solo funciona dentro de un servidor.');
      }
      return;
    }

    try {
      if (interaction.isChatInputCommand()) {
        const comando = interaction.client.commands.get(interaction.commandName);
        if (!comando) {
          await responderError(interaction, '❌ Ese comando ya no existe. Vuelve a registrarlos con `npm run deploy`.');
          return;
        }
        await comando.execute(interaction);
        return;
      }

      if (interaction.isButton()) {
        const atendido = await botones.manejar(interaction);
        if (!atendido) await responderError(interaction, '❌ Este boton ya no esta activo.');
        return;
      }

      if (interaction.isStringSelectMenu()) {
        const atendido = await selects.manejar(interaction);
        if (!atendido) await responderError(interaction, '❌ Este menu ya no esta activo.');
        return;
      }

      if (interaction.isModalSubmit()) {
        const atendido = await modales.manejar(interaction);
        if (!atendido) await responderError(interaction, '❌ Este formulario ya no esta activo.');
      }
    } catch (err) {
      console.error(`[interaccion] fallo en ${interaction.customId || interaction.commandName}:`, err);
      await responderError(interaction, '❌ Algo ha fallado. Avisa a un administrador si sigue pasando.');
    }
  },
};
