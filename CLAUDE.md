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
- E-post via Outlook/Exchange Online (SMTP AUTH mot smtp.office365.com:465 eller :587) — `lib/mailer.js` deler transport og HTML-maler mellom engangskoder, billett-kvitteringer (QR-kode via `qrcode`) og medlemsvarsling. Alle sendere returnerer feil ved mislykket utsending (ingen falsk suksess). Diagnostiser oppsettet med `POST /api/admin/smtp-test` (`{ "to": "din@epost" }` for full test) — den kjorer `transporter.verify()` og returnerer den faktiske SMTP-feilen. Merk: M365 krever ofte at «SMTP AUTH» er aktivert pa postboksen.
- Avhengigheter (`api-new/package.json`): `express`, `cors`, `dotenv`, `better-sqlite3`, `nodemailer`, `qrcode`

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
  server.js                  # Express app, CORS, response-wrapper, route-mounting
  lib/db.js                  # SQLite-lag: getEntity, listEntities, upsertEntity, deleteEntity, buildEntity, parseEntity, ensureTables, odata
  lib/mailer.js              # Delt SMTP-transport + HTML-mal-rendring (billett-kvittering m/QR, medlems-digest)
  lib/notifications.js       # Daglig medlemsvarsling: endringsdeteksjon, digest-utsending, planlegger
  lib/helpers.js             # successResponse, errorResponse, generateId, generateReferenceNumber, parsePagination, paginate, validateRequired, now
  lib/table-client.js        # Ubrukt arv fra Azure Table Storage — beholdt midlertidig
  routes/*.js                # 19 route-filer: auth, navigation, articles, contacts, quicklinks, messages, posts, practice, downloads, concerts, tickets, ticket-validate, music, members, files, blob, styre, profile, admin
  migrate.js                 # Engangsmigrering av JSON-eksporter til SQLite
  migrate-practice-to-files.js  # Flytter ovelse-vedlegg inn i Files-tabellen
  import-metadata.js         # Importerer fil-metadata (stemme, verk, anledning) til Files
  data/*.json                # Eksportert testdata (Members, Concerts, Music, practice, navigation m.fl.)
  data/korportal.db          # SQLite-fil (lokalt) — i produksjon: /var/data/korportal/korportal.db
  test.http                  # Manuelle endepunkt-kall (REST Client)
```

E-post-malene ligger som HTML i `assets/` (`email-ticket.html`, `email-member.html`) og lastes av `lib/mailer.js` — i produksjon peker `FRONTEND_ASSETS_DIR` på `/opt/korportal/frontend/assets`.

### Hybrid lagringsmodell
Hver tabell har kolonnene `id` (PK), `partitionKey`, sokbare felt + `jsonData` (komplett objekt). `buildEntity(partitionKey, rowKey, searchableFields, fullData)` og `parseEntity(row)` abstraherer dette. Skjema defineres i `TABLE_SCHEMAS` i `lib/db.js`; `ensureTables()` legger til manglende kolonner ved oppstart (enkel schema-migrering via `ALTER TABLE`). SQLite kjorer i WAL-modus.

Tabeller: `Navigation`, `Articles`, `Contacts`, `QuickLinks`, `Messages`, `Posts`, `Practice`, `Downloads`, `Concerts`, `TicketReservations`, `Music`, `Members`, `Events`, `Files`, `AuthCodes`, `GuestConfig`, `NotificationState`.

`listEntities()` stotter en enkel OData-lignende filter-syntaks (`"column eq 'value'"`) for kompatibilitet med rutene som ble skrevet mot Azure Table Storage.

### Daglig medlemsvarsling
`lib/notifications.js` sender en oppsummerings-e-post til medlemmer nar det er nye eller oppdaterte **meldinger**, **innlegg** eller **arrangementer**:
- `startDailyScheduler()` (startet fra `server.js`) ticker hver time og kjorer `runDailyDigest()` en gang per dogn fra `NOTIFY_DIGEST_HOUR` (server-lokal tid, default 08). `NotificationState`-raden `digest` lagrer `lastRunAt`, sa vinduet «siden sist» taler omstart uten dobbeltsending.
- Endringer detekteres via `updatedAt` (settes ved opprettelse og PATCH i `messages.js`, `posts.js`, `members.js`); `isNew` skiller «Ny» fra «Oppdatert». Kommentarer og RSVP setter *ikke* `updatedAt` og utloser derfor ingen varsling.
- Hvert medlem far kun seksjonene de har slatt pa i `varsler: { innlegg, arrangementer, meldinger }` (mangler feltet → alt pa). E-posten rendres av `renderMemberDigest()` i `lib/mailer.js`.
- Manuell/test-kjoring: `POST /api/admin/send-varsler` (`?force=true` bruker 24t-vindu og flytter ikke `lastRunAt`). Uten SMTP-konfig hopper kjoringen over og beholder `lastRunAt` sa endringene fanges opp senere.

### Response-format
Alle JSON-responser wrappes i `{ body: ... }` via middleware i `server.js`, slik at frontenden sin `unwrap()`-logikk i `sharepoint-api.js` fungerer uendret fra Power Automate-tiden.

## Frontend-konvensjoner

### Filmonstre
- Hver HTML-side har en tilhorende JS-modul: `noter.html` → `js/noter.js`
- Felles API-klient: `js/sharepoint-api.js` (singleton, 5-min in-memory cache, request dedup; kall `invalidate(key)`/`invalidateCache(listName)` etter skrive-operasjoner)
- Navigasjon og tema: `js/navigation.js` (ThemeManager, MenuManager, initPage, rollesjekk)
- Medlemsinfo: `js/member-utils.js` (`getCurrentMember` fra localStorage)
- Billett-flyt: `billetter.html`/`js/billetter.js` (bestilling) og `billettkontroll.html`/`js/billettkontroll.js` (QR-skanning ved inngang, html5-qrcode)
- Ovelse finnes i flere varianter: `ovelse.html` (aktiv) + `ovelse2.html`/`ovelse-original.html` (eksperiment/arv)
- Nedlasting (`nedlasting.html`/`js/nedlasting.js`): noter + ovefiler for aktiv hendelse, gruppert per verk i satt rekkefolge. Henter anledninger + aktiv anledning fra `/api/filer/anledninger` og `/api/ovelse/meta`, og program via `sharePointAPI.getPracticeData()` (samme kilde som ovesiden). Aktivitet- og stemmevelger (stemme default = medlemmets); ovefil-lenke faller tilbake til delt basestemme (`tenor 1` → `tenor`), ellers «ikke tilgjengelig enda». «Last ned alt» pakker noter + ovefiler for valgt stemme i en zip via `js/vendor/jszip.min.js` (lazy-lastet). Tilgang: `initPage({ requiredRole: 'medlem' })`.

### Autentisering
- E-postbasert OTP (6-sifret engangskode, 10 min levetid)
- Medlemsdata lagres i `localStorage['korportal-member']`
- Engangskoder lagres i `AuthCodes`-tabellen (10 min utlop) og sendes via `nodemailer`
- Roller: `admin > styre > medlem > gjest > anonym` (hierarkisk)
- Gjestepalogging: kun passord (modal i navigasjonsmenyen), begrenset til ovelsesfunksjoner; passord ligger i `GuestConfig`-tabellen
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
- `SMTP_HOST/PORT/USER/PASS/FROM` — M365 SMTP for engangskoder og billett-kvitteringer
- `FRONTEND_ASSETS_DIR` — katalog med HTML-maler + logo for e-post (default `../assets`; server: `/opt/korportal/frontend/assets`)
- `NOTIFY_DIGEST_ENABLED` — `false` slar av den daglige medlemsvarslingen (default pa)
- `NOTIFY_DIGEST_HOUR` — klokketime (server-lokal, 0–23) varslingen kjorer fra (default 8)
- `SITE_URL` — lenkebase i varsel-e-posten, servert i rot (default `https://www.kammerkoretutsikten.no`; sidene lenkes som `<base>/meldinger.html`)

## Utvikling (lokalt pa Windows)

```bash
# Frontend (statisk filserver pa port 3000)
node server.js

# API (Express pa port 3001)
cd api-new
npm install
cp .env.example .env   # fyll inn SMTP-credentials
node server.js         # eller: npm run dev (node --watch)

# Bytt frontend til lokal API
copy js\env-api.js js\env.js
```

Engangs-datamigrering (kjores manuelt ved behov): `node migrate.js` (JSON → SQLite), `node migrate-practice-to-files.js`, `node import-metadata.js`.

## Deploy

Se `deploy/README.md` for fullstendig drift:
- Automatisk: `.github/workflows/deploy.yml` kjorer `deploy/deploy.sh` over SSH ved push til `main` (og manuelt via «Run workflow»). Krever repo-secrets `SSH_HOST`/`SSH_USER`/`SSH_PRIVATE_KEY` (+ evt. `SSH_PORT`).
- `deploy/deploy.sh`: henter siste `main`, kopierer frontend + API (inkl. `api-new/jobs/`), `npm install` kun ved dependency-endring, restarter tjenesten. Beholder `.env`, `data/`, `uploads/`, `js/env.js`.
- Manuelt (samme steg): `git pull` + kopier statiske filer til `/opt/korportal/frontend/`, og `routes/`/`lib/`/`jobs/`/`server.js` til `/opt/korportal/api-new/` + `systemctl restart korportal`
- Backup: `deploy/backup.sh` (kryptert til OneDrive via rclone, daglig cron 03:15)
- Restaurering: `deploy/restore.sh` med GPG-passphrase fra passordhvelv

## Viktige dokumenter
- `deploy/README.md` — drift og deploy pa Ubuntu-serveren
- `NyArkitektur.md` — historisk migrasjonsplan (Azure → Ubuntu)
- `api-new/migration.md` — endepunkt-spesifikasjon og tabellskjema
- `sharepoint/list-schemas.md` — gamle SharePoint-skjemaer (referanse for datamigrering)
- `docs/*.html` — HTML-dokumentasjon (api, arkitektur, autentisering m.fl.)
