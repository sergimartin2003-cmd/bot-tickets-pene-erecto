'use strict';

/**
 * Prueba rapida de la logica de pedidos sin conectar con Discord.
 * Uso: npm run prueba
 *
 * Simula el canal y las interacciones para comprobar que las cuentas por
 * nivel se suman, se restan, se validan y respetan los permisos.
 */

const store = require('../src/lib/store');
const pedidos = require('../src/lib/pedidos');
const handlerModales = require('../src/interactions/modales');
const handlerBotones = require('../src/interactions/botones');

const CANAL_ID = 'prueba-canal';
let fallos = 0;

function comprobar(descripcion, condicion) {
  console.log(`${condicion ? '  ✅' : '  ❌'} ${descripcion}`);
  if (!condicion) fallos += 1;
}

const mensajes = [];
const canal = {
  id: CANAL_ID,
  guild: { id: 'prueba-guild', channels: { cache: new Map(), fetch: async () => null } },
  messages: {
    fetch: async (id) => {
      const m = mensajes.find((x) => x.id === id);
      if (!m) throw new Error('mensaje no encontrado');
      return m;
    },
  },
  async send(contenido) {
    const mensaje = {
      id: `msg${mensajes.length}`,
      ...contenido,
      edit: async (nuevo) => Object.assign(mensaje, nuevo),
      pin: async () => {},
    };
    mensajes.push(mensaje);
    return mensaje;
  },
};

function interaccion({ customId, campos = {}, userId = 'autor', staff = false }) {
  const respuestas = [];
  return {
    customId,
    channelId: CANAL_ID,
    channel: canal,
    guild: canal.guild,
    user: { id: userId, tag: `${userId}#0001`, toString: () => `<@${userId}>` },
    member: {
      id: userId,
      guild: canal.guild,
      roles: { cache: new Map() },
      permissions: { has: () => staff },
    },
    fields: { getTextInputValue: (id) => campos[id] ?? '' },
    reply: async (c) => respuestas.push(typeof c === 'string' ? c : c.content),
    editReply: async (c) => respuestas.push(typeof c === 'string' ? c : c.content),
    deferReply: async () => {},
    followUp: async (c) => respuestas.push(c.content),
    showModal: async (m) => respuestas.push(`modal:${m.toJSON().custom_id}`),
    update: async (c) => respuestas.push(c.content),
    respuestas,
  };
}

async function main() {
  store.setTicket(CANAL_ID, {
    guildId: 'prueba-guild',
    usuarioId: 'autor',
    tipoId: 'compra',
    numero: 1,
    cerrado: false,
    pedido: pedidos.pedidoVacio(),
    pedidoConfirmado: false,
  });

  console.log('\nPedido de cuentas por nivel');

  const niveles = require('../src/config').niveles;
  const [n1, n2, n3] = niveles;

  let i = interaccion({
    customId: 'pedido:editar:modal',
    campos: { [`nivel:${n1.id}`]: '2', [`nivel:${n2.id}`]: '5', [`nivel:${n3.id}`]: '1' },
  });
  await handlerModales.manejar(i);
  let pedido = pedidos.getPedido(CANAL_ID);
  comprobar(
    `el modal guarda 2 / 5 / 1 (${pedidos.resumenCorto(pedido)})`,
    pedido[n1.id] === 2 && pedido[n2.id] === 5 && pedido[n3.id] === 1,
  );

  i = interaccion({ customId: `pedido:nivel:modal:${n2.id}`, campos: { cantidad: '3' } });
  await handlerModales.manejar(i);
  comprobar('sumar 3 al nivel 2 da 8', pedidos.getPedido(CANAL_ID)[n2.id] === 8);

  i = interaccion({ customId: `pedido:nivel:modal:${n2.id}`, campos: { cantidad: '-4' } });
  await handlerModales.manejar(i);
  comprobar('restar 4 al nivel 2 da 4', pedidos.getPedido(CANAL_ID)[n2.id] === 4);

  i = interaccion({ customId: `pedido:nivel:modal:${n1.id}`, campos: { cantidad: '-99' } });
  await handlerModales.manejar(i);
  comprobar('no se baja de cero', pedidos.getPedido(CANAL_ID)[n1.id] === 0);

  i = interaccion({ customId: `pedido:nivel:modal:${n3.id}`, campos: { cantidad: 'abc' } });
  await handlerModales.manejar(i);
  comprobar('una cantidad invalida se rechaza', i.respuestas[0].includes('no es un numero valido'));

  console.log('\nPrecios');
  pedidos.setPedido(CANAL_ID, { [n1.id]: 2, [n2.id]: 5, [n3.id]: 1 });
  pedido = pedidos.getPedido(CANAL_ID);
  const esperado = 2 * n1.precio + 5 * n2.precio + 1 * n3.precio;
  comprobar(`el total cuadra (${pedidos.formatearPrecio(pedidos.totalPrecio(pedido))})`, pedidos.totalPrecio(pedido) === esperado);
  comprobar('el total de cuentas es 8', pedidos.totalCuentas(pedido) === 8);

  console.log('\nPermisos');
  i = interaccion({ customId: 'pedido:editar', userId: 'intruso' });
  await handlerBotones.manejar(i);
  comprobar('un tercero no puede editar', i.respuestas[0].includes('Solo el autor'));

  i = interaccion({ customId: 'pedido:confirmar', userId: 'autor' });
  await handlerBotones.manejar(i);
  comprobar('el autor no puede confirmar', i.respuestas[0].includes('Solo el staff'));

  i = interaccion({ customId: 'pedido:confirmar', userId: 'staff', staff: true });
  await handlerBotones.manejar(i);
  comprobar('el staff si puede confirmar', store.getTicket(CANAL_ID).pedidoConfirmado === true);

  i = interaccion({ customId: 'pedido:editar', userId: 'autor' });
  await handlerBotones.manejar(i);
  comprobar('confirmado bloquea al autor', i.respuestas[0].includes('confirmado'));

  i = interaccion({ customId: 'pedido:reabrir', userId: 'staff', staff: true });
  await handlerBotones.manejar(i);
  comprobar('el staff puede reabrir el pedido', store.getTicket(CANAL_ID).pedidoConfirmado === false);

  console.log('\nMensaje del pedido');
  comprobar('solo se crea un mensaje de pedido, se reedita', mensajes.length === 1);

  store.borrarTicket(CANAL_ID);

  console.log(fallos === 0 ? '\n✅ Todo correcto.\n' : `\n❌ ${fallos} comprobacion(es) fallidas.\n`);
  process.exitCode = fallos === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
