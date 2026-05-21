FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3005

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3005

CMD ["node", "server.js"]
