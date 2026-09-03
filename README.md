# Bot de tickets con registro privado de cuentas

Bot de tickets para Discord con una función extra: dentro de cada ticket hay un
**registro de las cuentas que posee el usuario**, contadas por nivel (por
ejemplo *2 de Level 1, 5 de Level 2 y 1 de Level 3*).

**Ese registro es privado.** Solo lo pueden ver y editar el **dueño del
servidor** y quien tenga el permiso de **Administrador**. Ni el usuario del
ticket ni el staff normal ven nada: no se publica en el canal, no aparece en los
logs y el comando ni siquiera les sale en la lista.

## Qué hace

- Panel con menú desplegable para abrir tickets.
- Un canal privado por ticket, visible solo para el autor, el staff y el bot.
- **Registro privado de cuentas por nivel** (la parte principal).
- Cerrar, reabrir, reclamar, añadir/quitar gente y borrar el ticket.
- Transcripción en `.txt` del ticket al cerrarlo.
- Canal de logs con aperturas y cierres.
- Límite de 3 tickets abiertos por persona.

## El registro de cuentas (Level 1 / 2 / 3)

Un administrador escribe `/cuentas ver` dentro del ticket y le sale un panel
**efímero** (un mensaje que solo ve quien lo abre, nadie más del canal):

```
🔐 Cuentas registradas
🥉 Level 1 · `2` cuenta(s) — 10€
🥈 Level 2 · `5` cuenta(s) — 50€
🥇 Level 3 · `1` cuenta(s) — 20€

Total de cuentas: 8      Valor total: 80€
Ficha: Usuario: @cliente · Ticket #12
```

Desde ese panel se edita todo:

| Cómo | Qué hace |
|---|---|
| Botón **📝 Editar cantidades** | Formulario con una casilla por nivel. Pones `2`, `5`, `1` y listo. |
| Menú **Sumar o restar cuentas** | Eliges un nivel y escribes cuántas sumar (un número negativo resta). |
| Botón **🗑️ Vaciar** | Deja todos los niveles a cero. |
| Comando `/cuentas` | `ver`, `poner`, `añadir`, `quitar` y `vaciar`. |

Cómo se mantiene privado:

- El comando `/cuentas` lleva permiso de Administrador, así que **Discord lo
  esconde** a quien no lo tenga.
- El bot vuelve a comprobar quién eres en cada clic, cada menú y cada
  formulario, por si alguien intenta saltárselo.
- Todas las respuestas son efímeras: nunca queda nada escrito en el canal del
  ticket.
- El resumen de cuentas tampoco se envía al canal de logs.

### Ficha permanente (opcional)

Si quieres tener las cuentas de todos los tickets a la vista en un sitio, crea
un canal que **solo vean los administradores** y configúralo:

```
/config canal-cuentas #fichas-cuentas
```

El bot mantiene ahí un mensaje por ticket, actualizado solo, con las cuentas, el
usuario y el enlace al ticket. Si no configuras ese canal, el registro sigue
funcionando igual y se consulta con `/cuentas ver`.

## Instalación

