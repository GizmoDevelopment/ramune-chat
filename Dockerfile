FROM node:14
WORKDIR /dist

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV PORT=8080
EXPOSE 8080

CMD [ "npm", "start" ]