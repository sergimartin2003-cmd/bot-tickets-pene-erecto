'use strict';

const { MessageFlags } = require('discord.js');

const config = require('../config');
const store = require('../lib/store');
const cuentas = require('../lib/cuentas');
const tickets = require('../lib/tickets');
const panel = require('../lib/panel');
const { esAdmin, AVISO_SOLO_ADMIN } = require('../lib/permisos');

function efimero(contenido) {
  return { content: contenido, flags: MessageFlags.Ephemeral };
}

function texto(interaction, campo) {
  return (interaction.fields.getTextInputValue(campo) || '').trim();
}

/** Lee un campo y lo convierte a numero entero (admite vacio). */
function leerNumero(interaction, campo, { permitirNegativo = false } = {}) {
  const crudo = texto(interaction, campo).replace(',', '.');
  if (crudo === '') return { valor: 0 };

  const numero = Number(crudo);
  if (!Number.isFinite(numero)) return { error: `\`${crudo}\` no es un numero valido.` };
  if (!permitirNegativo && numero < 0) return { error: 'La cantidad no puede ser negativa.' };

  return { valor: Math.trunc(numero) };
}

async function manejar(interaction) {
  const partes = interaction.customId.split(':');
  const [grupo, accion] = partes;

  if (grupo === 'ticket' && accion === 'abrir') return abrirTicket(interaction, partes[3]);
  if (grupo === 'panel' && accion === 'crear') return crearTipo(interaction);
  if (grupo === 'panel' && accion === 'publicar') return publicarPanel(interaction, partes[3]);
  if (grupo === 'cuentas') return guardarCuentas(interaction, accion, partes.slice(3));

  return false;
}

// --- Abrir ticket desde un boton del panel ---

async function abrirTicket(interaction, tipoId) {
  const tipo = store.getTipo(interaction.guildId, tipoId);
  if (!tipo) {
    await interaction.reply(efimero('❌ Ese boton ya no existe.'));
    return true;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const res = await tickets.crearTicket({
    guild: interaction.guild,
    miembro: interaction.member,
    tipo,
    motivo: texto(interaction, 'motivo') || null,
  });

  await interaction.editReply(res.error ? `❌ ${res.error}` : `✅ Ticket abierto: ${res.canal}`);
  return true;
}

// --- Menu de gestion: crear boton y publicar panel ---

async function crearTipo(interaction) {
  if (!esAdmin(interaction.member)) {
    await interaction.reply(efimero('❌ Solo los administradores pueden gestionar los paneles.'));
    return true;
  }

  const tipos = store.getTipos(interaction.guildId);
  if (tipos.length >= config.MAX_TIPOS) {
    await interaction.reply(efimero(`❌ Ya tienes el maximo de ${config.MAX_TIPOS} botones.`));
    return true;
  }

  const nombre = texto(interaction, 'nombre');
  if (!nombre) {
    await interaction.reply(efimero('❌ El boton necesita un nombre.'));
    return true;
  }

  const color = texto(interaction, 'color').toLowerCase();
  if (color && !(color in panel.ESTILOS)) {
    await interaction.reply(
      efimero(`❌ Color no valido: usa ${Object.keys(panel.ESTILOS).join(', ')} o dejalo vacio.`),
    );
    return true;
  }

  const tipo = {
    id: panel.idDesdeNombre(interaction.guildId, nombre),
    nombre: nombre.slice(0, 80),
    emoji: texto(interaction, 'emoji') || null,
    descripcion: texto(interaction, 'descripcion') || null,
    mensaje: texto(interaction, 'mensaje') || null,
    color: color || 'azul',
  };

  store.setTipos(interaction.guildId, [...tipos, tipo]);

  const vista = panel.vistaGestion(interaction.guildId, {
    aviso: `✅ Boton **${tipo.nombre}** creado. Pulsa **Publicar panel** cuando lo tengas todo.`,
  });

  // El formulario se abre desde el propio menu efimero, asi que lo repintamos
  // en su sitio.
  if (interaction.isFromMessage()) {
    await interaction.update(vista);
  } else {
    await interaction.reply({ ...vista, flags: MessageFlags.Ephemeral });
  }
  return true;
}

async function publicarPanel(interaction, destinoId) {
  if (!esAdmin(interaction.member)) {
    await interaction.reply(efimero('❌ Solo los administradores pueden gestionar los paneles.'));
    return true;
  }

  const canal =
    destinoId && destinoId !== 'aqui'
      ? interaction.guild.channels.cache.get(destinoId) ||
        (await interaction.guild.channels.fetch(destinoId).catch(() => null))
      : interaction.channel;

  if (!canal?.isTextBased()) {
    await interaction.reply(efimero('❌ No encuentro ese canal o no admite mensajes.'));
    return true;
  }

  const vista = panel.vistaPanelPublico(interaction.guildId, {
    titulo: texto(interaction, 'titulo') || null,
    descripcion: texto(interaction, 'descripcion') || null,
  });

  try {
    await canal.send(vista);
  } catch (err) {
    console.error('[panel] no se ha podido publicar:', err.message);
    await interaction.reply(efimero(`❌ No he podido escribir en ${canal}. Revisa mis permisos en ese canal.`));
    return true;
  }

  await interaction.reply(efimero(`✅ Panel publicado en ${canal}.`));
  return true;
}

// --- Registro privado de cuentas ---

async function guardarCuentas(interaction, accion, resto) {
  if (!esAdmin(interaction.member)) {
    await interaction.reply(efimero(AVISO_SOLO_ADMIN));
    return true;
  }

  const usuarioId = resto[0];
  if (!usuarioId) {
    await interaction.reply(efimero('❌ No se de que usuario son estas cuentas. Vuelve a abrir el panel.'));
    return true;
  }

  let aviso;

  if (accion === 'editar') {
    const registro = cuentas.getCuentas(interaction.guildId, usuarioId);
    const errores = [];

    for (const nivel of config.niveles) {
      const { valor, error } = leerNumero(interaction, `nivel:${nivel.id}`);
      if (error) {
        errores.push(`**${nivel.nombre}**: ${error}`);
        continue;
      }
      registro[nivel.id] = valor;
    }

    if (errores.length) {
      await interaction.reply(efimero(`❌ No he guardado nada:\n${errores.join('\n')}`));
      return true;
    }

    const guardado = cuentas.setCuentas(interaction.guildId, usuarioId, registro);
    aviso = `✅ Guardado: **${cuentas.resumenCorto(guardado)}**`;
  } else if (accion === 'nivel') {
    const nivel = config.nivelPorId(resto[1]);
    if (!nivel) {
      await interaction.reply(efimero('❌ Ese nivel ya no existe.'));
      return true;
    }

    const { valor, error } = leerNumero(interaction, 'cantidad', { permitirNegativo: true });
    if (error) {
      await interaction.reply(efimero(`❌ ${error}`));
      return true;
    }

    const guardado = cuentas.sumarNivel(interaction.guildId, usuarioId, nivel.id, valor);
    aviso = `✅ ${nivel.nombre}: \`${guardado[nivel.id]}\` cuenta(s) en total.`;
  } else {
    return false;
  }

  await cuentas.refrescarFicha(interaction.guild, usuarioId);

  const vista = { ...cuentas.vistaPanel(interaction.guildId, usuarioId), content: aviso };
  if (interaction.isFromMessage()) {
    await interaction.update(vista);
  } else {
    await interaction.reply({ ...vista, flags: MessageFlags.Ephemeral });
  }
  return true;
}

module.exports = { manejar };
