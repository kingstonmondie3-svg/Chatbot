# Production image for the OpenChat monorepo. Render Root Directory: openchat-master
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build && cp drizzle/dist/schema.js drizzle/schema.js

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends nginx gettext-base && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /run/nginx /var/log/nginx
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate
COPY --from=build /app /app
COPY deploy/nginx.conf /etc/nginx/templates/default.conf.template
COPY deploy/start.sh /app/deploy/start.sh
RUN chmod +x /app/deploy/start.sh
EXPOSE 10000
CMD ["/app/deploy/start.sh"]
