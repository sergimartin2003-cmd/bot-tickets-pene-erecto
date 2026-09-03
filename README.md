# Bot de tickets

Bot de tickets para Discord con paneles de **botones clickables** que tú mismo
creas desde un menú, tickets **privados** y un registro de cuentas por nivel
que solo ven los administradores.

## Qué hace

- **Menú para crear los paneles**: creas los botones que quieras (Dudas,
  Soporte, lo que sea) desde Discord, sin tocar archivos, y publicas el panel
  donde quieras.
- **Tickets privados**: cada ticket es un canal que solo ven quien lo abre, el
  staff y los administradores. Nadie más.
- **Botón de cerrar** dentro de cada ticket, con confirmación.
- **Registro de cuentas por nivel** (Level 1 / 2 / 3): solo sumar y restar, sin
  precios ni nada de dinero. Privado para owner y administradores.
- **Memoria**: las cuentas y el historial de tickets de cada persona se guardan
  y siguen ahí aunque el ticket se cierre o se borre.
- Reclamar tickets, añadir o quitar gente, transcripción en `.txt` y canal de
  logs.
- **Siempre activo**: página de estado, auto-ping, reinicio automático si pierde
  la conexión y respaldo de la memoria, para aguantar en hostings gratuitos.

## El menú de paneles

Escribes `/panel` y sale un menú (solo lo ves tú):

```
🛠️ Menu de paneles
Botones (3/10)
1. 🛠️ Soporte (soporte) — Problemas con el servidor
2. ❓ Dudas   (dudas)   — Preguntas generales
3. 📌 Otros   (otros)   — Cualquier otra cosa

Se publicara en: #abrir-ticket

[➕ Crear boton]  [📤 Publicar panel]  [🔄 Actualizar]
[Borrar un boton...            ▾]
```

- **➕ Crear botón** abre un formulario: nombre, emoji, descripción, el mensaje
  que verá la gente al abrir ese ticket, y el color (azul, gris, verde o rojo).
- **Borrar un botón** es el desplegable de abajo.
- **📤 Publicar panel** te pide un título y un texto, y suelta el panel en el
  canal. Cada botón abre su tipo de ticket.

Para publicarlo en otro canal: `/panel canal:#abrir-ticket`.

Si cambias los botones después de publicar, vuelve a publicar el panel para que
salgan los nuevos.

## Cómo se abre un ticket

La gente pulsa un botón del panel → le sale un formulario para contar qué
necesita (opcional) → se le crea su canal privado con el botón **🔒 Cerrar
ticket** dentro.

El canal lo ven: quien lo abrió, el rol de staff que hayas configurado y los
administradores. `@everyone` lo tiene bloqueado.

Cerrarlo puede quien lo abrió o el staff. Al cerrarse, quien lo abrió deja de
verlo, el canal se mueve a la categoría de cerrados (si la configuras) y el
staff se queda con los botones de **Reabrir**, **Transcripción** y **Borrar
canal**.

## El registro de cuentas (Level 1 / 2 / 3)

Apunta cuántas cuentas de cada nivel tiene una persona. **Solo sumar y restar.**

Un administrador escribe `/cuentas ver` dentro de un ticket (o
`/cuentas ver usuario:@alguien` en cualquier sitio) y le sale un panel efímero,
que solo ve él:

```
🔐 Cuentas registradas
🥉 Level 1 · `2` cuenta(s)
🥈 Level 2 · `5` cuenta(s)
🥇 Level 3 · `1` cuenta(s)

Usuario: @cliente          Total: 8 cuenta(s)
Tickets abiertos en total: 3
  #12 Dudas · 03/09/2026 · cerrado
  ...

[Sumar o restar cuentas de un nivel... ▾]
[📝 Editar cantidades] [🗑️ Vaciar] [🔄 Actualizar]
```

| Cómo | Qué hace |
|---|---|
| **📝 Editar cantidades** | Formulario con una casilla por nivel: pones `2`, `5`, `1`. |
| **Menú de nivel** | Eliges un nivel y escribes cuántas sumar (negativo resta). |
| `/cuentas añadir` / `quitar` / `poner` / `vaciar` | Lo mismo por comando. |

