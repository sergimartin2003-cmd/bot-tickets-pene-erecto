'use strict';

const { PermissionFlagsBits } = require('discord.js');

/**
 * Quien puede ver y tocar el registro de cuentas: solo el dueño del servidor
 * y quien tenga el permiso de Administrador. Ni el autor del ticket ni el
 * staff normal entran aqui.
 */
function esAdmin(miembro) {
  if (!miembro?.guild) return false;
  if (miembro.guild.ownerId === miembro.id) return true;
  return miembro.permissions.has(PermissionFlagsBits.Administrator);
}

const AVISO_SOLO_ADMIN = '🔐 Solo el dueño del servidor y los administradores pueden ver el registro de cuentas.';

module.exports = { esAdmin, AVISO_SOLO_ADMIN };