Necesitas [Node.js](https://nodejs.org) 18 o superior.

### 1. Crear la aplicación en Discord

1. Entra en el [Developer Portal](https://discord.com/developers/applications) y pulsa **New Application**.
2. En **Bot**, pulsa **Reset Token** y copia el token (no lo compartas con nadie).
3. En **General Information**, copia el **Application ID**.
4. En **OAuth2 > URL Generator** marca los scopes `bot` y `applications.commands`,
   y los permisos **Manage Channels**, **Manage Roles**, **Manage Messages**,
   **Send Messages**, **Embed Links**, **Attach Files** y **Read Message History**.
   Abre la URL que sale abajo e invita al bot a tu servidor.

### 2. Configurar el proyecto

```bash
npm install
cp .env.example .env
```

Abre `.env` y rellena:

```
DISCORD_TOKEN=el token del paso 2
CLIENT_ID=el application id del paso 3
GUILD_ID=el id de tu servidor
```

Para sacar el ID de tu servidor: en Discord, **Ajustes > Avanzado > Modo
desarrollador**, luego clic derecho sobre el servidor > **Copiar ID**.

### 3. Arrancar

```bash
npm start
```

Los comandos se registran solos al arrancar (`DEPLOY_ON_START=true`). También
puedes registrarlos a mano con `npm run deploy`.

### 4. Configurar en Discord

Con el bot ya dentro del servidor:

```
/config categoria           categoria donde se crean los tickets
/config categoria-cerrados  categoria a la que se mueven los cerrados
/config logs                canal donde se registran aperturas y cierres
/config canal-cuentas       canal PRIVADO con las fichas de cuentas (opcional)
/config staff               rol que puede ver y gestionar los tickets
/config ver                 comprueba como esta todo
/panel                      publica el panel para abrir tickets
```

El rol de staff hay que ponerlo antes de que se abran tickets: los permisos se
dan al crear cada canal. Y ojo con `/config canal-cuentas`: **ese canal tiene
que estar cerrado a todo el mundo menos a los administradores**, porque es el
único sitio donde las cuentas quedan escritas.

## Comandos

| Comando | Quién | Para qué |
|---|---|---|
| `/cuentas ver` | Owner y admins | Abre el panel privado de cuentas |
| `/cuentas poner` | Owner y admins | Fija cuántas cuentas posee de un nivel |
| `/cuentas añadir` | Owner y admins | Suma cuentas de un nivel |
| `/cuentas quitar` | Owner y admins | Resta cuentas de un nivel |
| `/cuentas vaciar` | Owner y admins | Pone todo a cero |
| `/panel` | Admin | Publica el panel de tickets |
| `/config ...` | Admin | Categorías, logs, canal de fichas y rol de staff |
| `/ticket cerrar` | Autor y staff | Cierra el ticket |
| `/ticket reabrir` | Staff | Vuelve a abrirlo |
| `/ticket reclamar` | Staff | Marca que tú lo atiendes |
| `/ticket añadir-usuario` | Staff | Da acceso a alguien |
| `/ticket quitar-usuario` | Staff | Le quita el acceso |
| `/ticket transcripcion` | Staff | Genera el `.txt` del ticket |

## Personalizar niveles y valores

Todo está en `config.json`, no hay que tocar código:

```json
"niveles": [
  { "id": "level1", "nombre": "Level 1", "emoji": "🥉", "valor": 5 },
  { "id": "level2", "nombre": "Level 2", "emoji": "🥈", "valor": 10 },
  { "id": "level3", "nombre": "Level 3", "emoji": "🥇", "valor": 20 }
]
```

Puedes cambiar nombres, emojis y valores, y añadir o quitar niveles (**máximo
5**, porque los formularios de Discord solo admiten 5 casillas). El comando
`/cuentas` y los menús se adaptan solos.

El `valor` es lo que vale cada cuenta de ese nivel; sirve para que el panel te
calcule el total. Si no lo quieres, pon `"valor": 0` en todos los niveles y el
bot deja de mostrar valores.

En el mismo archivo están la moneda, los colores y los tipos de ticket
(`tiposTicket`). En un tipo de ticket, `"registroCuentas": true` hace que se
cree la ficha de cuentas al abrirlo.

Después de tocar `config.json` hay que reiniciar el bot.

## Comprobar que todo funciona

```bash
npm run prueba
```

Simula un ticket entero sin conectarse a Discord: guardar cantidades, sumar,
restar, validaciones, y sobre todo que el cliente y el staff normal **no** pueden
ver ni tocar el registro, ni por comando, ni por botón, ni colando un
formulario.

## Estructura

```
config.json            niveles, valores, tipos de ticket, colores
src/index.js           arranque del bot
src/deploy-commands.js registro de los comandos slash
src/commands/          /panel /config /cuentas /ticket
src/events/            eventos de discord.js
src/interactions/      botones, menus y formularios
src/lib/cuentas.js     el registro privado de cuentas por nivel
src/lib/permisos.js    quien puede ver el registro (owner y admins)
src/lib/tickets.js     crear, cerrar, reabrir y transcripciones
src/lib/store.js       guardado en data/db.json
scripts/prueba-humo.js prueba sin conexion
```

## Notas

- Los datos se guardan en `data/db.json`. Ese archivo no se sube al repo
  (está en `.gitignore`): haz copia de seguridad si te importa el registro.
- El `.env` tampoco se sube. **Nunca compartas tu token**; si se te escapa,
  resetéalo en el Developer Portal.
