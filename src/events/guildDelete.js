'use strict';

const { Events } = require('discord.js');

module.exports = {
  name: Events.GuildDelete,

  execute(guild) {
    console.log(`👋 El bot ha salido de ${guild.name} (${guild.id}).`);
  },
};
