'use strict';

const http = require('node:http');

/**
 * Servidor HTTP minimo. Sirve para dos cosas:
 *  - los hostings gratuitos (Render, Koyeb, Replit...) solo mantienen vivos
 *    los servicios que escuchan en un puerto;
 *  - da una URL que se puede pinguear desde fuera para que no se duerma y
 *    para enterarse si el bot se ha caido.
 *
 * Responde 200 si el bot esta conectado a Discord y 503 si no, para que el
 * monitor (o el propio hosting) note la caida y lo reinicie.
 */
function crearServidor(estado) {
  const servidor = http.createServer((req, res) => {
    const datos = estado();
    const sano = Boolean(datos.conectado);

    if (req.url === '/ping') {
      res.writeHead(sano ? 200 : 503, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(sano ? 'pong' : 'sin conexion');
      return;
    }

    res.writeHead(sano ? 200 : 503, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(datos, null, 2));
  });

  servidor.on('error', (err) => {
    console.error('[servidor] error:', err.message);
  });

  return {
    servidor,
    escuchar(puerto) {
      return new Promise((resolve, reject) => {
        // Si el puerto esta ocupado, el fallo llega por el evento 'error' y no
        // por listen: sin esto, la promesa se quedaria colgada para siempre.
        const alFallar = (err) => reject(err);
        servidor.once('error', alFallar);

        servidor.listen(puerto, '0.0.0.0', () => {
          servidor.off('error', alFallar);
          console.log(`🌐 Servidor de estado escuchando en el puerto ${servidor.address().port}`);
          resolve(servidor);
        });
      });
    },
    cerrar() {
      return new Promise((resolve) => servidor.close(resolve));
    },
  };
}

/** Formatea segundos como "2d 3h 4m 5s". */
function formatearTiempo(segundos) {
  const d = Math.floor(segundos / 86400);
  const h = Math.floor((segundos % 86400) / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = Math.floor(segundos % 60);
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ');
}

module.exports = { crearServidor, formatearTiempo };
