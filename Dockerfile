FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine
ARG GOGS_MCP_UID=1029
ARG GOGS_MCP_GID=1005
RUN addgroup -g "$GOGS_MCP_GID" app && adduser -D -u "$GOGS_MCP_UID" -G app -h /app app
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && mkdir -p logs && chown -R app:app /app
COPY --from=build --chown=app:app /app/dist ./dist

USER app
EXPOSE 8080
CMD ["node", "dist/index.js"]
