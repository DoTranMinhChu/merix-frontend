# ⚠ CHUA KIEM CHUNG BANG CACH CHAY: may dev khong co Docker (docs/DECISIONS.md ADR-018).
# Cac thu KIEM DUOC bang mat da doi chieu voi repo:
#   - `dist/server/entry.mjs` la duong dan that sau `npm run build` (adapter node mode standalone)
#   - `package.json` co `"type": "module"`, nen `node ./dist/server/entry.mjs` chay dung
#   - adapter node doc HOST/PORT, va docker-compose.yml dat ca hai

# syntax=docker/dockerfile:1.7
FROM node:22-slim AS builder
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# Tang rieng chi de lay node_modules khong co devDependencies.
#
# Vi sao can: SSR cua Astro doc `node_modules` luc chay (astro, @astrojs/node, solid-js nam trong
# `dependencies`), nen KHONG the bo han node_modules. Nhung `@types/node`, `oxlint` va `vitest`
# thi khong co viec gi trong mot container production — chung chi lam image to ra.
FROM node:22-slim AS deps
WORKDIR /deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:22-slim AS runtime
RUN useradd --system --uid 10001 merix
WORKDIR /app
COPY --from=builder /build/dist ./dist
COPY --from=deps /deps/node_modules ./node_modules
COPY --from=builder /build/package.json ./
USER merix
ENV HOST=0.0.0.0 PORT=4321 NODE_ENV=production
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
