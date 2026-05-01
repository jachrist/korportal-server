#!/bin/bash
# Korportal backup script — kjøres daglig via cron som root
# Tar konsistent SQLite-snapshot, pakker uploads + .env + Let's Encrypt-sertifikater,
# krypterer med GPG og kopierer til lokalt lager + OneDrive (via rclone).

set -euo pipefail

# --- Konfigurasjon ---
DB_PATH="${DB_PATH:-/var/data/korportal/korportal.db}"
UPLOAD_DIR="${UPLOAD_DIR:-/var/data/korportal/uploads}"
ENV_FILE="${ENV_FILE:-/opt/korportal/api-new/.env}"
LETSENCRYPT_DIR="${LETSENCRYPT_DIR:-/etc/letsencrypt}"
NGINX_CONF="${NGINX_CONF:-/etc/nginx/sites-available/korportal}"
SYSTEMD_UNIT="${SYSTEMD_UNIT:-/etc/systemd/system/korportal.service}"

LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-/var/backups/korportal}"
RCLONE_REMOTE="${RCLONE_REMOTE:-onedrive:Korportal-Backup}"
GPG_PASSPHRASE_FILE="${GPG_PASSPHRASE_FILE:-/root/.korportal-backup-passphrase}"

KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"

# --- Forberedelser ---
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TODAY=$(date +%Y%m%d)
WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

mkdir -p "$LOCAL_BACKUP_DIR"

if [ ! -f "$GPG_PASSPHRASE_FILE" ]; then
    echo "FEIL: GPG-passphrase mangler på $GPG_PASSPHRASE_FILE" >&2
    echo "Lag den med: openssl rand -base64 32 > $GPG_PASSPHRASE_FILE && chmod 600 $GPG_PASSPHRASE_FILE" >&2
    exit 1
fi

echo "[$(date -Iseconds)] Starter backup..."

# --- 1. Konsistent SQLite-snapshot (mens DB er åpen) ---
echo "  → SQLite-snapshot"
sqlite3 "$DB_PATH" ".backup '$WORK_DIR/korportal.db'"

# --- 2. Samle filer ---
mkdir -p "$WORK_DIR/config"
cp "$ENV_FILE" "$WORK_DIR/config/api.env" 2>/dev/null || echo "  (advarsel: .env mangler)"
cp "$NGINX_CONF" "$WORK_DIR/config/nginx-korportal.conf" 2>/dev/null || true
cp "$SYSTEMD_UNIT" "$WORK_DIR/config/korportal.service" 2>/dev/null || true

# --- 3. Pakk alt (database + uploads + config + sertifikater) ---
ARCHIVE="$WORK_DIR/korportal-$TIMESTAMP.tar.gz"
echo "  → tar.gz"
tar -czf "$ARCHIVE" \
    -C "$WORK_DIR" korportal.db config \
    -C / "${UPLOAD_DIR#/}" "${LETSENCRYPT_DIR#/}"

# --- 4. Krypter ---
ENCRYPTED="$LOCAL_BACKUP_DIR/korportal-$TIMESTAMP.tar.gz.gpg"
echo "  → gpg-kryptering"
gpg --batch --yes --passphrase-file "$GPG_PASSPHRASE_FILE" \
    --symmetric --cipher-algo AES256 \
    --output "$ENCRYPTED" "$ARCHIVE"

SIZE=$(du -h "$ENCRYPTED" | cut -f1)
echo "  → lokal: $ENCRYPTED ($SIZE)"

# --- 5. Last opp til OneDrive ---
if command -v rclone >/dev/null 2>&1; then
    echo "  → laster opp til $RCLONE_REMOTE"
    rclone copy "$ENCRYPTED" "$RCLONE_REMOTE/" --quiet || echo "  ADVARSEL: rclone-opplasting feilet"
else
    echo "  (rclone ikke installert — hopper over fjernopplasting)"
fi

# --- 6. Rotasjon: behold N daglige + M ukentlige (søndager) ---
echo "  → rydder gamle backups"
cd "$LOCAL_BACKUP_DIR"

# Daglige: behold de N nyeste
ls -1t korportal-*.tar.gz.gpg 2>/dev/null | tail -n +$((KEEP_DAILY + 1)) | while read -r old; do
    # Ikke slett hvis det er en søndag-backup vi vil beholde som ukentlig
    DAY_OF_WEEK=$(date -d "$(echo "$old" | sed -E 's/korportal-([0-9]{8})-.*/\1/')" +%u 2>/dev/null || echo 0)
    if [ "$DAY_OF_WEEK" != "7" ]; then
        rm -f "$old"
        echo "    slettet: $old"
    fi
done

# Ukentlige (søndager): behold de M nyeste
ls -1t korportal-*.tar.gz.gpg 2>/dev/null | while read -r f; do
    DAY=$(echo "$f" | sed -E 's/korportal-([0-9]{8})-.*/\1/')
    DOW=$(date -d "$DAY" +%u 2>/dev/null || echo 0)
    [ "$DOW" = "7" ] && echo "$f"
done | tail -n +$((KEEP_WEEKLY + 1)) | xargs -r rm -f

# Speil rotasjonen til OneDrive
if command -v rclone >/dev/null 2>&1; then
    rclone sync "$LOCAL_BACKUP_DIR" "$RCLONE_REMOTE/" --include "korportal-*.tar.gz.gpg" --quiet || true
fi

echo "[$(date -Iseconds)] Backup ferdig."
