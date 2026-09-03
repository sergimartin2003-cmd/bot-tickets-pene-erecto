'use strict';

/**
 * Prueba rapida del registro de cuentas sin conectar con Discord.
 * Uso: npm run prueba
 *
 * Comprueba que las cuentas por nivel se suman, se restan y se validan bien,
 * y sobre todo que SOLO el dueño del servidor y los administradores pueden
 * verlas o tocarlas.
 */

const store = require('../src/lib/store');
const cuentas = require('../src/lib/cuentas');
const config = require('../src/config');
const handlerModales = require('../src/interactions/modales');
const handlerBotones = require('../src/interactions/botones');
const handlerSelects = require('../src/interactions/selects');
const comandoCuentas = require('../src/commands/cuentas');

const CANAL_ID = 'prueba-canal';
const GUILD_ID = 'prueba-guild';
const OWNER_ID = 'dueño';

let fallos = 0;

function comprobar(descripcion, condicion) {
  console.log(`${condicion ? '  ✅' : '  ❌'} ${descripcion}`);
  if (!condicion) fallos += 1;
}

const mensajesRegistro = [];
const canalRegistro = {
  id: 'canal-registro',
  isTextBased: () => true,
  messages: {
    fetch: async (id) => {
      const m = mensajesRegistro.find((x) => x.id === id);
      if (!m) throw new Error('mensaje no encontrado');
      return m;
    },
  },
  send: async (contenido) => {
    const mensaje = { id: `reg${mensajesRegistro.length}`, ...contenido, edit: async (n) => Object.assign(mensaje, n) };
    mensajesRegistro.push(mensaje);
    return mensaje;
  },
};

const guild = {
  id: GUILD_ID,
  ownerId: OWNER_ID,
  channels: {
    cache: new Map([['canal-registro', canalRegistro]]),
    fetch: async () => canalRegistro,
  },
};

/**
 * rol: 'owner' (dueño del servidor), 'admin' (permiso Administrador),
 * 'staff' (staff normal, sin Administrador) o 'cliente'.
 */
function interaccion({ customId, campos = {}, rol = 'admin', valores = [], subcomando, opciones = {} }) {
  const userId = rol === 'owner' ? OWNER_ID : rol;
  const respuestas = [];
  return {
    customId,
    channelId: CANAL_ID,
    guild,
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
    },
    isFromMessage: () => true,
    reply: async (c) => respuestas.push(typeof c === 'string' ? c : c.content ?? '(embed)'),
    editReply: async (c) => respuestas.push(typeof c === 'string' ? c : c.content ?? '(embed)'),
    update: async (c) => respuestas.push(typeof c === 'string' ? c : c.content ?? '(embed)'),
    deferReply: async () => {},
    followUp: async (c) => respuestas.push(c.content),
    showModal: async (m) => respuestas.push(`modal:${m.toJSON().custom_id}`),
    respuestas,
  };
}

const denegado = (i) => String(i.respuestas[0] || '').includes('Solo el dueño del servidor');

