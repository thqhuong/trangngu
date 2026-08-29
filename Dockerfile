FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY tsconfig.json tsconfig.server.json vite.config.ts vitest.config.ts index.html ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:22-bookworm-slim AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=8080

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      fontconfig \
      fonts-noto-cjk \
      fonts-noto-core \
      fonts-noto-extra \
      poppler-utils \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./package.json

USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["npm", "start"]