Las cuentas se guardan **por persona**, no por ticket: si mañana abre otro
ticket, sus cuentas siguen ahí.

### Por qué es privado de verdad

- `/cuentas` lleva permiso de Administrador, así que **Discord ni se lo enseña**
  al cliente ni al staff.
- El bot comprueba quién eres otra vez en cada botón, menú y formulario.
- Todas las respuestas son efímeras: no queda nada escrito en el canal.
- El resumen de cuentas no se manda al canal de logs (que sí ve el staff).

Si quieres tenerlas todas a la vista, crea un canal que solo vean los admins y
haz `/config canal-cuentas #ese-canal`: el bot mantiene ahí una ficha por
persona, actualizada sola.

## Lanzarlo

Necesitas [Node.js](https://nodejs.org) 18 o superior.

### Paso 1: crear el bot en Discord

1. Entra en el [Developer Portal](https://discord.com/developers/applications) y pulsa **New Application**.
2. En **Bot**, pulsa **Reset Token** y copia el token. **No se lo enseñes a nadie**: con él, cualquiera controla tu bot.
3. En **OAuth2 > URL Generator** marca los scopes `bot` y `applications.commands`, y los permisos
   **Manage Channels**, **Manage Roles**, **Manage Messages**, **Send Messages**, **Embed Links**,
   **Attach Files** y **Read Message History**.
4. Abre la URL que sale abajo del todo e invita al bot a tu servidor.

Te hará falta también el ID de tu servidor: en Discord, **Ajustes > Avanzado > Modo desarrollador**,
y luego clic derecho sobre el servidor > **Copiar ID**.

### Paso 2: arrancarlo

Elige según dónde lo quieras tener.

#### En tu ordenador (lo más rápido para probar)

**Windows**: doble clic en **`start.bat`**. Instala lo que haga falta, te pregunta el token y arranca.

**Linux o macOS**:

```bash
./start.sh
```

El bot funciona mientras esa ventana esté abierta. Si la cierras, se apaga.

Si prefieres hacerlo a mano:

```bash
npm install
npm run configurar   # te pregunta el token y crea el .env
npm start
```

#### En un servidor, para tenerlo 24/7

Mira el apartado **[Que esté siempre activo](#que-esté-siempre-activo)**: ahí están
Render gratis, Docker y pm2, con lo que hace falta para que no se caiga ni se duerma.

### Paso 3: dejarlo listo en Discord

Cuando arranque verás algo así:

```
✅ 4 comandos registrados en el servidor 123456789...
✅ Conectado como MiBot#1234
   Servidores: 1 · Comandos: 4
```

Ahora, dentro de Discord:

```
/config categoria           categoria donde se crean los tickets
/config staff               rol que puede ver y gestionar los tickets
/config logs                canal donde se registran aperturas y cierres
/config categoria-cerrados  categoria a la que se mueven los cerrados (opcional)
/config canal-cuentas       canal PRIVADO con las fichas de cuentas (opcional)
/config ver                 comprueba como esta todo
/panel                      menu para crear los botones y publicar el panel
```

El rol de staff ponlo **antes** de que se abran tickets: los permisos se dan al
crear cada canal.

### Si algo falla al arrancar

| Lo que ves | Qué pasa |
|---|---|
| `el DISCORD_TOKEN del .env no es valido` | Vuelve a copiar el token del Developer Portal (Bot > Reset Token) y repite `npm run configurar`. |
| `no tengo permiso para registrar comandos` | Invita al bot otra vez con el scope `applications.commands`, o revisa que el GUILD_ID sea el correcto. |
| `CLIENT_ID o GUILD_ID incorrectos` | Cópialos otra vez: el Application ID está en General Information; el del servidor, con clic derecho > Copiar ID. |
| Los comandos no salen en Discord | Si dejaste el GUILD_ID vacío, Discord tarda hasta 1 hora. Rellénalo y reinicia. |
| `No he podido crear el canal` | Al bot le faltan **Gestionar canales** y **Gestionar roles**, o la categoría configurada ya no existe. |

## Que esté siempre activo

Los hostings gratuitos **duermen** los servicios que no reciben visitas (Render,
por ejemplo, a los 15 minutos) y **reinician** los contenedores cuando les
apetece. El bot trae cuatro cosas para aguantar eso:

| Qué | Para qué |
|---|---|
| Página de estado (`/` y `/ping`) | El hosting ve que hay algo escuchando y no mata el servicio. Responde `200` si el bot está conectado a Discord y `503` si no, así el monitor se entera de las caídas. |
| Auto-ping | El bot se visita a sí mismo cada 10 minutos para no dormirse. Detecta solo su URL en Render, Railway, Koyeb, Fly y Replit. |
| Vigilante | Si Discord no vuelve en 5 minutos, mata el proceso a propósito para que el hosting lo arranque limpio. Los cortes normales los arregla discord.js solo. |
| Respaldo | Sube la memoria (paneles, cuentas, historial) a un canal privado de Discord y la recupera al arrancar si el disco se ha borrado. |

Un servicio ya dormido no puede despertarse solo, así que hace falta **alguien
que lo llame desde fuera**. Tienes tres opciones gratis (con una basta):

- **La que ya viene en el repo**: `.github/workflows/keepalive.yml` hace ping cada
  10 minutos. Solo tienes que crear la variable: en GitHub, **Settings > Secrets
  and variables > Actions > Variables > New repository variable**, nombre
  `KEEPALIVE_URL` y valor la URL de tu bot. Ojo: GitHub apaga los workflows
  programados si el repo pasa 60 días sin actividad.
- **[UptimeRobot](https://uptimerobot.com)**: monitor HTTP(s) a `https://tu-bot/ping`
  cada 5 minutos. Es el más fiable de los tres y además te avisa si se cae.
- **[cron-job.org](https://cron-job.org)**: lo mismo, sin cuenta de pago.

### Desplegar gratis en Render

1. Sube el repo a GitHub (ya lo tienes).
2. En [Render](https://render.com): **New > Blueprint**, elige el repo. El archivo
   `render.yaml` ya lo deja configurado.
3. Rellena las variables que te pida: `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` y
   `RESPALDO_CANAL_ID`.
4. Cuando termine el despliegue, copia la URL (algo como
   `https://bot-tickets.onrender.com`) y mete esa URL en UptimeRobot o en la
   variable `KEEPALIVE_URL` de GitHub.

**Lo que tienes que saber del plan gratuito de Render:** da 750 horas al mes, que
llegan justas para un servicio encendido todo el mes, y **no tiene disco
persistente**. Por eso el respaldo no es opcional aquí: sin él, cada reinicio te
deja sin paneles ni cuentas. Aun con todo, un servicio gratis dormido tarda unos
30 segundos en despertar, así que puede haber ratos en que el bot no responda al
instante.

### El canal de respaldo

1. Crea un canal privado que solo veas tú (por ejemplo `#respaldo-bot`).
2. Clic derecho > **Copiar ID**.
3. Ponlo en la variable `RESPALDO_CANAL_ID` (en el `.env` o en el panel del hosting).

El bot sube ahí un `db.json` cada 6 horas (`RESPALDO_HORAS` lo cambia), y también
justo antes de apagarse cuando el hosting le avisa. Al arrancar, si no encuentra
memoria en el disco, se baja el último respaldo. Ese archivo lleva **toda la base
de datos**: no lo dejes en un canal que vea gente.

### Con Docker (VPS)

```bash
npm run configurar
mkdir -p data
docker compose up -d --build
```

`restart: unless-stopped` ya lo levanta solo si se cae o si reinicias la máquina.
Los logs: `docker compose logs -f`.

### Con pm2 (VPS sin Docker)

```bash
npm install && npm run configurar
npm install -g pm2
pm2 start src/index.js --name bot-tickets
pm2 save && pm2 startup
```

### Sin nada de lo anterior

```bash
npm run siempre
```

Arranca el bot bajo un supervisor propio: si el proceso se muere, lo vuelve a
levantar esperando cada vez un poco más (2s, 4s, 8s... hasta 1 minuto) para no
entrar en bucle si el fallo es de configuración. Con Docker o pm2 no hace falta.

### Ver cómo está

Abre la URL del bot en el navegador:

```json
{
  "conectado": true,
  "estado": "listo",
  "bot": "MiBot#1234",
  "servidores": 1,
  "latencia": "42 ms",
  "enPie": "3d 4h 12m 8s"
}
```

## Comandos

| Comando | Quién | Para qué |
|---|---|---|
| `/panel` | Admin | Menú para crear botones y publicar el panel |
| `/config ...` | Admin | Categorías, logs, rol de staff, canal de fichas |
| `/cuentas ver` | Owner y admins | Panel privado de cuentas |
| `/cuentas añadir` | Owner y admins | Suma cuentas de un nivel |
| `/cuentas quitar` | Owner y admins | Resta cuentas de un nivel |
| `/cuentas poner` | Owner y admins | Fija la cantidad exacta |
| `/cuentas vaciar` | Owner y admins | Pone todo a cero |
| `/ticket cerrar` | Autor y staff | Cierra el ticket |
| `/ticket reabrir` | Staff | Vuelve a abrirlo |
| `/ticket reclamar` | Staff | Marca que tú lo atiendes |
| `/ticket añadir-usuario` | Staff | Da acceso a alguien |
| `/ticket quitar-usuario` | Staff | Le quita el acceso |
| `/ticket transcripcion` | Staff | Genera el `.txt` del ticket |

## Cambiar los niveles

Los niveles están en `config.json`:

```json
"niveles": [
  { "id": "level1", "nombre": "Level 1", "emoji": "🥉" },
  { "id": "level2", "nombre": "Level 2", "emoji": "🥈" },
  { "id": "level3", "nombre": "Level 3", "emoji": "🥇" }
]
```

Puedes cambiar nombres y emojis, y añadir o quitar niveles (**máximo 5**, porque
los formularios de Discord solo admiten 5 casillas). El comando `/cuentas` y los
menús se adaptan solos. Hay que reiniciar el bot después de tocarlo.

En `tiposPorDefecto` están los botones con los que arranca un servidor nuevo,
pero no hace falta tocarlo: se gestionan desde `/panel`.

## Comprobar que funciona

```bash
npm run prueba
```

Simula el bot entero sin conectarse a Discord: crear y borrar botones, publicar
el panel, abrir tickets, sumar y restar cuentas, la memoria, y que el cliente y
el staff **no** pueden ver el registro ni por comando, ni por botón, ni colando
un formulario.

## Estructura

```
start.bat / start.sh   arrancar con doble clic (Windows) o ./start.sh
Dockerfile             para levantarlo en un VPS con docker compose
config.json            niveles y botones por defecto
src/index.js           arranque del bot
src/deploy-commands.js registro de los comandos slash
src/commands/          /panel /config /cuentas /ticket
src/events/            eventos de discord.js
src/interactions/      botones, menus y formularios
src/lib/panel.js       paneles de botones y menu de gestion
src/lib/cuentas.js     registro privado de cuentas por nivel
src/lib/permisos.js    quien puede ver el registro (owner y admins)
src/lib/tickets.js     crear, cerrar, reabrir y transcripciones
src/lib/store.js       memoria: data/db.json
src/servidor.js        pagina de estado (/ y /ping)
src/lib/keepalive.js   auto-ping para no dormirse
src/lib/vigilante.js   reinicia si Discord no vuelve
src/lib/respaldo.js    copia de la memoria en un canal privado
scripts/configurar.js  asistente que crea el .env
scripts/supervisor.js  relanza el bot si se cae
scripts/prueba-humo.js prueba sin conexion
```

## Notas

- Todo se guarda en `data/db.json`: botones del panel, cuentas e historial. Ese
  archivo no se sube al repo (está en `.gitignore`), haz copia si te importa.
- El `.env` tampoco se sube. **Nunca compartas tu token**; si se te escapa,
  resetéalo en el Developer Portal.
