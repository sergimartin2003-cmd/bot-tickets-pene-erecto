'use strict';

const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');

const config = require('../config');
const pedidos = require('./pedidos');

function embedPanel({ titulo, descripcion } = {}) {
  const listaNiveles = config.niveles
    .map((n) => `${n.emoji || '•'} **${n.nombre}** — ${pedidos.formatearPrecio(n.precio)} por cuenta`)
    .join('\n');

  return new EmbedBuilder()
    .setTitle(titulo || '🎫 Sistema de tickets')
    .setColor(config.colores.principal)
    .setDescription(
      descripcion ||
        'Elige abajo el tipo de ticket que necesitas y se creara un canal privado para ti.\n' +
          'Dentro del ticket de compra podras apuntar cuantas cuentas quieres de cada nivel.',
    )
    .addFields({ name: 'Niveles disponibles', value: listaNiveles })
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
