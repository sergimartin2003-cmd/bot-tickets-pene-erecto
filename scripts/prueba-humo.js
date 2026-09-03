'use strict';

/**
 * Prueba del bot sin conectar con Discord.
 * Uso: npm run prueba
 *
 * Comprueba las tres cosas importantes:
 *  - los botones del panel se crean, se borran y se publican;
 *  - el registro de cuentas suma y resta bien, y se recuerda por usuario;
 *  - solo el dueño del servidor y los administradores pueden ver ese registro.
 */

// Base de datos aparte: la prueba no debe tocar la memoria real del bot ni
// arrastrar lo que dejo la ejecucion anterior.
process.env.BOT_DB = require('node:path').join(
  require('node:os').tmpdir(),
  `bot-tickets-prueba-${process.pid}.json`,
);

const store = require('../src/lib/store');
const cuentas = require('../src/lib/cuentas');
const panel = require('../src/lib/panel');
const config = require('../src/config');
const handlerBotones = require('../src/interactions/botones');
const handlerSelects = require('../src/interactions/selects');
const handlerModales = require('../src/interactions/modales');
const comandoCuentas = require('../src/commands/cuentas');
const { crearServidor } = require('../src/servidor');
const { detectarUrl, iniciarKeepAlive } = require('../src/lib/keepalive');
const { iniciarVigilante } = require('../src/lib/vigilante');
const respaldo = require('../src/lib/respaldo');
const { Status } = require('discord.js');

const GUILD_ID = 'prueba-guild';
const CANAL_ID = 'prueba-canal';
const OWNER_ID = 'dueño';
const CLIENTE_ID = 'cliente';

let fallos = 0;

function comprobar(descripcion, condicion) {
  console.log(`${condicion ? '  ✅' : '  ❌'} ${descripcion}`);
  if (!condicion) fallos += 1;
}

const publicados = [];
const canalPanel = {
  id: 'canal-panel',
  isTextBased: () => true,
  send: async (contenido) => {
    publicados.push(contenido);
    return { id: `pub${publicados.length}` };
  },
};

const guild = {
  id: GUILD_ID,
  ownerId: OWNER_ID,
  channels: { cache: new Map([['canal-panel', canalPanel]]), fetch: async () => canalPanel },
};

/** rol: 'owner', 'admin', 'staff' o 'cliente'. */
function interaccion({ customId = '', campos = {}, rol = 'admin', valores = [], subcomando, opciones = {} }) {
  const userId = rol === 'owner' ? OWNER_ID : rol;
  const respuestas = [];
  const anotar = (c) => respuestas.push(typeof c === 'string' ? c : c.content ?? '(sin texto)');

  return {
    customId,
    channelId: CANAL_ID,
    channel: canalPanel,
    guild,
    guildId: GUILD_ID,
    values: valores,
    user: { id: userId, tag: `${userId}#0001`, toString: () => `<@${userId}>` },
    member: {
      id: userId,
      guild,
      roles: { cache: new Map() },
      // Solo 'admin' tiene el permiso de Administrador; el staff no.
      permissions: { has: () => rol === 'admin' },
    },
    fields: { getTextInputValue: (id) => campos[id] ?? '' },
    options: {
      getSubcommand: () => subcomando,
      getString: (n) => opciones[n] ?? null,
      getInteger: (n) => opciones[n] ?? null,
      getUser: (n) => opciones[n] ?? null,
      getChannel: (n) => opciones[n] ?? null,
    },
    isFromMessage: () => true,
    reply: async (c) => anotar(c),
    editReply: async (c) => anotar(c),
    update: async (c) => anotar(c),
    deferReply: async () => {},
    followUp: async (c) => anotar(c),
    showModal: async (m) => respuestas.push(`modal:${m.toJSON().custom_id}`),
    respuestas,
  };
}

const denegado = (i) => /Solo (el dueño del servidor|los administradores)/.test(String(i.respuestas[0] || ''));

