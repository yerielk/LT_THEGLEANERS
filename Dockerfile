# syntax=docker/dockerfile:1
# Two images from one build: `web` (Next.js standalone) and `mcp` (MCP server, also used for `npm run db:setup`).

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
# next build loads the auth module; the real secret is only needed at runtime
RUN NEXT_OUTPUT=standalone BETTER_AUTH_SECRET=build-time-placeholder-not-used-at-runtime npm run build

FROM node:24-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]

FROM deps AS mcp
WORKDIR /app
ENV NODE_ENV=production MCP_HOST=0.0.0.0
COPY --chown=node:node . .
USER node
EXPOSE 3333
CMD ["npx", "tsx", "mcp/server.ts"]
