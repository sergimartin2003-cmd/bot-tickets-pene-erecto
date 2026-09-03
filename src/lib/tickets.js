'use strict';

const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');

const config = require('../config');
const store = require('./store');

const LIMITE_TICKETS_ABIERTOS = 3;

function esStaff(miembro) {
  if (!miembro?.guild) return false;
  if (miembro.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (miembro.guild.ownerId === miembro.id) return true;
  const cfg = store.getGuild(miembro.guild.id);
  return Boolean(cfg.staffRolId && miembro.roles.cache.has(cfg.staffRolId));
}

function botonesTicket({ cerrado = false } = {}) {
  if (cerrado) {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket:reabrir')
          .setLabel('Reabrir')
          .setEmoji('🔓')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('ticket:transcript')
          .setLabel('Transcripcion')
          .setEmoji('📄')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('ticket:borrar')
          .setLabel('Borrar canal')
          .setEmoji('⛔')
          .setStyle(ButtonStyle.Danger),
      ),
    ];
  }

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket:cerrar')
        .setLabel('Cerrar ticket')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('ticket:reclamar')
        .setLabel('Reclamar')
        .setEmoji('🙋')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

/**
 * Crea el canal del ticket. Es privado: @everyone no lo ve, y solo entran quien
 * lo abre, el rol de staff y el bot (los administradores lo ven siempre por su
 * propio permiso de Discord).
 */
async function crearTicket({ guild, miembro, tipo, motivo }) {
  const cfg = store.getGuild(guild.id);

  const abiertos = store.ticketsDe(guild.id, miembro.id);
  if (abiertos.length >= LIMITE_TICKETS_ABIERTOS) {
    const lista = abiertos.map((t) => `<#${t.canalId}>`).join(', ');
    return { error: `Ya tienes ${abiertos.length} tickets abiertos: ${lista}. Cierra alguno antes de abrir otro.` };
  }

  // guild.members.me puede no estar en cache justo despues de arrancar.
  const yo = guild.members.me || (await guild.members.fetchMe().catch(() => null));
  if (!yo) {
    return { error: 'No he podido leer mis propios permisos en el servidor. Reinvitame o reinicia el bot.' };
  }

  const numero = store.siguienteNumero(guild.id);
  const nombre = `${tipo.id}-${String(numero).padStart(4, '0')}`.slice(0, 100);

  const permisos = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: miembro.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    {
      id: yo.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
  ];

  if (cfg.staffRolId && guild.roles.cache.has(cfg.staffRolId)) {
    permisos.push({
      id: cfg.staffRolId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    });
  }

  let canal;
  try {
    canal = await guild.channels.create({
      name: nombre,
      type: ChannelType.GuildText,
      parent: cfg.categoriaId || null,
      topic: `Ticket #${numero} · ${tipo.nombre} · abierto por ${miembro.user.tag} (${miembro.id})`,
      permissionOverwrites: permisos,
      reason: `Ticket abierto por ${miembro.user.tag}`,
    });
  } catch (err) {
    console.error('[tickets] no se ha podido crear el canal:', err.message);
    return {
      error:
        'No he podido crear el canal. Revisa que tengo los permisos **Gestionar canales** y **Gestionar roles**, ' +
        'y que la categoria configurada con `/config categoria` sigue existiendo.',
    };
  }

  store.setTicket(canal.id, {
    guildId: guild.id,
    usuarioId: miembro.id,
    tipoId: tipo.id,
    numero,
    motivo: motivo || null,
    cerrado: false,
    reclamadoPor: null,
    creadoEn: Date.now(),
  });

  // Memoria: queda apuntado en el historial del usuario aunque luego se borre
  // el canal.
  const historial = store.apuntarHistorial(guild.id, miembro.id, {
    numero,
    tipoId: tipo.id,
    tipoNombre: tipo.nombre,
    abiertoEn: Date.now(),
    cerradoEn: null,
  });

  const embed = new EmbedBuilder()
    .setTitle(`${tipo.emoji || '🎫'} Ticket #${numero} · ${tipo.nombre}`)
    .setColor(config.colores.principal)
    .setDescription(tipo.mensaje || 'El staff te atendera en cuanto pueda.')
    .addFields(
      { name: 'Abierto por', value: `${miembro}`, inline: true },
      { name: 'Tickets suyos', value: `\`${historial.length}\` en total`, inline: true },
    )
    .setTimestamp();

  if (motivo) embed.addFields({ name: 'Motivo', value: motivo.slice(0, 1024) });

  const menciones = [`${miembro}`];
  if (cfg.staffRolId) menciones.push(`<@&${cfg.staffRolId}>`);

  await canal.send({
    content: menciones.join(' '),
    embeds: [embed],
    components: botonesTicket(),
  });

  await log(guild, {
    titulo: `🎫 Ticket #${numero} abierto`,
    color: config.colores.principal,
    campos: [
      { name: 'Canal', value: `${canal}`, inline: true },
      { name: 'Usuario', value: `${miembro}`, inline: true },
      { name: 'Tipo', value: tipo.nombre, inline: true },
    ],
  });

  return { canal, numero };
}

