# docs/engineering/06-DOCKER.md §1: build multi-stage (deps -> build -> runtime), misma
# imagen base que .nvmrc (paridad dev/producción, §6). Contexto de build = raíz del
# monorepo (Nx necesita el workspace completo para resolver el grafo de dependencias del
# proyecto que construye).

FROM node:24.22.1-alpine AS deps
WORKDIR /workspace
# .npmrc: strict-allow-scripts (#152), misma politica de scripts de instalacion que local y CI.
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM node:24.22.1-alpine AS build
WORKDIR /workspace
COPY --from=deps /workspace/node_modules ./node_modules
COPY . .
# prisma.config.ts exige DATABASE_URL resoluble solo para cargar la config (§ prisma.config.ts) -
# `generate` no se conecta a ninguna base, este valor nunca se usa para abrir una conexión real.
RUN DATABASE_URL="postgresql://build:build@build:5432/build" npx prisma generate
RUN npx nx run api:build

FROM node:24.22.1-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# dist/apps/api/package.json ya viene podado por `generatePackageJson: true` del webpack de
# apps/api (solo dependencias de runtime realmente importadas, con versión exacta fijada,
# nunca las libs de tooling/build del root). Su package-lock.json generado no siempre queda
# en sync completo con ese package.json (huecos transitivos conocidos de esa opción de
# webpack) - `npm ci` lo rechaza por diseño, así que se usa `npm install` sobre versiones ya
# exactas en vez de depender de ese lockfile derivado.
# --ignore-scripts (#152): ese package.json generado no lleva `allowScripts`. Ninguna dependencia
# de runtime necesita su script: msgpackr-extract carga el binario precompilado de su paquete
# opcional por plataforma (y msgpackr cae a JS sin el), y el cliente de Prisma se copia ya
# generado. La imagen de produccion no ejecuta scripts de instalacion de terceros.
COPY --from=build /workspace/dist/apps/api/package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
# El cliente de Prisma generado (motor + tipos) no se reinstala aquí - `prisma` (CLI) es
# devDependency y queda fuera de --omit=dev; se copia el ya generado en el stage `build`,
# construido sobre la misma imagen base (mismo binary target de musl/alpine).
COPY --from=build /workspace/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /workspace/dist/apps/api/main.js ./main.js
USER node
EXPOSE 3000
CMD ["node", "main.js"]
