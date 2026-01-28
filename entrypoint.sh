#!/bin/bash
set -e

echo "🚀 Starting pAIperless..."

# Wait for database directory to be available
while [ ! -d "/app/storage/database" ]; do
  echo "⏳ Waiting for storage directory..."
  sleep 1
done

echo "📁 Storage directory ready"

# Run Prisma migrations
echo "🔄 Running database migrations..."
node /app/node_modules/prisma/build/index.js migrate deploy || echo "⚠️  Migration warning (this is normal on first run)"

echo "✅ Database ready"

# Start Next.js server
echo "🌐 Starting web server on port 3000..."
exec "$@"
