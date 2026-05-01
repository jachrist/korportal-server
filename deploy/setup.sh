#!/bin/bash
# Korportal server setup script for Ubuntu
# Run as root or with sudo

set -e

echo "=== Korportal Server Setup ==="

# 1. System dependencies
echo "Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs nginx certbot python3-certbot-nginx build-essential \
    sqlite3 gnupg rclone

# 2. Create service user
echo "Creating korportal user..."
useradd --system --shell /usr/sbin/nologin korportal || true

# 3. Create directories
echo "Creating directories..."
mkdir -p /opt/korportal/api-new
mkdir -p /var/data/korportal/uploads
mkdir -p /opt/korportal/api-new/data

# 4. Set permissions
chown -R korportal:korportal /var/data/korportal
chown -R korportal:korportal /opt/korportal

# 5. Copy files (assumes repo is cloned to /tmp/korportal-server)
REPO_DIR="${1:-/tmp/korportal-server}"
echo "Copying files from $REPO_DIR..."
cp -r "$REPO_DIR"/api-new/* /opt/korportal/api-new/
mkdir -p /opt/korportal/frontend
cp -r "$REPO_DIR"/*.html "$REPO_DIR"/css "$REPO_DIR"/js "$REPO_DIR"/assets "$REPO_DIR"/manifest.json "$REPO_DIR"/sw.js /opt/korportal/frontend/

# 5b. Install production env.js
cp "$REPO_DIR"/deploy/env-production.js /opt/korportal/frontend/js/env.js

# 6. Install npm dependencies
echo "Installing npm dependencies..."
cd /opt/korportal/api-new
sudo -u korportal npm install --production

# 7. Create .env from example
if [ ! -f /opt/korportal/api-new/.env ]; then
  cp /opt/korportal/api-new/.env.example /opt/korportal/api-new/.env
  echo "IMPORTANT: Edit /opt/korportal/api-new/.env with your settings!"
fi

# 8. Update .env paths for production
sed -i 's|SQLITE_DB_PATH=.*|SQLITE_DB_PATH=/var/data/korportal/korportal.db|' /opt/korportal/api-new/.env
sed -i 's|UPLOAD_DIR=.*|UPLOAD_DIR=/var/data/korportal/uploads|' /opt/korportal/api-new/.env
sed -i 's|FILE_BASE_URL=.*|FILE_BASE_URL=https://server.kammerkoretutsikten.no/uploads|' /opt/korportal/api-new/.env

# 9. Install systemd service
echo "Installing systemd service..."
cp "$REPO_DIR"/deploy/korportal.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable korportal

# 10. Install nginx config
echo "Configuring nginx..."
cp "$REPO_DIR"/deploy/korportal-nginx.conf /etc/nginx/sites-available/korportal
ln -sf /etc/nginx/sites-available/korportal /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 11. Set final permissions
chown -R korportal:korportal /opt/korportal
chown -R korportal:korportal /var/data/korportal

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit /opt/korportal/api-new/.env (SMTP credentials, etc.)"
echo "  2. Start the service: sudo systemctl start korportal"
echo "  3. Set up SSL: sudo certbot --nginx -d server.kammerkoretutsikten.no"
echo "  4. Migrate data: cd /opt/korportal/api-new && sudo -u korportal node migrate.js"
echo ""
