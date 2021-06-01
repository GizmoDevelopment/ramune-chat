FROM node:14

RUN mkdir dist
WORKDIR /dist

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

RUN npm install -g pm2

EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

CMD [ "pm2-runtime", "--json", "./build/index.js" ] 