ARG WEBSOCKET_PORT=443
ARG CORS_ORIGIN_DOMAIN=*
ARG SHOW_ENDPOINT
ARG SENTRY_DSN

FROM node:14

RUN mkdir dist
WORKDIR /dist

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

RUN npm install -g pm2

EXPOSE ${WEBSOCKET_PORT}

ENV WEBSOCKET_PORT=${WEBSOCKET_PORT}
ENV NODE_ENV=production
ENV CORS_ORIGIN_DOMAIN=${CORS_ORIGIN_DOMAIN}
ENV SENTRY_DSN=${WEBSOCKET_PORT}

CMD [ "node", "./build/index.js" ]