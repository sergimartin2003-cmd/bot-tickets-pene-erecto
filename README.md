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

#### En un VPS con Docker (para tenerlo 24/7)

```bash
npm run configurar   # crea el .env
mkdir -p data
docker compose up -d --build
```

Ver los mensajes del bot: `docker compose logs -f`. Pararlo: `docker compose down`.
La carpeta `data/` guarda los paneles y las cuentas, no la borres.

#### En un VPS sin Docker

Con [pm2](https://pm2.keymetrics.io) se queda corriendo aunque cierres la sesión:

```bash
npm install
npm run configurar
npm install -g pm2
pm2 start src/index.js --name bot-tickets
pm2 save && pm2 startup    # para que vuelva solo si se reinicia el servidor
```

#### En un hosting tipo Railway o Render

Sube el repo y define estas variables de entorno en el panel del hosting
(`DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `DEPLOY_ON_START=true`). El comando de
arranque es `npm start`. Asegúrate de que la carpeta `data/` sea persistente, o
perderás los paneles y las cuentas en cada despliegue.

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
scripts/configurar.js  asistente que crea el .env
scripts/prueba-humo.js prueba sin conexion
```

## Notas

- Todo se guarda en `data/db.json`: botones del panel, cuentas e historial. Ese
  archivo no se sube al repo (está en `.gitignore`), haz copia si te importa.
- El `.env` tampoco se sube. **Nunca compartas tu token**; si se te escapa,
  resetéalo en el Developer Portal.
