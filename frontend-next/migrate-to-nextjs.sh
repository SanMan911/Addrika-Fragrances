#!/bin/bash

# Switch from React to Next.js Frontend
# This script replaces the current React frontend with Next.js

echo "==================================="
echo "Addrika Frontend Migration Script"
echo "React -> Next.js"
echo "==================================="

# Step 1: Stop current frontend
echo ""
echo "Step 1: Stopping current frontend..."
sudo supervisorctl stop frontend

# Step 2: Backup current frontend
echo ""
echo "Step 2: Backing up current frontend..."
mv /app/frontend /app/frontend-react-backup
echo "Backup created at /app/frontend-react-backup"

# Step 3: Move Next.js to frontend location
echo ""
echo "Step 3: Moving Next.js frontend..."
mv /app/frontend-next /app/frontend

# Step 4: Create .env file
echo ""
echo "Step 4: Creating environment file..."
cat > /app/frontend/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://incense-retail.preview.emergentagent.com
EOF

# Step 5: Update supervisor config for Next.js
echo ""
echo "Step 5: Updating supervisor configuration..."
cat > /etc/supervisor/conf.d/frontend.conf << 'EOF'
[program:frontend]
command=yarn start -p 3000
directory=/app/frontend
autostart=true
autorestart=true
stderr_logfile=/var/log/supervisor/frontend.err.log
stdout_logfile=/var/log/supervisor/frontend.out.log
environment=NODE_ENV="production"
EOF

# Step 6: Build Next.js for production
echo ""
echo "Step 6: Building Next.js for production..."
cd /app/frontend && yarn build

# Step 7: Reload supervisor and start frontend
echo ""
echo "Step 7: Starting Next.js frontend..."
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start frontend

echo ""
echo "==================================="
echo "Migration Complete!"
echo "==================================="
echo ""
echo "Next.js frontend is now running on port 3000"
echo ""
echo "To rollback:"
echo "  1. sudo supervisorctl stop frontend"
echo "  2. mv /app/frontend /app/frontend-next"
echo "  3. mv /app/frontend-react-backup /app/frontend"
echo "  4. sudo supervisorctl start frontend"
echo ""
