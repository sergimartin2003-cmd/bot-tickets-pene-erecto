'use strict';

const { Events } = require('discord.js');

const store = require('../lib/store');

module.exports = {
  name: Events.ChannelDelete,

  // Si alguien borra el canal a mano, el ticket deja de existir: lo quitamos
  // del store para que no se acumule basura.
  execute(canal) {
    if (store.getTicket(canal.id)) {
      store.borrarTicket(canal.id);
    }
  },
};
