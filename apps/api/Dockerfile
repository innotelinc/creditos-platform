# ── CreditOS API ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.base.json ./
COPY apps/api ./apps/api
RUN cd apps/api && npx prisma generate && npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Copy the full workspace tree (node_modules includes devDeps so the seed can
# run via ts-node; dist contains the compiled NestJS app).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.base.json ./tsconfig.base.json
WORKDIR /app/apps/api

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && if [ \"$RUN_SEED\" = \"true\" ]; then npx ts-node --transpile-only prisma/seed.ts; fi && node dist/src/main.js"]