async function main() {
  console.log('\nBotones del panel');

  const inicialesCount = store.getTipos(GUILD_ID).length;
  comprobar(`arranca con los ${inicialesCount} botones de config.json`, inicialesCount === config.tiposPorDefecto.length);

  let i = interaccion({
    customId: 'panel:crear:modal',
    campos: { nombre: 'Dudas rapidas', emoji: '❓', descripcion: 'Preguntas', mensaje: 'Dinos tu duda', color: 'verde' },
  });
  await handlerModales.manejar(i);
  let tipos = store.getTipos(GUILD_ID);
  const nuevo = tipos.find((t) => t.nombre === 'Dudas rapidas');
  comprobar('se crea un boton desde el formulario', Boolean(nuevo) && nuevo.id === 'dudas-rapidas');
  comprobar('respeta el color elegido', nuevo.color === 'verde');

  i = interaccion({ customId: 'panel:crear:modal', campos: { nombre: 'Dudas rapidas' } });
  await handlerModales.manejar(i);
  comprobar(
    'dos botones con el mismo nombre no chocan de id',
    store.getTipos(GUILD_ID).filter((t) => t.id.startsWith('dudas-rapidas')).length === 2,
  );

  i = interaccion({ customId: 'panel:crear:modal', campos: { nombre: 'Mal color', color: 'morado' } });
  await handlerModales.manejar(i);
  comprobar('un color invalido se rechaza', i.respuestas[0].includes('Color no valido'));

  i = interaccion({ customId: 'panel:crear:modal', campos: { nombre: '' } });
  await handlerModales.manejar(i);
  comprobar('un boton sin nombre se rechaza', i.respuestas[0].includes('necesita un nombre'));

  i = interaccion({ customId: 'panel:borrar', valores: ['dudas-rapidas-2'] });
  await handlerSelects.manejar(i);
  comprobar('se borra un boton desde el menu', !store.getTipos(GUILD_ID).some((t) => t.id === 'dudas-rapidas-2'));

  i = interaccion({ customId: 'panel:publicar:modal:canal-panel', campos: { titulo: 'Soporte' } });
  await handlerModales.manejar(i);
  const panelPublicado = publicados.at(-1);
  const etiquetas = panelPublicado.components.flatMap((f) => f.toJSON().components.map((c) => c.label));
  comprobar('el panel se publica con un boton por tipo', etiquetas.length === store.getTipos(GUILD_ID).length);
  comprobar(`los botones son clickables (${etiquetas.join(', ')})`, etiquetas.includes('Dudas rapidas'));

  console.log('\nQuien gestiona los paneles');

  for (const rol of ['cliente', 'staff']) {
    i = interaccion({ customId: 'panel:crear', rol });
    await handlerBotones.manejar(i);
    comprobar(`${rol} no puede crear botones`, denegado(i));
  }

  i = interaccion({ customId: 'panel:crear', rol: 'owner' });
  await handlerBotones.manejar(i);
  comprobar('el dueño del servidor si puede', i.respuestas[0] === 'modal:panel:crear:modal');

  console.log('\nAbrir ticket con un boton');

  const tipoDudas = store.getTipos(GUILD_ID).find((t) => t.id === 'dudas');
  i = interaccion({ customId: `ticket:abrir:${tipoDudas.id}`, rol: 'cliente' });
  await handlerBotones.manejar(i);
  comprobar('el boton pide el motivo antes de abrir', i.respuestas[0] === `modal:ticket:abrir:modal:${tipoDudas.id}`);

  i = interaccion({ customId: 'ticket:abrir:no-existe', rol: 'cliente' });
  await handlerBotones.manejar(i);
  comprobar('un boton borrado avisa en vez de romper', i.respuestas[0].includes('ya no existe'));

  console.log('\nRegistro de cuentas (sumar y restar)');

  store.setTicket(CANAL_ID, {
    guildId: GUILD_ID,
    usuarioId: CLIENTE_ID,
    tipoId: 'dudas',
    numero: 1,
    cerrado: false,
  });

  const [n1, n2, n3] = config.niveles;

  i = interaccion({
    customId: `cuentas:editar:modal:${CLIENTE_ID}`,
    campos: { [`nivel:${n1.id}`]: '2', [`nivel:${n2.id}`]: '5', [`nivel:${n3.id}`]: '1' },
  });
  await handlerModales.manejar(i);
  let registro = cuentas.getCuentas(GUILD_ID, CLIENTE_ID);
  comprobar(
    `el formulario guarda 2 / 5 / 1 (${cuentas.resumenCorto(registro)})`,
    registro[n1.id] === 2 && registro[n2.id] === 5 && registro[n3.id] === 1,
  );

  i = interaccion({ customId: `cuentas:nivel:modal:${CLIENTE_ID}:${n2.id}`, campos: { cantidad: '3' } });
  await handlerModales.manejar(i);
  comprobar('sumar 3 al nivel 2 da 8', cuentas.getCuentas(GUILD_ID, CLIENTE_ID)[n2.id] === 8);

  i = interaccion({ customId: `cuentas:nivel:modal:${CLIENTE_ID}:${n2.id}`, campos: { cantidad: '-4' } });
  await handlerModales.manejar(i);
  comprobar('restar 4 al nivel 2 da 4', cuentas.getCuentas(GUILD_ID, CLIENTE_ID)[n2.id] === 4);

  i = interaccion({ customId: `cuentas:nivel:modal:${CLIENTE_ID}:${n1.id}`, campos: { cantidad: '-99' } });
  await handlerModales.manejar(i);
  comprobar('no se baja de cero', cuentas.getCuentas(GUILD_ID, CLIENTE_ID)[n1.id] === 0);

  i = interaccion({ customId: `cuentas:nivel:modal:${CLIENTE_ID}:${n3.id}`, campos: { cantidad: 'abc' } });
  await handlerModales.manejar(i);
  comprobar('una cantidad invalida se rechaza', i.respuestas[0].includes('no es un numero valido'));

  console.log('\nMemoria');

  store.apuntarHistorial(GUILD_ID, CLIENTE_ID, {
    numero: 1,
    tipoId: 'dudas',
    tipoNombre: 'Dudas',
    abiertoEn: Date.now(),
    cerradoEn: null,
  });
  store.cerrarEnHistorial(GUILD_ID, CLIENTE_ID, 1);
  comprobar('el ticket queda apuntado en el historial', Boolean(store.getUsuario(GUILD_ID, CLIENTE_ID).historial[0].cerradoEn));

  cuentas.setCuentas(GUILD_ID, CLIENTE_ID, { [n1.id]: 2, [n2.id]: 5, [n3.id]: 1 });
  store.borrarTicket(CANAL_ID);
  comprobar(
    'las cuentas siguen ahi despues de cerrar el ticket',
    cuentas.total(cuentas.getCuentas(GUILD_ID, CLIENTE_ID)) === 8,
  );

  i = interaccion({ rol: 'admin', subcomando: 'ver', opciones: { usuario: { id: CLIENTE_ID } } });
  await comandoCuentas.execute(i);
  comprobar('se consultan fuera del ticket con /cuentas ver usuario:', i.respuestas.length === 1);

  console.log('\nQuien ve el registro de cuentas');

  for (const rol of ['cliente', 'staff']) {
    i = interaccion({ customId: `cuentas:editar:${CLIENTE_ID}`, rol });
    await handlerBotones.manejar(i);
    comprobar(`${rol} no puede tocar el registro`, denegado(i));

    i = interaccion({ rol, subcomando: 'ver', opciones: { usuario: { id: CLIENTE_ID } } });
    await comandoCuentas.execute(i);
    comprobar(`${rol} tampoco con /cuentas`, denegado(i));
  }

  i = interaccion({
    customId: `cuentas:editar:modal:${CLIENTE_ID}`,
    rol: 'cliente',
    campos: { [`nivel:${n1.id}`]: '99' },
  });
  await handlerModales.manejar(i);
  comprobar(
    'un formulario colado a mano no cambia nada',
    denegado(i) && cuentas.getCuentas(GUILD_ID, CLIENTE_ID)[n1.id] === 2,
  );

  for (const rol of ['admin', 'owner']) {
    i = interaccion({ customId: `cuentas:editar:${CLIENTE_ID}`, rol });
    await handlerBotones.manejar(i);
    comprobar(`${rol} si puede`, i.respuestas[0] === `modal:cuentas:editar:modal:${CLIENTE_ID}`);
  }

  await probarSiempreActivo();
  await probarRespaldo();

  try {
    require('node:fs').unlinkSync(process.env.BOT_DB);
  } catch {
    // Si no llego a crearse, no hay nada que limpiar.
  }

  console.log(fallos === 0 ? '\n✅ Todo correcto.\n' : `\n❌ ${fallos} comprobacion(es) fallidas.\n`);
  process.exitCode = fallos === 0 ? 0 : 1;
}

