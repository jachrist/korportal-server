# Korportal — Kammerkoret Utsikten

## Prosjektoversikt

PWA (Progressive Web App) for kammerkoret Utsikten (~25 medlemmer). Intern portal med ovelsesverktoy, noter, meldinger, arrangementer, billettbestilling og administrasjon.

Hele losningen er selvforsynt pa egen Ubuntu-server (`server.kammerkoretutsikten.no`) — ingen sky-avhengigheter utover M365 SMTP og OneDrive (backup).

## Arkitektur

### Frontend
- Ren HTML/CSS/JS (ingen rammeverk, ingen byggsteg)
- ES modules (`type="module"`) — hver side har en hovedmodul i `js/`
- Service Worker (`sw.js`) for offline-stotte og caching (JS/CSS bruker network-first)
- API-URLer konfigureres i `js/env.js` (gitignored) — se `js/env-api.js` for mal mot lokal API
- Nokkelnavn beholder `POWER_AUTOMATE_*`-prefiks av historiske grunner — peker na pa Express-endepunkter

### Backend
- Express-API i `api-new/`, kjorer pa port 3001
- SQLite via `better-sqlite3` (`lib/db.js`) — drop-in for tidligere Azure Table Storage
- Lokale filer i `/var/data/korportal/uploads/` (PDF, MP3, bilder)
- Nginx serverer frontend og proxyer `/api/*` → `127.0.0.1:3001`, `/uploads/` direkte fra disk
- E-post via Outlook/Exchange Online (SMTP AUTH mot smtp.office365.com:465 eller :587)

### Driftsmiljo
- Ubuntu hos ServeTheWorld (85.137.228.160)
- systemd-service `korportal` kjorer Express-prosessen
- SSL via certbot/Let's Encrypt
- Daglig kryptert backup (GPG + tar.gz) til `/var/backups/korportal/` og OneDrive via rclone
- Se `deploy/README.md` for full driftsdokumentasjon

## Backend: api-new/

### Struktur
```
api-new/
  server.js              # Express app, CORS, response-wrapper, route-mounting
  lib/db.js              # SQLite-lag: getEntity, listEntities, upsertEntity, deleteEntity, buildEntity, parseEntity, ensureTables, odata
  lib/table-client.js    # Ubrukt arv fra Azure Table Storage — beholdt midlertidig
  lib/helpers.js         # successResponse, errorResponse, generateId, generateReferenceNumber, parsePagination, paginate, validateRequired, now
  routes/*.js            # 19 route-filer: auth, navigation, articles, contacts, quicklinks, messages, posts, practice, downloads, concerts, tickets, ticket-validate, music, members, files, blob, styre, profile, admin
  migrate.js             # Engangsmigrering av JSON-eksporter til SQLite
  data/*.json            # Eksportert testdata
  data/korportal.db      # SQLite-fil (lokalt) — i produksjon: /var/data/korportal/korportal.db
```

### Hybrid lagringsmodell
Hver tabell har kolonnene `id` (PK), `partitionKey`, sokbare felt + `jsonData` (komplett objekt). `buildEntity(partitionKey, rowKey, searchableFields, fullData)` og `parseEntity(row)` abstraherer dette. Skjema defineres i `TABLE_SCHEMAS` i `lib/db.js`; `ensureTables()` legger til manglende kolonner ved oppstart.

`listEntities()` stotter en enkel OData-lignende filter-syntaks (`"column eq 'value'"`) for kompatibilitet med rutene som ble skrevet mot Azure Table Storage.

### Response-format
Alle JSON-responser wrappes i `{ body: ... }` via middleware i `server.js`, slik at frontenden sin `unwrap()`-logikk i `sharepoint-api.js` fungerer uendret fra Power Automate-tiden.

## Frontend-konvensjoner

### Filmonstre
- Hver HTML-side har en tilhorende JS-modul: `noter.html` → `js/noter.js`
- Felles API-klient: `js/sharepoint-api.js` (singleton, 5-min in-memory cache, request dedup)
- Navigasjon og tema: `js/navigation.js` (ThemeManager, MenuManager, initPage, rollesjekk)
- Medlemsinfo: `js/member-utils.js` (`getCurrentMember` fra localStorage)

### Autentisering
- E-postbasert OTP (6-sifret engangskode, 10 min levetid)
- Medlemsdata lagres i `localStorage['korportal-member']`
- Roller: `admin > styre > medlem > gjest > anonym` (hierarkisk)
- Gjestepalogging: kun passord (modal i navigasjonsmenyen), begrenset til ovelsesfunksjoner
- Kun client-side rollesjekk — ingen server-side auth-validering enna

### CSS
- Globale stiler: `css/style.css`
- Per-side CSS: `css/<sidenavn>.css`
- CSS custom properties for tema (dark/light): `--accent`, `--card`, `--text`, `--line`, ...
- BEM-lignende klassenavn: `.uts-topbar`, `.mxml-dropzone`, `.wav-file-list`

### Admin-verktoy
- Database-browser med diskplass-oversikt: `js/admin.js` + `api-new/routes/admin.js`
- MusicXML-verktoy (fonetisk konvertering, repetisjonsekspandering): `js/musicxml-tools.js`
- WAV→MP3 konvertering: `js/wav-mp3-tool.js` (lamejs + JSZip, lazy-loaded)
- Vendor-biblioteker i `js/vendor/` (lamejs, jszip, pdf.js, html5-qrcode)

## Miljovariabler

### Frontend
`window.ENV` settes av `js/env.js` (gitignored). Se `js/env-api.js` for full liste — alle URL-er peker pa lokal Express som default.

### API (`.env` i `api-new/`)
- `SQLITE_DB_PATH` — sti til SQLite-fil
- `UPLOAD_DIR` — katalog for opplastede filer
- `FILE_BASE_URL` — offentlig URL-prefiks for `/uploads/`
- `PORT` — API-port (default 3001)
- `CORS_ORIGINS` — komma-separert liste over tillatte origins
- `SMTP_HOST/PORT/USER/PASS/FROM` — M365 SMTP for engangskoder

## Utvikling (lokalt pa Windows)

```bash
# Frontend (statisk filserver pa port 3000)
node server.js

# API (Express pa port 3001)
cd api-new
npm install
cp .env.example .env   # fyll inn SMTP-credentials
node server.js

# Bytt frontend til lokal API
copy js\env-api.js js\env.js
```

## Deploy

Se `deploy/README.md` for fullstendig drift:
- Frontend-oppdatering: `git pull` + kopier statiske filer til `/opt/korportal/frontend/`
- API-oppdatering: `git pull` + kopier `routes/`, `lib/`, `server.js` til `/opt/korportal/api-new/` + `systemctl restart korportal`
- Backup: `deploy/backup.sh` (kryptert til OneDrive via rclone, daglig cron 03:15)
- Restaurering: `deploy/restore.sh` med GPG-passphrase fra passordhvelv

## Viktige dokumenter
- `deploy/README.md` — drift og deploy pa Ubuntu-serveren
- `NyArkitektur.md` — historisk migrasjonsplan (Azure → Ubuntu)
- `api-new/migration.md` — endepunkt-spesifikasjon og tabellskjema
- `sharepoint/list-schemas.md` — gamle SharePoint-skjemaer (referanse for datamigrering)
- `docs/*.html` — HTML-dokumentasjon (api, arkitektur, autentisering m.fl.)
