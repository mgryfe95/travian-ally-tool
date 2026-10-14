FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates poppler-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json .npmrc ./
COPY prisma ./prisma
RUN npm ci && npx prisma generate

FROM deps AS build
COPY . .
# Beim Build werden nur Platzhalter-Werte gebraucht (die echte Konfiguration kommt zur Laufzeit aus der .env).
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build AUTH_SECRET=build-only-build-only-build-only TRAVIAN_SERVER_URL=https://example.invalid APP_URL=http://localhost:3000 npm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
