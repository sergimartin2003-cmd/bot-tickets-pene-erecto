'use strict';

const { Status } = require('discord.js');

/**
 * Vigila la conexion con Discord.
 *
 * discord.js reconecta solo casi siempre, pero cuando se queda atascado (token
 * caducado, sesion invalidada, red que no vuelve) lo unico que arregla el
 * problema es reiniciar el proceso. Aqui detectamos ese caso y salimos con
 * codigo 1: el supervisor, Docker, pm2 o el propio hosting lo levantan otra vez.
 */
function iniciarVigilante(client, { minutosSinConexion = 5, intervaloSegundos = 60 } = {}) {
  const limite = Math.max(1, Math.round((minutosSinConexion * 60) / intervaloSegundos));
  let fallosSeguidos = 0;

  const conectado = () => client.ws.status === Status.Ready;

  const temporizador = setInterval(() => {
    if (conectado()) {
      if (fallosSeguidos > 0) {
        console.log('✅ Conexion con Discord recuperada.');
        fallosSeguidos = 0;
      }
      return;
    }

    fallosSeguidos += 1;
    console.warn(
      `⚠️  Sin conexion con Discord (${fallosSeguidos}/${limite}) · estado del websocket: ${client.ws.status}`,
    );

    if (fallosSeguidos >= limite) {
      console.error('❌ Discord no vuelve. Reiniciando el proceso para forzar una conexion limpia...');
      clearInterval(temporizador);
      // Codigo 1 = "reinicianme": lo entienden el supervisor, Docker, pm2 y los
      // hostings con reinicio automatico.
      process.exit(1);
    }
  }, intervaloSegundos * 1000);

  temporizador.unref?.();

  // Los eventos del shard dejan rastro en los logs del hosting, que es lo unico
  // que se puede mirar cuando algo va mal de madrugada.
  client.on('shardDisconnect', (evento, id) => {
    console.warn(`⚠️  Shard ${id} desconectado (codigo ${evento?.code}). Reintentando...`);
  });
  client.on('shardReconnecting', (id) => console.log(`🔄 Shard ${id} reconectando...`));
  client.on('shardResume', (id, repetidos) => console.log(`✅ Shard ${id} reconectado (${repetidos} eventos recuperados).`));
  client.on('shardError', (err, id) => console.error(`⚠️  Error en el shard ${id}:`, err.message));

  return { temporizador, conectado, parar: () => clearInterval(temporizador) };
}

module.exports = { iniciarVigilante };
