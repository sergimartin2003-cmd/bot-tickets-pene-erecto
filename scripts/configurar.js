'use strict';

/**
 * Asistente para crear el .env sin tener que editarlo a mano.
 * Uso: npm run configurar
 */

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const RUTA_ENV = path.join(__dirname, '..', '.env');

class FinDeEntrada extends Error {}

/**
 * Lector de lineas propio: readline/promises pierde lineas cuando la entrada
 * no es un terminal (por ejemplo al canalizar respuestas), y asi el asistente
 * funciona igual escribiendo a mano que con un `printf ... | npm run configurar`.
 */
function crearLector() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const pendientes = [];
  const enEspera = [];
  let cerrado = false;

  rl.on('line', (linea) => {
    const espera = enEspera.shift();
    if (espera) espera.resolve(linea);
    else pendientes.push(linea);
  });

  rl.on('close', () => {
    cerrado = true;
    while (enEspera.length) enEspera.shift().reject(new FinDeEntrada());
  });

  return {
    preguntar(texto) {
      process.stdout.write(texto);
      if (pendientes.length) return Promise.resolve(pendientes.shift());
      if (cerrado) return Promise.reject(new FinDeEntrada());
      return new Promise((resolve, reject) => enEspera.push({ resolve, reject }));
    },
    cerrar: () => rl.close(),
  };
}

/**
 * La primera parte del token es el id de la aplicacion en base64, asi que
 * podemos rellenar CLIENT_ID solo y evitar un copia y pega.
 */
function clientIdDesdeToken(token) {
  try {
    const id = Buffer.from(token.split('.')[0], 'base64').toString('utf8');
    return /^\d{17,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function pintarError(mensaje) {
  console.log(`   ❌ ${mensaje}`);
}

async function main() {
  const rl = crearLector();

  console.log('\n🎫 Configuracion del bot de tickets\n');

  if (fs.existsSync(RUTA_ENV)) {
    const respuesta = (await rl.preguntar('Ya existe un .env. ¿Lo sobrescribo? (s/N): ')).trim().toLowerCase();
    if (respuesta !== 's' && respuesta !== 'si') {
      console.log('\nNo se ha tocado nada. Arranca el bot con: npm start\n');
      rl.cerrar();
      return;
    }
  }

  console.log('\nSaca estos datos del Developer Portal: https://discord.com/developers/applications\n');

  let token = '';
  while (!token) {
    token = (await rl.preguntar('1. Token del bot (Bot > Reset Token): ')).trim();
    if (!token) pintarError('El token no puede estar vacio.');
    else if (token.split('.').length !== 3) {
      pintarError('Eso no parece un token (deberia tener dos puntos). Copialo entero.');
      token = '';
    }
  }

  const idDetectado = clientIdDesdeToken(token);
  let clientId = '';
  while (!clientId) {
    const pregunta = idDetectado
      ? `2. Application ID [detectado: ${idDetectado}, Enter para aceptar]: `
      : '2. Application ID (General Information > Application ID): ';
    clientId = (await rl.preguntar(pregunta)).trim() || idDetectado || '';
    if (!/^\d{17,20}$/.test(clientId)) {
      pintarError('El Application ID son solo numeros (unos 18 digitos).');
      clientId = '';
    }
  }

  let guildId = null;
  while (guildId === null) {
    const valor = (
      await rl.preguntar('3. ID de tu servidor (Enter para saltarlo, tardara 1 h en aparecer): ')
    ).trim();
    if (!valor) {
      guildId = '';
    } else if (/^\d{17,20}$/.test(valor)) {
      guildId = valor;
    } else {
      pintarError('El ID del servidor son solo numeros: activa el Modo desarrollador, clic derecho en el servidor > Copiar ID.');
    }
  }

  rl.cerrar();

  const contenido = [
    '# Generado por "npm run configurar". No compartas este archivo.',
    `DISCORD_TOKEN=${token}`,
    `CLIENT_ID=${clientId}`,
    `GUILD_ID=${guildId}`,
    'DEPLOY_ON_START=true',
    '',
  ].join('\n');

  // Solo lectura y escritura para el dueño: dentro va el token.
  fs.writeFileSync(RUTA_ENV, contenido, { mode: 0o600 });

  console.log('\n✅ .env creado.');
  console.log('   Arranca el bot con: npm start');
  console.log(
    guildId
      ? '   Los comandos apareceran en tu servidor al instante.\n'
      : '   Sin GUILD_ID, Discord puede tardar hasta 1 hora en mostrar los comandos.\n',
  );
}

main().catch((err) => {
  if (err instanceof FinDeEntrada) {
    console.error('\n❌ Se ha cortado la entrada antes de responder a todo. No se ha creado el .env.\n');
  } else {
    console.error('\n❌ No se ha podido crear el .env:', err.message, '\n');
  }
  process.exitCode = 1;
});