/** Lo que mantiene el bot vivo en un hosting gratuito. */
async function probarSiempreActivo() {
  console.log('\nSiempre activo');

  // Pagina de estado: 503 mientras no hay Discord, 200 cuando lo hay.
  let conectado = false;
  const web = crearServidor(() => ({ conectado, estado: conectado ? 'listo' : 'conectando' }));
  await web.escuchar(0);
  const base = `http://127.0.0.1:${web.servidor.address().port}`;

  let res = await fetch(`${base}/ping`);
  comprobar('sin conexion la pagina de estado responde 503', res.status === 503);

  conectado = true;
  res = await fetch(`${base}/ping`);
  comprobar('conectado responde 200 (el monitor lo ve vivo)', res.status === 200 && (await res.text()) === 'pong');

  // Auto-ping contra ese mismo servidor.
  let pings = 0;
  web.servidor.on('request', (req) => {
    if (req.url === '/ping') pings += 1;
  });
  const keepalive = iniciarKeepAlive({ url: base, minutos: 0.1 });
  await new Promise((r) => setTimeout(r, 7000));
  keepalive.parar();
  comprobar(`el auto-ping se llama solo (${pings} en 7s)`, pings >= 1);

  await web.cerrar();

  // Cada hosting publica su URL en una variable distinta.
  comprobar('detecta la URL de Render', detectarUrl({ RENDER_EXTERNAL_URL: 'https://x.onrender.com' }) === 'https://x.onrender.com');
  comprobar('detecta la URL de Railway', detectarUrl({ RAILWAY_PUBLIC_DOMAIN: 'x.up.railway.app' }) === 'https://x.up.railway.app');
  comprobar('sin hosting no hay auto-ping', detectarUrl({}) === null);

  // El vigilante reinicia el proceso si Discord no vuelve.
  let estadoWs = Status.Ready;
  const clienteFalso = { ws: { get status() { return estadoWs; } }, on() {} };
  const salidaReal = process.exit;
  let salioCon = null;
  process.exit = (codigo) => {
    salioCon = codigo;
  };
  const vigilante = iniciarVigilante(clienteFalso, { minutosSinConexion: 0.01, intervaloSegundos: 0.2 });
  estadoWs = Status.Disconnected;
  await new Promise((r) => setTimeout(r, 1000));
  vigilante.parar();
  process.exit = salidaReal;
  comprobar('el vigilante fuerza el reinicio si Discord no vuelve', salioCon === 1);
}

