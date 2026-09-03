'use strict';

/**
 * Supervisor: mantiene el bot vivo aunque el proceso se muera.
 * Uso: npm run siempre
 *
 * Si el bot termina mal (una excepcion, el vigilante forzando un reinicio, el
 * hosting matando el proceso), lo vuelve a arrancar esperando cada vez un poco
 * mas, para no entrar en un bucle de reinicios si el fallo es de configuracion.
 *
 * En Docker, pm2 o un hosting con reinicio automatico esto sobra: usa
 * `npm start` y deja que reinicie el de fuera.
 */

const { spawn } = require('node:child_process');
const path = require('node:path');

const OBJETIVO = process.argv[2] || path.join(__dirname, '..', 'src', 'index.js');

const ESPERA_INICIAL = 2000;
const ESPERA_MAXIMA = 60000;
// Si aguanta mas de un minuto damos por buena la arrancada y volvemos a
// empezar la cuenta de esperas.
const VIVO_SUFICIENTE = 60000;

let espera = ESPERA_INICIAL;
let reinicios = 0;
let hijo = null;
let parando = false;

function arrancar() {
  const arrancadoEn = Date.now();
  hijo = spawn(process.execPath, [OBJETIVO], { stdio: 'inherit' });

  hijo.on('exit', (codigo, senal) => {
    hijo = null;
    if (parando) return;

    const vivido = Date.now() - arrancadoEn;

    if (codigo === 0) {
      console.log('\n[supervisor] El bot se ha cerrado limpiamente. No lo reinicio.');
      process.exit(0);
    }

    if (vivido >= VIVO_SUFICIENTE) {
      espera = ESPERA_INICIAL;
    }

    reinicios += 1;
    const motivo = senal ? `señal ${senal}` : `codigo ${codigo}`;
    console.error(
      `\n[supervisor] El bot se ha caido (${motivo}) tras ${Math.round(vivido / 1000)}s. ` +
        `Reinicio nº ${reinicios} en ${Math.round(espera / 1000)}s...\n`,
    );

    setTimeout(arrancar, espera);
    espera = Math.min(espera * 2, ESPERA_MAXIMA);
  });

  hijo.on('error', (err) => {
    console.error('[supervisor] no he podido arrancar el bot:', err.message);
  });
}

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    parando = true;
    console.log('\n[supervisor] Parando...');
    if (hijo) hijo.kill(senal);
    process.exit(0);
  });
}

console.log('[supervisor] Vigilando el bot. Se reiniciara solo si se cae.\n');
arrancar();
