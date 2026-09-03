'use strict';

const { Events, ActivityType } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,

  execute(client) {
    console.log(`✅ Conectado como ${client.user.tag}`);
    console.log(`   Servidores: ${client.guilds.cache.size} · Comandos: ${client.commands.size}`);
    client.user.setActivity('tus tickets', { type: ActivityType.Watching });
  },
};