/** El respaldo que salva la memoria en hostings con disco efimero. */
async function probarRespaldo() {
  console.log('\nRespaldo de la memoria');

  const fs = require('node:fs');
  const http = require('node:http');

  process.env.RESPALDO_CANAL_ID = 'canal-respaldo';

  store.setGuild('respaldo-guild', { staffRolId: 'rol-prueba' });
  cuentas.setCuentas('respaldo-guild', 'u-prueba', { [config.niveles[0].id]: 7 });
  await new Promise((r) => setTimeout(r, 50));

  const enviados = [];
  let mensajesFalsos = { filter: () => ({ sort: () => ({ first: () => null }) }) };
  const canal = {
    isTextBased: () => true,
    send: async (m) => {
      enviados.push(m);
      return { id: 'm1' };
    },
    messages: { fetch: async () => mensajesFalsos },
  };
  const client = { user: { id: 'bot' }, channels: { cache: new Map(), fetch: async () => canal } };

  comprobar('sube la memoria al canal de respaldo', (await respaldo.subir(client, 'prueba')) === true);

  const copia = enviados[0].files[0].attachment.toString();
  comprobar('la copia lleva las cuentas dentro', copia.includes('u-prueba') && copia.includes('rol-prueba'));

  // Servimos la copia como haria el CDN de Discord.
  const servidor = http.createServer((req, res) => res.end(copia));
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${servidor.address().port}/db.json`;

  mensajesFalsos = {
    filter: () => ({
      sort: () => ({
        first: () => ({
          createdTimestamp: Date.now(),
          attachments: { find: () => ({ name: 'db.json', url }) },
        }),
      }),
    }),
  };

  // El hosting reinicia y se lleva el disco por delante.
  fs.unlinkSync(store.RUTA);
  store.recargar();
  comprobar('tras borrarse el disco la memoria esta vacia', !store.getGuild('respaldo-guild').staffRolId);

  comprobar('la restaura del canal al arrancar', (await respaldo.restaurarSiHaceFalta(client)) === true);
  comprobar(
    'vuelven las cuentas y la configuracion',
    cuentas.getCuentas('respaldo-guild', 'u-prueba')[config.niveles[0].id] === 7 &&
      store.getGuild('respaldo-guild').staffRolId === 'rol-prueba',
  );
  comprobar('con memoria en disco no pisa nada', (await respaldo.restaurarSiHaceFalta(client)) === false);

  servidor.close();
  delete process.env.RESPALDO_CANAL_ID;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
