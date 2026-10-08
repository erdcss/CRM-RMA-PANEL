# Railway Business Mobile web build
FROM node:22-bookworm-slim AS build
WORKDIR /app

# During Expo SDK upgrades package.json may change before the lock file is
# regenerated locally. Railway must still be able to build the web preview,
# so install from package.json and refresh the lock in the build container.
COPY package.json package-lock.json ./
RUN npm install --include=dev --no-audit --no-fund

COPY . .
RUN npm run build
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts ./scripts

EXPOSE 8080
CMD ["npm", "run", "start:web"]
