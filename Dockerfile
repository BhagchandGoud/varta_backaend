FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .
RUN mkdir -p /localStorage /app/uploads \
    && chown -R node:node /app /localStorage

USER node

EXPOSE 8080
CMD ["npm", "start"]
