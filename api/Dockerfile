# --- Build stage ---
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@11.16.0 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/backend/prisma ./packages/backend/prisma/
RUN pnpm approve-builds argon2 esbuild @swc/core @parcel/watcher @prisma/engines prisma unrs-resolver 2>/dev/null || true
RUN pnpm install --frozen-lockfile --filter todo-backend

COPY packages/backend/ ./packages/backend/
WORKDIR /app/packages/backend
RUN npx prisma generate
RUN npx nest build

# --- Production stage ---
FROM node:22-alpine
# tsx ya instalado: el seed no descarga nada al arrancar
RUN npm install -g tsx@4.23.13
RUN corepack enable && corepack prepare pnpm@11.16.0 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/backend/prisma ./packages/backend/prisma/
RUN pnpm approve-builds argon2 esbuild @swc/core @parcel/watcher @prisma/engines prisma unrs-resolver 2>/dev/null || true
RUN pnpm install --frozen-lockfile --filter todo-backend --prod

COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/backend/generated ./packages/backend/generated
COPY packages/backend/prisma7.config.ts ./packages/backend/

ENV NODE_ENV=production
EXPOSE 3060
CMD ["node", "packages/backend/dist/src/main.js"]
