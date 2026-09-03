'use strict';

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');

const config = require('../config');
const store = require('./store');

const ESTILOS = {
  azul: ButtonStyle.Primary,
  gris: ButtonStyle.Secondary,
  verde: ButtonStyle.Success,
  rojo: ButtonStyle.Danger,
};

function estiloDe(color) {
  return ESTILOS[String(color || '').toLowerCase()] || ButtonStyle.Primary;
}

/** Convierte un nombre en un id valido y unico dentro del servidor. */
function idDesdeNombre(guildId, nombre) {
  const base =
    nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 20) || 'ticket';

  const usados = new Set(store.getTipos(guildId).map((t) => t.id));
  if (!usados.has(base)) return base;

  for (let i = 2; i < 100; i += 1) {
    if (!usados.has(`${base}-${i}`)) return `${base}-${i}`;
  }
  return `${base}-${Date.now().toString().slice(-4)}`;
}

/**
 * Añade el emoji solo si Discord lo acepta: si el usuario escribe cualquier
 * cosa en ese campo, el boton se crea igual pero sin emoji.
 */
function conEmoji(boton, emoji) {
  if (!emoji) return boton;
  try {
    return boton.setEmoji(emoji);
  } catch {
    return boton;
  }
}

// --- Panel publico ---

function embedPanel(guildId, { titulo, descripcion } = {}) {
  const tipos = store.getTipos(guildId);
  const lista = tipos.length
    ? tipos.map((t) => `${t.emoji || '•'} **${t.nombre}**${t.descripcion ? ` — ${t.descripcion}` : ''}`).join('\n')
    : '_Todavia no hay botones. Crealos con `/panel`._';

  return new EmbedBuilder()
    .setTitle(titulo || '🎫 Abrir un ticket')
    .setColor(config.colores.principal)
    .setDescription(
      descripcion ||
        'Pulsa el boton que encaje con lo que necesitas. Se creara un canal ' +
          'privado que solo veras tu y el staff.',
    )
    .addFields({ name: 'Opciones', value: lista })
    .setFooter({ text: 'Abusar del sistema de tickets puede conllevar sancion' });
}

/** Un boton por tipo, 5 por fila. */
function botonesPanel(guildId) {
  const tipos = store.getTipos(guildId);
  const filas = [];

  for (let i = 0; i < tipos.length; i += 5) {
    const fila = new ActionRowBuilder().addComponents(
      tipos.slice(i, i + 5).map((tipo) =>
        conEmoji(
          new ButtonBuilder()
            .setCustomId(`ticket:abrir:${tipo.id}`)
            .setLabel(tipo.nombre.slice(0, 80))
            .setStyle(estiloDe(tipo.color)),
          tipo.emoji,
        ),
      ),
    );
    filas.push(fila);
  }

  return filas;
}

function vistaPanelPublico(guildId, opciones) {
  return { embeds: [embedPanel(guildId, opciones)], components: botonesPanel(guildId) };
}

// --- Menu de gestion (efimero, solo admins) ---

function vistaGestion(guildId, { aviso, destinoId } = {}) {
  const tipos = store.getTipos(guildId);

  const lista = tipos.length
    ? tipos
        .map((t, i) => `**${i + 1}.** ${t.emoji || '•'} **${t.nombre}** \`(${t.id})\`${t.descripcion ? `\n   ${t.descripcion}` : ''}`)
        .join('\n')
    : '_Todavia no hay ningun boton. Pulsa **Crear boton** para empezar._';

  const embed = new EmbedBuilder()
    .setTitle('🛠️ Menu de paneles')
    .setColor(config.colores.principal)
    .setDescription(
      'Aqui creas los botones que saldran en el panel (dudas, soporte, lo que quieras).\n' +
        'Cuando los tengas listos, pulsa **Publicar panel** para soltarlo en un canal.',
    )
    .addFields(
      { name: `Botones (${tipos.length}/${config.MAX_TIPOS})`, value: lista.slice(0, 1024) },
      { name: 'Se publicara en', value: destinoId ? `<#${destinoId}>` : 'este canal' },
    )
    .setFooter({ text: 'Solo tu ves este menu' });

  const filas = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('panel:crear')
        .setLabel('Crear boton')
        .setEmoji('➕')
        .setStyle(ButtonStyle.Success)
        .setDisabled(tipos.length >= config.MAX_TIPOS),
      new ButtonBuilder()
        .setCustomId(destinoId ? `panel:publicar:${destinoId}` : 'panel:publicar')
        .setLabel('Publicar panel')
        .setEmoji('📤')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(tipos.length === 0),
      new ButtonBuilder()
        .setCustomId(destinoId ? `panel:refrescar:${destinoId}` : 'panel:refrescar')
        .setLabel('Actualizar')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];

  if (tipos.length) {
    filas.unshift(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('panel:borrar')
          .setPlaceholder('Borrar un boton...')
          .addOptions(
            tipos.map((t) => ({
              label: t.nombre.slice(0, 100),
              value: t.id,
              description: t.descripcion?.slice(0, 100),
              emoji: t.emoji || undefined,
            })),
          ),
      ),
    );
  }

  return { content: aviso || null, embeds: [embed], components: filas };
}

module.exports = {
  ESTILOS,
  estiloDe,
  idDesdeNombre,
  embedPanel,
  botonesPanel,
  vistaPanelPublico,
  vistaGestion,
};
