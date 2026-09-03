'use strict';

const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');

const config = require('./config');
const { cargarComandos, cargarEventos } = require('./lib/cargador');
const { desplegar } = require('./deploy-commands');

if (!config.token) {
  console.error('❌ Falta DISCORD_TOKEN. Copia .env.example a .env y rellena el token.');
  process.exit(1);
}
if (!config.clientId) {
  console.error('❌ Falta CLIENT_ID. Copia .env.example a .env y rellena el id de la aplicacion.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel],
});

client.commands = new Collection();
for (const comando of cargarComandos()) {
  client.commands.set(comando.data.name, comando);
}

for (const evento of cargarEventos()) {
  if (evento.once) {
    client.once(evento.name, (...args) => evento.execute(...args));
  } else {
    client.on(evento.name, (...args) => evento.execute(...args));
  }
}

client.on('error', (err) => console.error('[cliente] error:', err));
process.on('unhandledRejection', (err) => console.error('[proceso] promesa sin capturar:', err));

async function arrancar() {
  if (config.deployOnStart) {
    try {
      await desplegar();
    } catch (err) {
      console.error('⚠️  No se han podido registrar los comandos al arrancar:', err.message);
      console.error('   El bot sigue arrancando; registralos a mano con "npm run deploy".');
    }
  }

  try {
    await client.login(config.token);
  } catch (err) {
    if (err.code === 'TokenInvalid' || err.status === 401) {
      throw new Error(
        'el DISCORD_TOKEN del .env no es valido. Vuelve a copiarlo desde el Developer Portal (Bot > Reset Token).',
      );
    }
    if (err.code === 'DisallowedIntents') {
      throw new Error(
        'el bot pide intents que no tiene activados. Actívalos en el Developer Portal (Bot > Privileged Gateway Intents).',
      );
    }
    throw err;
  }
}

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    console.log('\n👋 Cerrando el bot...');
    client.destroy();
    process.exit(0);
  });
}

arrancar().catch((err) => {
  console.error('❌ No se ha podido arrancar el bot:', err.message);
  process.exit(1);
});
