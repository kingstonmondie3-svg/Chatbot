#!/bin/sh
set -eu
: "${PORT:=10000}"
: "${HOST:=0.0.0.0}"
export PORT
# Start the API on its internal port; nginx exposes the public Render port.
PORT=3001 node /app/apps/server/dist/index.js &
API_PID=$!
# Render's nginx package doesn't automatically template configs; render the PORT placeholder.
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
nginx -g 'daemon off;' &
NGINX_PID=$!
trap 'kill "$API_PID" "$NGINX_PID" 2>/dev/null || true' INT TERM EXIT
wait "$NGINX_PID"
