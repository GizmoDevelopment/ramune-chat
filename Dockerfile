FROM node:14

RUN mkdir /dist
WORKDIR /dist

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 1337

ENV PORT=1337
ENV NODE_ENV=production

CMD [ "npm", "start" ]