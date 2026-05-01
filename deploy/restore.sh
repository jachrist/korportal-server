#!/bin/bash
# Korportal restore — pakker ut en kryptert backup og legger filene tilbake.
# Kjør på en frisk server ETTER at setup.sh er kjørt (mappestruktur og bruker må finnes).
#
# Bruk: sudo ./restore.sh /path/til/korportal-YYYYMMDD-HHMMSS.tar.gz.gpg

set -euo pipefail

BACKUP_FILE="${1:-}"
GPG_PASSPHRASE_FILE="${GPG_PASSPHRASE_FILE:-/root/.korportal-backup-passphrase}"

DB_PATH="${DB_PATH:-/var/data/korportal/korportal.db}"
UPLOAD_DIR="${UPLOAD_DIR:-/var/data/korportal/uploads}"
ENV_FILE="${ENV_FILE:-/opt/korportal/api-new/.env}"
LETSENCRYPT_DIR="${LETSENCRYPT_DIR:-/etc/letsencrypt}"
NGINX_CONF="${NGINX_CONF:-/etc/nginx/sites-available/korportal}"
SYSTEMD_UNIT="${SYSTEMD_UNIT:-/etc/systemd/system/korportal.service}"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "Bruk: $0 <backup-fil.tar.gz.gpg>" >&2
    exit 1
fi

if [ ! -f "$GPG_PASSPHRASE_FILE" ]; then
    echo "FEIL: GPG-passphrase mangler på $GPG_PASSPHRASE_FILE" >&2
    exit 1
fi

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

echo "→ dekrypterer"
gpg --batch --yes --passphrase-file "$GPG_PASSPHRASE_FILE" \
    --decrypt --output "$WORK_DIR/backup.tar.gz" "$BACKUP_FILE"

echo "→ pakker ut"
mkdir -p "$WORK_DIR/extract"
tar -xzf "$WORK_DIR/backup.tar.gz" -C "$WORK_DIR/extract"

echo "→ stopper korportal-service"
systemctl stop korportal 2>/dev/null || true

echo "→ database"
mkdir -p "$(dirname "$DB_PATH")"
cp "$WORK_DIR/extract/korportal.db" "$DB_PATH"
chown korportal:korportal "$DB_PATH"

echo "→ uploads"
mkdir -p "$UPLOAD_DIR"
cp -a "$WORK_DIR/extract${UPLOAD_DIR}/." "$UPLOAD_DIR/"
chown -R korportal:korportal "$UPLOAD_DIR"

echo "→ .env"
mkdir -p "$(dirname "$ENV_FILE")"
cp "$WORK_DIR/extract/config/api.env" "$ENV_FILE"
chown korportal:korportal "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "→ nginx-config"
[ -f "$WORK_DIR/extract/config/nginx-korportal.conf" ] && \
    cp "$WORK_DIR/extract/config/nginx-korportal.conf" "$NGINX_CONF"

echo "→ systemd-unit"
[ -f "$WORK_DIR/extract/config/korportal.service" ] && \
    cp "$WORK_DIR/extract/config/korportal.service" "$SYSTEMD_UNIT"

echo "→ Let's Encrypt-sertifikater"
if [ -d "$WORK_DIR/extract${LETSENCRYPT_DIR}" ]; then
    cp -a "$WORK_DIR/extract${LETSENCRYPT_DIR}/." "$LETSENCRYPT_DIR/"
fi

echo "→ reload + start"
systemctl daemon-reload
nginx -t && systemctl reload nginx
systemctl start korportal

echo ""
echo "Restore ferdig. Sjekk: systemctl status korportal && curl -I https://kammerkoretutsikten.no"
