# Development
FROM timbru31/node-chrome:24-slim AS dev
# ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
# ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_ENV development
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
CMD ["npm", "run", "dev"]
# CMD ["node", "./dist/app.js"]
# CMD ["/usr/local/bin/node", "/app/dist/app.js"]



# Build for production stage
FROM timbru31/node-chrome:24-slim AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build
RUN npm prune --production

# Production
FROM timbru31/node-chrome:24-slim AS prod
ENV NODE_ENV production
WORKDIR /app
COPY --from=build app/node_modules/ node_modules/
COPY --from=build app/package*.json .
COPY --from=build app/dist dist/
COPY --from=build app/.env.production .
CMD ["npm", "run", "start"]


