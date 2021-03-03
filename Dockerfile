FROM node:14

RUN mkdir /dist
WORKDIR /dist

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV PORT=80
EXPOSE 80

CMD [ "npm", "start" ]