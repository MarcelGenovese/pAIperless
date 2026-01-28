#!/bin/bash
set -e

echo "🚀 Starting pAIperless..."

# Wait for database directory to be available
while [ ! -d "/app/storage/database" ]; do
  echo "⏳ Waiting for storage directory..."
  sleep 1
done

echo "📁 Storage directory ready"

# Fix permissions as root (we start as root for this)
echo "🔧 Setting directory permissions..."
chown -R nextjs:nodejs /app/storage
chmod -R 775 /app/storage
# Give consume folder full write permissions (must be after general chmod)
chmod -R 777 /app/storage/consume /app/storage/processing /app/storage/error
echo "✅ Permissions: consume/processing/error = 777, others = 775"

# Run Prisma migrations as nextjs user
echo "🔄 Running database migrations..."
gosu nextjs node /app/node_modules/prisma/build/index.js migrate deploy || echo "⚠️  Migration warning (this is normal on first run)"

echo "✅ Database ready"

# Start services in background (after delay to allow Next.js to start)
(
  echo "⏳ Waiting for Next.js server to start..."
  sleep 15
  echo "🔧 Initializing services (FTP, Worker)..."
  curl -s -X POST http://localhost:3000/api/services/init || echo "⚠️  Service init will retry on first request"
) &

# Start Next.js server as nextjs user
echo "🌐 Starting web server on port 3000..."
exec gosu nextjs "$@"
