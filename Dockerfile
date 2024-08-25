# Environment setup
FROM node:20.17.0-alpine
LABEL org.opencontainers.image.source https://github.com/GizmoDevelopment/ramune-chat
WORKDIR /opt/production

RUN npm i -g npm@latest pnpm

# Dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm fetch

ADD . ./
RUN pnpm install --offline

# Build
RUN pnpm build
RUN pnpm prune --prod

# Deploy
ENV NODE_ENV=production
ENV WEBSOCKET_PORT=${WEBSOCKET_PORT}
ENV CORS_ORIGIN_DOMAIN=${CORS_ORIGIN_DOMAIN}
ENV SENTRY_DSN=${SENTRY_DSN}
ENV BOT_TOKEN=${BOT_TOKEN}
ENV WEBSOCKET_ADMIN_USERNAME=${WEBSOCKET_ADMIN_USERNAME}
ENV WEBSOCKET_ADMIN_PASSWORD=${WEBSOCKET_ADMIN_PASSWORD}
ENV SHOW_ENDPOINT=${SHOW_ENDPOINT}

EXPOSE ${WEBSOCKET_PORT}	

CMD [ "pnpm", "start" ]
