FROM node:20-slim AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app

RUN addgroup -g 1001 -S appuser && adduser -S appuser -u 1001

COPY --from=builder --chown=appuser:appuser /app/dist ./dist
COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /app/package.json .

USER appuser
ENV NODE_ENV=production

ENTRYPOINT ["node", "dist/index.js"]
