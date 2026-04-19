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
