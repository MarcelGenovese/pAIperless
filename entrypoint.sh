#!/bin/bash
set -e

echo "🚀 Starting pAIperless..."

# Wait for database directory to be available
while [ ! -d "/app/storage/database" ]; do
  echo "⏳ Waiting for storage directory..."
  sleep 1
done

echo "📁 Storage directory ready"

# Give nextjs user access to Docker socket
if [ -S /var/run/docker.sock ]; then
  echo "🐳 Configuring Docker socket access..."
  DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)
  echo "Docker socket group ID: $DOCKER_GID"

  # Add docker group if it doesn't exist
  if ! getent group docker > /dev/null 2>&1; then
    groupadd -g $DOCKER_GID docker
  fi

  # Add nextjs user to docker group
  usermod -aG docker nextjs
  echo "✅ Docker socket access granted"
fi

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

# Initialize default configuration values
echo "⚙️  Initializing default configuration..."
gosu nextjs node /app/scripts/init-config-defaults.js || echo "⚠️  Config init warning"

# Setup cron job for log cleanup (runs daily at 3 AM)
echo "⏰ Setting up cron job for log cleanup..."
echo "0 3 * * * cd /app && /usr/local/bin/node /app/scripts/cleanup-logs.js >> /app/storage/logs/cleanup-cron.log 2>&1" | crontab -u nextjs -
# Start cron service
service cron start
echo "✅ Cron job configured (daily at 3 AM)"

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
