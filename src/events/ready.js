'use strict';

const { Events, ActivityType } = require('discord.js');

const respaldo = require('../lib/respaldo');

module.exports = {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    console.log(`✅ Conectado como ${client.user.tag}`);
    console.log(`   Servidores: ${client.guilds.cache.size} · Comandos: ${client.commands.size}`);
    client.user.setActivity('tus tickets', { type: ActivityType.Watching });

    // En un hosting gratuito el disco se borra al reiniciar: si no hay
    // memoria, la recuperamos del canal de respaldo antes de atender a nadie.
    await respaldo.restaurarSiHaceFalta(client);
    respaldo.iniciarRespaldos(client);
  },
};