async function cerrarTicket(canal, quienCierra, motivo) {
  const ticket = store.getTicket(canal.id);
  if (!ticket) return { error: 'Este canal no es un ticket.' };
  if (ticket.cerrado) return { error: 'Este ticket ya esta cerrado.' };

  const cfg = store.getGuild(canal.guild.id);

  // Quien abrio el ticket deja de verlo; el staff sigue teniendo acceso.
  try {
    await canal.permissionOverwrites.edit(ticket.usuarioId, {
      SendMessages: false,
      ViewChannel: false,
    });
  } catch {
    // El usuario puede haber salido del servidor.
  }

  if (cfg.categoriaCerradosId && canal.parentId !== cfg.categoriaCerradosId) {
    try {
      await canal.setParent(cfg.categoriaCerradosId, { lockPermissions: false });
    } catch (err) {
      console.error('[tickets] no se ha podido mover el canal cerrado:', err.message);
    }
  }

  try {
    await canal.setName(`cerrado-${String(ticket.numero).padStart(4, '0')}`);
  } catch {
    // Rate limit de renombrado (2 cada 10 min): no es critico.
  }

  store.setTicket(canal.id, {
    cerrado: true,
    cerradoPor: quienCierra.id,
    cerradoEn: Date.now(),
    motivoCierre: motivo || null,
  });
  store.cerrarEnHistorial(canal.guild.id, ticket.usuarioId, ticket.numero);

  await canal.send({
    embeds: [
      new EmbedBuilder()
        .setTitle('🔒 Ticket cerrado')
        .setColor(config.colores.peligro)
        .setDescription(`Cerrado por ${quienCierra}${motivo ? `\n**Motivo:** ${motivo}` : ''}`)
        .setTimestamp(),
    ],
    components: botonesTicket({ cerrado: true }),
  });

  const transcripcion = await generarTranscripcion(canal);
  await log(canal.guild, {
    titulo: `🔒 Ticket #${ticket.numero} cerrado`,
    color: config.colores.peligro,
    campos: [
      { name: 'Usuario', value: `<@${ticket.usuarioId}>`, inline: true },
      { name: 'Cerrado por', value: `${quienCierra}`, inline: true },
    ],
    ficheros: transcripcion ? [transcripcion] : [],
  });

  return { ok: true };
}

async function reabrirTicket(canal, quienReabre) {
  const ticket = store.getTicket(canal.id);
  if (!ticket) return { error: 'Este canal no es un ticket.' };
  if (!ticket.cerrado) return { error: 'Este ticket ya esta abierto.' };

  const cfg = store.getGuild(canal.guild.id);

  try {
    await canal.permissionOverwrites.edit(ticket.usuarioId, {
      SendMessages: true,
      ViewChannel: true,
    });
  } catch {
    // El usuario ya no esta en el servidor.
  }

  if (cfg.categoriaId && canal.parentId !== cfg.categoriaId) {
    try {
      await canal.setParent(cfg.categoriaId, { lockPermissions: false });
    } catch (err) {
      console.error('[tickets] no se ha podido mover el canal reabierto:', err.message);
    }
  }

  try {
    await canal.setName(`${ticket.tipoId || 'ticket'}-${String(ticket.numero).padStart(4, '0')}`);
  } catch {
    // Rate limit de renombrado.
  }

  store.setTicket(canal.id, { cerrado: false, cerradoPor: null, cerradoEn: null });

  await canal.send({
    embeds: [
      new EmbedBuilder()
        .setTitle('🔓 Ticket reabierto')
        .setColor(config.colores.exito)
        .setDescription(`Reabierto por ${quienReabre}`)
        .setTimestamp(),
    ],
    components: botonesTicket(),
  });

  return { ok: true };
}

/** Vuelca el historial del canal en un .txt legible. */
async function generarTranscripcion(canal) {
  try {
    const mensajes = [];
    let antesDe;

    // La API devuelve como mucho 100 mensajes por peticion; paginamos hasta 1000.
    for (let i = 0; i < 10; i += 1) {
      const lote = await canal.messages.fetch({ limit: 100, before: antesDe });
      if (lote.size === 0) break;
      mensajes.push(...lote.values());
      antesDe = lote.last().id;
      if (lote.size < 100) break;
    }

    mensajes.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    const lineas = mensajes.map((m) => {
      const fecha = new Date(m.createdTimestamp).toISOString().replace('T', ' ').slice(0, 19);
      const adjuntos = m.attachments.map((a) => a.url).join(' ');
      const embeds = m.embeds.length ? ` [${m.embeds.length} embed(s)]` : '';
      return `[${fecha}] ${m.author.tag}: ${m.content}${embeds}${adjuntos ? ` ${adjuntos}` : ''}`;
    });

    const cabecera = `Transcripcion de #${canal.name} (${canal.id})\nGenerada: ${new Date().toISOString()}\nMensajes: ${lineas.length}\n${'='.repeat(60)}\n`;
    return new AttachmentBuilder(Buffer.from(cabecera + lineas.join('\n'), 'utf8'), {
      name: `transcripcion-${canal.name}.txt`,
    });
  } catch (err) {
    console.error('[tickets] no se ha podido generar la transcripcion:', err.message);
    return null;
  }
}

async function log(guild, { titulo, color, campos = [], ficheros = [] }) {
  const cfg = store.getGuild(guild.id);
  if (!cfg.logsId) return;

  const canal =
    guild.channels.cache.get(cfg.logsId) || (await guild.channels.fetch(cfg.logsId).catch(() => null));
  if (!canal?.isTextBased()) return;

  const embed = new EmbedBuilder().setTitle(titulo).setColor(color || config.colores.principal).setTimestamp();
  if (campos.length) embed.addFields(campos);

  await canal.send({ embeds: [embed], files: ficheros }).catch((err) => {
    console.error('[tickets] no se ha podido escribir en el canal de logs:', err.message);
  });
}

module.exports = {
  esStaff,
  botonesTicket,
  crearTicket,
  cerrarTicket,
  reabrirTicket,
  generarTranscripcion,
  log,
  LIMITE_TICKETS_ABIERTOS,
};
