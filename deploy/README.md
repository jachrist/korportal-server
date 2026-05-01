# Korportal Server — Drift og deploy

## Server
- **URL:** https://server.kammerkoretutsikten.no
- **IP:** 85.137.228.160
- **Hosting:** ServeTheWorld
- **OS:** Ubuntu

## Stier pa serveren
| Hva | Sti |
|-----|-----|
| Frontend | `/opt/korportal/frontend/` |
| API | `/opt/korportal/api-new/` |
| Database | `/var/data/korportal/korportal.db` |
| Opplastede filer | `/var/data/korportal/uploads/` |
| Miljøvariabler | `/opt/korportal/api-new/.env` |
| nginx-konfig | `/etc/nginx/sites-available/korportal` |
| systemd-service | `/etc/systemd/system/korportal.service` |
| Repo (kilde) | `/tmp/korportal-server/` |

## Oppdatering fra GitHub

### Kun frontend (JS, CSS, HTML)
```bash
cd /tmp/korportal-server && git pull && cp -r js/ css/ *.html assets/ manifest.json sw.js /opt/korportal/frontend/
```

### Kun API (routes, lib, server.js)
```bash
cd /tmp/korportal-server && git pull && cp -r api-new/routes/ api-new/lib/ api-new/server.js /opt/korportal/api-new/ && systemctl restart korportal
```

### Alt (frontend + API)
```bash
cd /tmp/korportal-server && git pull && cp -r js/ css/ *.html assets/ manifest.json sw.js /opt/korportal/frontend/ && cp -r api-new/routes/ api-new/lib/ api-new/server.js /opt/korportal/api-new/ && systemctl restart korportal
```

## Tjenestestyring

```bash
# Status
systemctl status korportal

# Start / stopp / restart
systemctl start korportal
systemctl stop korportal
systemctl restart korportal

# Se logg (live)
journalctl -u korportal -f

# Se siste 30 linjer i loggen
journalctl -u korportal --no-pager -n 30
```

## nginx

```bash
# Test konfigurasjon
nginx -t

# Last inn pa nytt (etter konfig-endring)
systemctl reload nginx

# Rediger konfig
nano /etc/nginx/sites-available/korportal
```

## SSL-sertifikat

```bash
# Fornyes automatisk, men kan tvinges:
certbot renew

# Sjekk sertifikatstatus
certbot certificates
```

## Database

```bash
# Apne SQLite-konsoll
sqlite3 /var/data/korportal/korportal.db

# Vis tabeller
sqlite3 /var/data/korportal/korportal.db ".tables"

# Tell rader
sqlite3 /var/data/korportal/korportal.db "SELECT 'Navigation', COUNT(*) FROM Navigation UNION ALL SELECT 'Articles', COUNT(*) FROM Articles UNION ALL SELECT 'Members', COUNT(*) FROM Members UNION ALL SELECT 'Files', COUNT(*) FROM Files;"

# Backup
cp /var/data/korportal/korportal.db /var/data/korportal/korportal-backup-$(date +%Y%m%d).db
```

## Miljovariabler

```bash
# Rediger
nano /opt/korportal/api-new/.env

# Husk restart etter endring
systemctl restart korportal
```

Nokkler i `.env`:
- `SQLITE_DB_PATH` — sti til SQLite-database
- `UPLOAD_DIR` — sti til opplastede filer
- `FILE_BASE_URL` — offentlig URL for filer
- `PORT` — API-port (default 3001)
- `SMTP_HOST/PORT/USER/PASS/FROM` — e-postinnstillinger

## Forste gangs oppsett

Se `setup.sh` — installerer Node.js, nginx, certbot, oppretter bruker og mapper.

```bash
git clone https://github.com/jachrist/korportal-server.git /tmp/korportal-server
bash /tmp/korportal-server/deploy/setup.sh /tmp/korportal-server
```

## Backup

Backup tas daglig av `deploy/backup.sh`. Den lager én kryptert tar.gz med:
- SQLite-database (konsistent snapshot via `.backup`)
- `uploads/`
- `.env`, nginx-config, systemd-unit
- `/etc/letsencrypt/` (sertifikater)

Kopien legges lokalt i `/var/backups/korportal/` og lastes opp til OneDrive via rclone.

### Engangsoppsett

```bash
# 1. Opprett GPG-passphrase (LAGRE en kopi i passordhvelv — uten den er backupen ubrukelig!)
openssl rand -base64 32 | sudo tee /root/.korportal-backup-passphrase
sudo chmod 600 /root/.korportal-backup-passphrase
sudo cat /root/.korportal-backup-passphrase   # kopier til 1Password/Bitwarden

# 2. Konfigurer rclone mot OneDrive (interaktivt — bruk 'n' for ny remote)
sudo rclone config
#   Navn: onedrive
#   Storage: Microsoft OneDrive
#   client_id/secret: blank (bruk default)
#   region: global
#   Logg inn med M365-konto i nettleser, godkjenn
#   Type: OneDrive Personal eller Business

# 3. Opprett backup-mappe i OneDrive
sudo rclone mkdir onedrive:Korportal-Backup

# 4. Kopier scripts pa plass og gjor kjorbare
sudo cp /tmp/korportal-server/deploy/backup.sh /usr/local/bin/korportal-backup
sudo cp /tmp/korportal-server/deploy/restore.sh /usr/local/bin/korportal-restore
sudo chmod +x /usr/local/bin/korportal-backup /usr/local/bin/korportal-restore

# 5. Test manuelt (kjor en gang og verifiser at fil dukker opp pa OneDrive)
sudo /usr/local/bin/korportal-backup

# 6. Legg inn i cron (kjorer 03:15 hver natt)
echo "15 3 * * * root /usr/local/bin/korportal-backup >> /var/log/korportal-backup.log 2>&1" | sudo tee /etc/cron.d/korportal-backup
```

### Restaurering pa frisk server

```bash
# 1. Kjor setup.sh (installerer Node, nginx, oppretter bruker og mapper)
git clone https://github.com/jachrist/korportal-server.git /tmp/korportal-server
sudo bash /tmp/korportal-server/deploy/setup.sh /tmp/korportal-server

# 2. Legg passphrasen pa plass (fra passordhvelvet)
sudo nano /root/.korportal-backup-passphrase
sudo chmod 600 /root/.korportal-backup-passphrase

# 3. Hent siste backup fra OneDrive (rclone ma vare konfigurert pa nytt)
sudo rclone config   # samme oppsett som over
sudo rclone copy onedrive:Korportal-Backup/ /tmp/ --include "korportal-*.tar.gz.gpg" --max-age 2d

# 4. Restaurer
sudo bash /tmp/korportal-server/deploy/restore.sh /tmp/korportal-YYYYMMDD-HHMMSS.tar.gz.gpg

# 5. Sjekk at alt kjorer
systemctl status korportal
curl -I https://kammerkoretutsikten.no
```

### Rotasjon
Default: 7 daglige + 4 ukentlige (sondager). Kan endres via env-variabler `KEEP_DAILY` og `KEEP_WEEKLY`.
