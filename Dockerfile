# Development
# To guarantee exact same image, pull its immutable SHA256 digest.
FROM timbru31/node-chrome:24-slim@sha256:37af0ee88b22ac0698d2af58089b1c6df5100f9fa402ac11e38b6581f155145a AS dev
# ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
# ENV PUPPETEER_SKIP_DOWNLOAD=true
# ENV NODE_ENV development
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
# CMD ["npm", "run", "dev"]
# To prevent npm error command failed && pm error signal SIGTERM
CMD ["./node_modules/.bin/dotenvx", "run", "-f", ".env.production", "--", "node", "--watch", "./src/app.js"]
# CMD ["node", "./dist/app.js"]
# CMD ["/usr/local/bin/node", "/app/dist/app.js"]



# Build for production stage
FROM timbru31/node-chrome:24-slim@sha256:37af0ee88b22ac0698d2af58089b1c6df5100f9fa402ac11e38b6581f155145a AS build
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
RUN npm prune --production

# Production
FROM timbru31/node-chrome:24-slim@sha256:37af0ee88b22ac0698d2af58089b1c6df5100f9fa402ac11e38b6581f155145a AS prod
# ENV NODE_ENV production
WORKDIR /app
COPY --from=build app/node_modules/ node_modules/
COPY --from=build app/package*.json .
COPY --from=build app/dist dist/
COPY --from=build app/.env.production .
CMD ["npm", "run", "start"]