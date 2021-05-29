FROM node:14

RUN npm ci

RUN npm run build
WORKDIR /build

EXPOSE 1337

ENV PORT=1337
ENV NODE_ENV=production

CMD [ "npm", "start:production" ] 