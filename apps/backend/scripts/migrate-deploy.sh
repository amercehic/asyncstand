#!/bin/bash
# Production database migration script
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Verifying database connection..."
npx prisma db execute --stdin <<EOF
SELECT 1;
EOF

echo "Migrations completed successfully"