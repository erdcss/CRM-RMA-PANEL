FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Web-only dependencies are installed only inside Railway's build image.
# They are intentionally not part of the iPhone Expo Go dependency graph.
RUN npm install --no-save --package-lock=false --no-audit --no-fund react-dom@19.2.3 react-native-web@0.21.4

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./package.json

EXPOSE 8080
CMD ["node", "scripts/serve-web.js"]
