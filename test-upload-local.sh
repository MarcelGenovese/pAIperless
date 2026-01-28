#!/bin/bash

echo "=== Testing Upload Flow ==="
echo ""

# Create test PDF
echo "PDF test content" > /tmp/test.pdf

# 1. Test authentication endpoint
echo "1. Testing /api/test-auth..."
curl -s -b cookies.txt http://localhost:3001/api/test-auth | jq '.' || echo "Failed"
echo ""

# 2. Try upload with cookies
echo "2. Testing /api/documents/upload with cookies..."
curl -v -b cookies.txt -X POST http://localhost:3001/api/documents/upload \
  -F "files=@/tmp/test.pdf" 2>&1 | grep -E "(< HTTP|authenticated|error|success)"
echo ""

# 3. Check middleware logs
echo "3. Check your terminal where 'npm run dev' runs for [Middleware] and [Upload] logs"
