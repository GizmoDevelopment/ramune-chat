FROM node:14

RUN mkdir dist
WORKDIR /dist

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

RUN npm install -g pm2

EXPOSE 8080

ENV WEBSOCKET_PORT=8080
ENV NODE_ENV=production
ENV CORS_ORIGIN_DOMAIN=CORS_ORIGIN_DOMAIN

CMD [ "pm2-runtime", "--json", "./build/index.js" ]