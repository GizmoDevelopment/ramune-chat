FROM node:16 as preparation
LABEL org.opencontainers.image.source https://github.com/GizmoDevelopment/ramune-chat
RUN curl -f https://get.pnpm.io/v6.16.js | node - add --global pnpm

WORKDIR /usr/production
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build
COPY tsconfig.json ./
COPY . ./
RUN pnpm run build

FROM node:16 as start
RUN curl -f https://get.pnpm.io/v6.16.js | node - add --global pnpm

WORKDIR /usr/production

# Set up directory
COPY --from=preparation /usr/production/package.json ./
COPY --from=preparation /usr/production/pnpm-lock.yaml ./
COPY --from=preparation /usr/production/build ./build

# Install dependencies
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

EXPOSE ${WEBSOCKET_PORT}

ENV NODE_ENV=production
ENV WEBSOCKET_PORT=${WEBSOCKET_PORT}
ENV CORS_ORIGIN_DOMAIN=${CORS_ORIGIN_DOMAIN}
ENV SENTRY_DSN=${SENTRY_DSN}
ENV BOT_TOKEN=${BOT_TOKEN}
ENV WEBSOCKET_ADMIN_USERNAME=${WEBSOCKET_ADMIN_USERNAME}
ENV WEBSOCKET_ADMIN_PASSWORD=${WEBSOCKET_ADMIN_PASSWORD}
ENV SHOW_ENDPOINT=${SHOW_ENDPOINT}

CMD [ "pnpm", "start" ]
