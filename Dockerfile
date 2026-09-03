FROM node:22-alpine

WORKDIR /app

# Las dependencias primero: asi Docker no las reinstala cada vez que cambia el codigo.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# La memoria del bot (botones del panel, cuentas, historial) vive aqui, y
# tiene que poder escribirla el usuario "node".
RUN mkdir -p /app/data && chown -R node:node /app/data
VOLUME ["/app/data"]

USER node

CMD ["node", "src/index.js"]
