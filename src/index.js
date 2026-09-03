'use strict';

const { Client, GatewayIntentBits, Collection, Partials, Status } = require('discord.js');

const config = require('./config');
const { cargarComandos, cargarEventos } = require('./lib/cargador');
const { desplegar } = require('./deploy-commands');
const { crearServidor, formatearTiempo } = require('./servidor');
const { iniciarKeepAlive } = require('./lib/keepalive');
const { iniciarVigilante } = require('./lib/vigilante');
const respaldo = require('./lib/respaldo');

if (!config.token) {
  console.error('❌ Falta DISCORD_TOKEN. Ejecuta "npm run configurar" o copia .env.example a .env.');
  process.exit(1);
}
if (!config.clientId) {
  console.error('❌ Falta CLIENT_ID. Ejecuta "npm run configurar" o copia .env.example a .env.');
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

// Nada de esto debe tumbar el proceso: si el bot sigue conectado, mejor que
// aguante y lo deje escrito en los logs.
process.on('unhandledRejection', (err) => console.error('[proceso] promesa sin capturar:', err));
process.on('uncaughtException', (err) => console.error('[proceso] excepcion sin capturar:', err));

// --- Estado que sirve el endpoint HTTP ---

const arrancadoEn = Date.now();

function estado() {
  const conectado = client.ws.status === Status.Ready;
  return {
    conectado,
    estado: conectado ? 'listo' : 'conectando',
    bot: client.user?.tag || null,
    servidores: client.guilds.cache.size,
    latencia: client.ws.ping >= 0 ? `${Math.round(client.ws.ping)} ms` : null,
    enPie: formatearTiempo((Date.now() - arrancadoEn) / 1000),
    desde: new Date(arrancadoEn).toISOString(),
  };
}

const web = crearServidor(estado);

async function arrancar() {
  // El servidor primero: los hostings gratuitos matan el servicio si no hay
  // nada escuchando en su puerto a los pocos segundos.
  const puerto = Number(process.env.PORT) || 3000;
  try {
    await web.escuchar(puerto);
  } catch (err) {
    console.error(`⚠️  No he podido escuchar en el puerto ${puerto}: ${err.message}`);
    console.error('   El bot sigue arrancando, pero sin pagina de estado ni auto-ping.');
  }

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

  // Con el bot ya dentro: que no se duerma y que se reinicie si pierde Discord.
  iniciarKeepAlive();
  iniciarVigilante(client);
}

let parando = false;
for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, async () => {
    if (parando) return;
    parando = true;
    console.log('\n👋 Cerrando el bot...');
    try {
      // Los hostings avisan con SIGTERM antes de reiniciar: aprovechamos para
      // dejar la memoria a salvo.
      await respaldo.subir(client, 'al apagarse');
      await web.cerrar();
      await client.destroy();
    } catch {
      // Da igual: nos vamos igualmente.
    }
    process.exit(0);
  });
}

arrancar().catch((err) => {
  console.error('❌ No se ha podido arrancar el bot:', err.message);
  // Codigo 1 para que el supervisor o el hosting lo reintenten.
  process.exit(1);
});
