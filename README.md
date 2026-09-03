# Bot de tickets con cuentas por niveles

Bot de tickets para Discord con una función extra: dentro de cada ticket hay un
**apartado de cuentas por nivel**, donde se apunta cuántas cuentas se piden de
cada nivel (por ejemplo *2 de Level 1, 5 de Level 2 y 1 de Level 3*), con el
precio total calculado solo.

## Qué hace

- Panel con menú desplegable para abrir tickets (compra, soporte, dudas).
- Un canal privado por ticket, visible solo para el autor, el staff y el bot.
- **Apartado de cuentas por nivel** dentro del ticket (la parte principal).
- Cerrar, reabrir, reclamar, añadir/quitar gente y borrar el ticket.
- Transcripción en `.txt` del ticket al cerrarlo.
- Canal de logs con aperturas, cierres y pedidos confirmados.
- Límite de 3 tickets abiertos por persona.

## El apartado de cuentas (Level 1 / 2 / 3)

En los tickets de tipo compra aparece un mensaje fijado con el pedido:

```
🧾 Pedido de cuentas
🥉 Level 1 · `2` cuenta(s) — 10€
🥈 Level 2 · `5` cuenta(s) — 50€
🥇 Level 3 · `1` cuenta(s) — 20€

Total de cuentas: 8      Precio total: 80€
```

Se rellena de tres maneras:

| Cómo | Qué hace |
|---|---|
| Botón **📝 Editar cantidades** | Abre un formulario con una casilla por nivel. Pones `2`, `5`, `1` y listo. |
| Menú **Añadir cuentas de un nivel** | Eliges un nivel y escribes cuántas sumar (un número negativo resta). |
| Comando `/cuentas` | `añadir`, `quitar`, `poner`, `ver` y `vaciar`. |

El mensaje del pedido se reescribe solo, no se llena el canal de mensajes.

Pueden editarlo el autor del ticket y el staff. Cuando el staff pulsa
**✅ Confirmar**, el pedido se bloquea (el cliente ya no lo puede cambiar), se
avisa en el canal de logs con el total, y solo el staff puede reabrirlo.

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
/config logs                canal donde se registra todo
/config staff               rol que puede ver y gestionar los tickets
/config ver                 comprueba como esta todo
/panel                      publica el panel para abrir tickets
```

El rol de staff hay que ponerlo antes de que se abran tickets: los permisos se
dan al crear cada canal.

## Comandos

| Comando | Quién | Para qué |
|---|---|---|
| `/panel` | Admin | Publica el panel de tickets |
| `/config ...` | Admin | Categorías, logs y rol de staff |
| `/cuentas añadir` | Autor y staff | Suma cuentas de un nivel |
| `/cuentas quitar` | Autor y staff | Resta cuentas de un nivel |
| `/cuentas poner` | Autor y staff | Fija la cantidad exacta de un nivel |
| `/cuentas ver` | Todos | Muestra el pedido |
| `/cuentas vaciar` | Autor y staff | Pone todo a cero |
| `/ticket cerrar` | Autor y staff | Cierra el ticket |
| `/ticket reabrir` | Staff | Vuelve a abrirlo |
| `/ticket reclamar` | Staff | Marca que tú lo atiendes |
| `/ticket añadir-usuario` | Staff | Da acceso a alguien |
| `/ticket quitar-usuario` | Staff | Le quita el acceso |
| `/ticket transcripcion` | Staff | Genera el `.txt` del ticket |

## Personalizar niveles y precios

Todo está en `config.json`, no hay que tocar código:

```json
"niveles": [
  { "id": "level1", "nombre": "Level 1", "emoji": "🥉", "precio": 5 },
  { "id": "level2", "nombre": "Level 2", "emoji": "🥈", "precio": 10 },
  { "id": "level3", "nombre": "Level 3", "emoji": "🥇", "precio": 20 }
]
```

Puedes cambiar nombres, emojis y precios, y añadir o quitar niveles (**máximo
5**, porque los formularios de Discord solo admiten 5 casillas). El comando
`/cuentas` y los menús se adaptan solos. Si pones `"precio": 0`, no se muestra
precio para ese nivel.

En el mismo archivo están la moneda, los colores de los embeds y los tipos de
ticket (`tiposTicket`). En un tipo de ticket, `"conCuentas": true` es lo que
hace que aparezca el apartado de cuentas.

Después de tocar `config.json` hay que reiniciar el bot.

## Comprobar que todo funciona

```bash
npm run prueba
```

Simula un ticket entero (poner cantidades, sumar, restar, validaciones y
permisos) sin necesidad de conectarse a Discord.

## Estructura

```
config.json            niveles, precios, tipos de ticket, colores
src/index.js           arranque del bot
src/deploy-commands.js registro de los comandos slash
src/commands/          /panel /config /cuentas /ticket
src/events/            eventos de discord.js
src/interactions/      botones, menus y formularios
src/lib/pedidos.js     el apartado de cuentas por nivel
src/lib/tickets.js     crear, cerrar, reabrir y transcripciones
src/lib/store.js       guardado en data/db.json
scripts/prueba-humo.js prueba sin conexion
```

## Notas

- Los datos se guardan en `data/db.json`. Ese archivo no se sube al repo
  (está en `.gitignore`): haz copia de seguridad si te importan los pedidos.
- El `.env` tampoco se sube. **Nunca compartas tu token**; si se te escapa,
  resetéalo en el Developer Portal.
