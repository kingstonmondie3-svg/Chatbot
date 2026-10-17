
#!/bin/sh
set -eu

cd /app

: "${PORT:=10000}"
: "${HOST:=0.0.0.0}"
export PORT

# Do not start the app if the database URL is missing.
: "${DATABASE_URL:?DATABASE_URL is missing in Render Environment}"

echo "Setting up database tables..."
pnpm db:push
echo "Database setup completed."

# Start the API on its internal port.
PORT=3001 node /app/apps/server/dist/index.js &
API_PID=$!

# Configure nginx for Render's public port.
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
nginx -g 'daemon off;' &
NGINX_PID=$!

trap 'kill "$API_PID" "$NGINX_PID" 2>/dev/null || true' INT TERM EXIT
wait "$NGINX_PID"
