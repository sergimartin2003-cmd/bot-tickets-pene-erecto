'use strict';

const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

const config = require('../config');

// El panel es publico: aqui no se menciona nada del registro de cuentas.
function embedPanel({ titulo, descripcion } = {}) {
  const tipos = config.tiposTicket
    .map((t) => `${t.emoji || '•'} **${t.nombre}** — ${t.descripcion || ''}`.trim())
    .join('\n');

  return new EmbedBuilder()
    .setTitle(titulo || '🎫 Sistema de tickets')
    .setColor(config.colores.principal)
    .setDescription(
      descripcion ||
        'Elige abajo el tipo de ticket que necesitas y se creara un canal privado ' +
          'donde solo estaras tu y el staff.',
    )
    .addFields({ name: 'Tipos de ticket', value: tipos })
    .setFooter({ text: 'Abusar del sistema de tickets puede conllevar sancion' });
}

function selectPanel() {
  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket:abrir')
    .setPlaceholder('Selecciona el tipo de ticket...')
    .addOptions(
      config.tiposTicket.map((tipo) => ({
        label: tipo.nombre,
        value: tipo.id,
        description: tipo.descripcion?.slice(0, 100),
        emoji: tipo.emoji || undefined,
      })),
    );

  return new ActionRowBuilder().addComponents(select);
}

module.exports = { embedPanel, selectPanel };
