# ---------- build ----------
FROM oven/bun:1 AS builder
WORKDIR /app

# Copia só o manifesto primeiro (melhor cache)
COPY package.json ./

# Resolve as dependências do npm público
RUN rm -f bun.lock && bun install --registry https://registry.npmjs.org

COPY . .
RUN bun run build

# ---------- runtime ----------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.mjs ./server.mjs
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["node", "server.mjs"]