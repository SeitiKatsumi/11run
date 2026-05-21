FROM node:22-alpine

WORKDIR /app

ARG CAPROVER_GIT_COMMIT_SHA=local

ENV NODE_ENV=production
ENV PORT=3005
ENV APP_VERSION=${CAPROVER_GIT_COMMIT_SHA}

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3005

CMD ["node", "server.js"]
