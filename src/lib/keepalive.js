'use strict';

/**
 * Auto-ping: los hostings gratuitos duermen los servicios que no reciben
 * visitas (Render, por ejemplo, a los 15 minutos). Pinguearse a si mismo evita
 * que se duerma y, de paso, deja constancia en los logs de que sigue vivo.
 *
 * No sustituye a un monitor externo (UptimeRobot, cron-job.org, la accion de
 * GitHub que viene en el repo): si el servicio ya esta dormido, no puede
 * despertarse solo. Por eso conviene tener las dos cosas.
 */

/** Saca la URL publica de las variables que pone cada hosting. */
function detectarUrl(env = process.env) {
  const directa = env.KEEPALIVE_URL || env.RENDER_EXTERNAL_URL;
  if (directa) return normalizar(directa);

  if (env.RAILWAY_PUBLIC_DOMAIN) return normalizar(env.RAILWAY_PUBLIC_DOMAIN);
  if (env.KOYEB_PUBLIC_DOMAIN) return normalizar(env.KOYEB_PUBLIC_DOMAIN);
  if (env.FLY_APP_NAME) return `https://${env.FLY_APP_NAME}.fly.dev`;
  if (env.REPLIT_DEV_DOMAIN) return normalizar(env.REPLIT_DEV_DOMAIN);
  if (env.REPL_SLUG && env.REPL_OWNER) {
    return `https://${env.REPL_SLUG}.${env.REPL_OWNER}.repl.co`.toLowerCase();
  }

  return null;
}

function normalizar(url) {
  const limpia = String(url).trim().replace(/\/+$/, '');
  return /^https?:\/\//.test(limpia) ? limpia : `https://${limpia}`;
}

function iniciarKeepAlive({ url = detectarUrl(), minutos = Number(process.env.KEEPALIVE_MINUTOS) || 10 } = {}) {
  if (!url) {
    console.log('ℹ️  Auto-ping desactivado (no hay KEEPALIVE_URL). Normal si lo tienes en tu ordenador o en un VPS.');
    return null;
  }

  const destino = `${url}/ping`;
  const intervalo = Math.max(0.1, minutos) * 60 * 1000;
  let fallosSeguidos = 0;

  console.log(`🔁 Auto-ping cada ${minutos} min a ${destino}`);

  const temporizador = setInterval(async () => {
    try {
      const res = await fetch(destino, {
        method: 'GET',
        headers: { 'User-Agent': 'bot-tickets-keepalive' },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) throw new Error(`respuesta ${res.status}`);
      if (fallosSeguidos > 0) console.log('🔁 Auto-ping recuperado.');
      fallosSeguidos = 0;
    } catch (err) {
      fallosSeguidos += 1;
      // Un fallo suelto es normal (el hosting reinicia, la red parpadea);
      // solo avisamos si se repite.
      if (fallosSeguidos >= 3) {
        console.error(`⚠️  Auto-ping fallando (${fallosSeguidos} veces seguidas): ${err.message}`);
      }
    }
  }, intervalo);

  temporizador.unref?.();
  return { temporizador, destino, parar: () => clearInterval(temporizador) };
}

module.exports = { detectarUrl, normalizar, iniciarKeepAlive };
