#!/bin/bash
set -e

echo "🚀 Starting pAIperless (Development Mode)..."

# Wait for database directory
while [ ! -d "/app/storage/database" ]; do
  echo "⏳ Waiting for storage directory..."
  sleep 1
done

echo "📁 Storage directory ready"

# Run Prisma migrations
echo "🔄 Running database migrations..."
npx prisma migrate deploy 2>/dev/null || echo "⚠️  Migration warning (normal on first run)"

# Generate Prisma client (in case schema changed)
echo "🔨 Generating Prisma client..."
npx prisma generate

echo "✅ Database ready"
echo "🌐 Starting Next.js dev server on port 3000..."
echo "📝 Hot reload enabled - edit files and see changes instantly!"

exec "$@"
