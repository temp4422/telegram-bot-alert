# Development
FROM timbru31/node-chrome:24-slim AS dev
# ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
# ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_ENV development
WORKDIR /app
# Docker cache logic:
# Layer cache is invalidated only if files used in that layer change.
# Any source change → cache invalidated → npm install runs again.
# Copy package*.json first, run npm install, then copy the rest of the files so Docker caches dependencies unless they change.
COPY package*.json .
# Now npm install runs only when dependencies change.
RUN npm install
# Check alternative RUN --mount=type=cache,target=/root/.npm npm install
COPY . .
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