#!/bin/bash
# Test FTP Connection Script

echo "=== Testing FTP Connection ==="
echo ""
echo "Starting FTP server in background..."

# Start FTP server in background
npx tsx scripts/test-ftp.ts > /tmp/ftp-server.log 2>&1 &
FTP_PID=$!

echo "FTP Server PID: $FTP_PID"
echo "Waiting for server to start..."
sleep 5

# Check if server is running
if ps -p $FTP_PID > /dev/null; then
    echo "✅ FTP server is running"
    echo ""

    # Try to list files using curl
    echo "Testing FTP connection with curl..."
    curl -v --user paiperless:test123 ftp://localhost:2121/ 2>&1 | head -30

    echo ""
    echo "=== FTP Server Log ==="
    tail -20 /tmp/ftp-server.log

    echo ""
    echo "Stopping FTP server..."
    kill $FTP_PID
    wait $FTP_PID 2>/dev/null
    echo "✅ FTP server stopped"
else
    echo "❌ FTP server failed to start"
    cat /tmp/ftp-server.log
    exit 1
fi
