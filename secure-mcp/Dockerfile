FROM node:20-slim

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .

RUN mkdir -p /app/data

EXPOSE 3002

CMD ["node", "server.js"]
