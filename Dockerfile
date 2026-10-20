FROM node:24-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY app/client/package.json app/client/package.json
COPY app/server/package.json app/server/package.json
COPY app/shared/package.json app/shared/package.json
RUN npm ci --no-fund
COPY tsconfig.base.json ./
COPY app/client app/client
COPY app/server app/server
COPY app/shared app/shared
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production PORT=5000 DATABASE_MODE=postgres
WORKDIR /workspace
COPY --from=build --chown=node:node /workspace /workspace
RUN mkdir -p /workspace/.local && chown node:node /workspace/.local
USER node
EXPOSE 5000
CMD ["node", "app/server/dist/server.js"]
