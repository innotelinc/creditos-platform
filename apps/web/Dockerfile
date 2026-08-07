# ── CreditOS Web ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# Keep the lockfile so Next.js detects the npm workspace and emits the
# workspace-nested standalone layout (apps/web/server.js).
COPY package.json package-lock.json* tsconfig.base.json ./
# npm keeps some packages (e.g. @hookform/resolvers, which declares many
# optional peer deps) nested under the workspace's own node_modules instead of
# hoisting them to the root. Preserve those from the deps stage before
# overlaying the source, otherwise the web build can't resolve them.
COPY --from=deps /app/apps ./apps
COPY apps/web ./apps/web
RUN cd apps/web && npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