async function main() {
  store.setGuild(GUILD_ID, { canalCuentasId: 'canal-registro' });
  store.setTicket(CANAL_ID, {
    guildId: GUILD_ID,
    usuarioId: 'cliente',
    tipoId: 'cuentas',
    numero: 1,
    cerrado: false,
    cuentas: cuentas.registroVacio(),
  });

  const [n1, n2, n3] = config.niveles;

  console.log('\nRegistro de cuentas');

  let i = interaccion({
    customId: 'cuentas:editar:modal',
    campos: { [`nivel:${n1.id}`]: '2', [`nivel:${n2.id}`]: '5', [`nivel:${n3.id}`]: '1' },
  });
  await handlerModales.manejar(i);
  let registro = cuentas.getCuentas(CANAL_ID);
  comprobar(
    `el formulario guarda 2 / 5 / 1 (${cuentas.resumenCorto(registro)})`,
    registro[n1.id] === 2 && registro[n2.id] === 5 && registro[n3.id] === 1,
  );

  i = interaccion({ customId: `cuentas:nivel:modal:${n2.id}`, campos: { cantidad: '3' } });
  await handlerModales.manejar(i);
  comprobar('sumar 3 al nivel 2 da 8', cuentas.getCuentas(CANAL_ID)[n2.id] === 8);

  i = interaccion({ customId: `cuentas:nivel:modal:${n2.id}`, campos: { cantidad: '-4' } });
  await handlerModales.manejar(i);
  comprobar('restar 4 al nivel 2 da 4', cuentas.getCuentas(CANAL_ID)[n2.id] === 4);

  i = interaccion({ customId: `cuentas:nivel:modal:${n1.id}`, campos: { cantidad: '-99' } });
  await handlerModales.manejar(i);
  comprobar('no se baja de cero', cuentas.getCuentas(CANAL_ID)[n1.id] === 0);

  i = interaccion({ customId: `cuentas:nivel:modal:${n3.id}`, campos: { cantidad: 'abc' } });
  await handlerModales.manejar(i);
  comprobar('una cantidad invalida se rechaza', i.respuestas[0].includes('no es un numero valido'));

  console.log('\nValores');
  cuentas.setCuentas(CANAL_ID, { [n1.id]: 2, [n2.id]: 5, [n3.id]: 1 });
  registro = cuentas.getCuentas(CANAL_ID);
  const esperado = 2 * cuentas.valorNivel(n1) + 5 * cuentas.valorNivel(n2) + 1 * cuentas.valorNivel(n3);
  comprobar(`el valor total cuadra (${cuentas.formatearValor(cuentas.valorTotal(registro))})`, cuentas.valorTotal(registro) === esperado);
  comprobar('el total de cuentas es 8', cuentas.totalCuentas(registro) === 8);

  console.log('\nQuien puede ver el registro');

  i = interaccion({ customId: 'cuentas:editar', rol: 'cliente' });
  await handlerBotones.manejar(i);
  comprobar('el cliente del ticket NO puede', denegado(i));

  i = interaccion({ customId: 'cuentas:editar', rol: 'staff' });
  await handlerBotones.manejar(i);
  comprobar('el staff normal NO puede', denegado(i));

  i = interaccion({ customId: 'cuentas:nivel', rol: 'staff', valores: [n1.id] });
  await handlerSelects.manejar(i);
  comprobar('el staff tampoco por el menu de niveles', denegado(i));

  i = interaccion({ customId: 'cuentas:editar:modal', rol: 'cliente', campos: { [`nivel:${n1.id}`]: '99' } });
  await handlerModales.manejar(i);
  comprobar('el cliente no puede colar un formulario', denegado(i) && cuentas.getCuentas(CANAL_ID)[n1.id] === 2);

  i = interaccion({ rol: 'staff', subcomando: 'ver' });
  await comandoCuentas.execute(i);
  comprobar('/cuentas ver rechaza al staff', denegado(i));

  i = interaccion({ customId: 'cuentas:editar', rol: 'admin' });
  await handlerBotones.manejar(i);
  comprobar('el administrador si puede', i.respuestas[0] === 'modal:cuentas:editar:modal');

  i = interaccion({ customId: 'cuentas:editar', rol: 'owner' });
  await handlerBotones.manejar(i);
  comprobar('el dueño del servidor si puede', i.respuestas[0] === 'modal:cuentas:editar:modal');

  console.log('\nComando /cuentas');

  i = interaccion({ rol: 'admin', subcomando: 'poner', opciones: { nivel: n3.id, cantidad: 7 } });
  await comandoCuentas.execute(i);
  comprobar('/cuentas poner fija la cantidad', cuentas.getCuentas(CANAL_ID)[n3.id] === 7);

  i = interaccion({ rol: 'owner', subcomando: 'quitar', opciones: { nivel: n3.id, cantidad: 2 } });
  await comandoCuentas.execute(i);
  comprobar('/cuentas quitar resta', cuentas.getCuentas(CANAL_ID)[n3.id] === 5);

  i = interaccion({ rol: 'admin', subcomando: 'vaciar' });
  await comandoCuentas.execute(i);
  comprobar('/cuentas vaciar deja todo a cero', cuentas.totalCuentas(cuentas.getCuentas(CANAL_ID)) === 0);

  console.log('\nFicha en el canal privado');
  comprobar('se mantiene una sola ficha por ticket', mensajesRegistro.length === 1);
  comprobar(
    'la ficha apunta al ticket y al usuario',
    JSON.stringify(mensajesRegistro[0].embeds[0].toJSON()).includes('<@cliente>'),
  );

  store.borrarTicket(CANAL_ID);

  console.log(fallos === 0 ? '\n✅ Todo correcto.\n' : `\n❌ ${fallos} comprobacion(es) fallidas.\n`);
  process.exitCode = fallos === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
