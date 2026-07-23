FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine
RUN addgroup -g 1005 app && adduser -D -u 1029 -G app -h /app app
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && chown -R app:app /app
COPY --from=build --chown=app:app /app/dist ./dist

USER app
EXPOSE 8080
CMD ["node", "dist/index.js"]
