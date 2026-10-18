# CHUA KIEM CHUNG: may dev chua co Docker (ADR-018).

FROM node:22-slim AS builder
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-slim AS runtime
RUN useradd --system --uid 10001 merix
WORKDIR /app
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/package.json ./
USER merix
ENV HOST=0.0.0.0 PORT=4321
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
