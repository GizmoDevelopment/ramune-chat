FROM node:14
WORKDIR /dist

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV PORT=443
EXPOSE 443

CMD [ "npm", "start" ]