'use strict';

const { REST, Routes } = require('discord.js');

const config = require('./config');
const { cargarComandos } = require('./lib/cargador');

async function desplegar() {
  if (!config.token || !config.clientId) {
    throw new Error('Faltan DISCORD_TOKEN o CLIENT_ID en el .env');
  }

  const comandos = cargarComandos().map((c) => c.data.toJSON());
  const rest = new REST().setToken(config.token);

  const ruta = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  let datos;
  try {
    datos = await rest.put(ruta, { body: comandos });
  } catch (err) {
    if (err.status === 401) {
      throw new Error('DISCORD_TOKEN no valido. Copialo de nuevo desde el Developer Portal (Bot > Reset Token).');
    }
    if (err.status === 403) {
      throw new Error(
        `no tengo permiso para registrar comandos${config.guildId ? ` en el servidor ${config.guildId}` : ''}. ` +
          'Invita al bot con el scope "applications.commands" y comprueba que GUILD_ID es correcto.',
      );
    }
    if (err.status === 404) {
      throw new Error('CLIENT_ID o GUILD_ID incorrectos: Discord no encuentra la aplicacion o el servidor.');
    }
    throw err;
  }

  console.log(
    `✅ ${datos.length} comandos registrados ${config.guildId ? `en el servidor ${config.guildId}` : 'globalmente (pueden tardar hasta 1 h en aparecer)'}.`,
  );

  return datos;
}

module.exports = { desplegar };

if (require.main === module) {
  desplegar().catch((err) => {
    console.error('❌ No se han podido registrar los comandos:', err.message);
    process.exitCode = 1;
  });
}
