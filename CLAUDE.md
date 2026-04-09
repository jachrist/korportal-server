# Korportal — Kammerkoret Utsikten

## Prosjektoversikt

PWA (Progressive Web App) for kammerkoret Utsikten (~25 medlemmer). Intern portal med ovelsesverktoy, noter, meldinger, arrangementer, billettbestilling og administrasjon.

## Arkitektur

### Frontend (produksjon)
- Ren HTML/CSS/JS (ingen rammeverk, ingen byggsteg)
- ES modules (`type="module"`) — alle sider har en hovedmodul i `js/`
- Service Worker (`sw.js`) for offline-stotte og caching
- Hosting: Azure Static Web Apps (Free tier)
- Alle API-URLer konfigureres i `js/env.js` (gitignored) — se `js/env-api.js` for mal

### Backend (migrering pagar)
- **Navarende produksjon:** Power Automate HTTP-flyter → SharePoint Online-lister
- **Ny arkitektur (under utvikling):** Node.js/Express → Azure Table Storage (i `api-new/`)
- **Mal-arkitektur:** Azure Functions (Consumption) + Table Storage + Blob Storage
- Binare filer (PDF, MP3, bilder) i Azure Blob Storage (`utsiktenblob.blob.core.windows.net/sanger/`)

### Viktige arkitekturdokumenter
- `NyArkitektur.md` — Overordnet migrasjonsplan og arkitekturvurdering
- `api-new/migration.md` — Detaljert endepunkt-spesifikasjon (63 endepunkter), tabellskjema, seed-data
- `sharepoint/list-schemas.md` — Navarende SharePoint-skjemaer
- `docs/api.html` — API-dokumentasjon (HTML)

## Backend: api-new/

Express-basert API som erstatter Power Automate. Alle 18 route-filer er implementert.

### Struktur
```
api-new/
  server.js              # Express app, CORS, response-wrapper
  lib/table-client.js    # Azure Table Storage CRUD (getEntity, listEntities, upsertEntity, deleteEntity, buildEntity, parseEntity)
  lib/helpers.js         # successResponse, errorResponse, generateId, parsePagination, paginate, validateRequired
  routes/*.js            # 18 route-filer (auth, navigation, articles, contacts, quicklinks, messages, posts, practice, downloads, concerts, tickets, ticket-validate, music, members, files, blob, styre, profile)
  migrate.js             # Datamigrering fra JSON-eksporter til Table Storage
  data/*.json            # Eksportert testdata
  env.js                 # Frontend env-fil som peker til localhost:3001
```

### Hybrid lagringsmodell
Alle tabeller bruker `jsonData`-kolonne for komplett objekt + dedikerte kolonner for sokbare felt. `buildEntity(partitionKey, rowKey, searchableFields, fullData)` og `parseEntity()` abstraherer dette.

### Response-format
Alle responser wrappes i `{ body: ... }` for kompatibilitet med frontenden sin `sharepoint-api.js` `unwrap()`-logikk. I Express gjores dette via middleware. I Azure Functions ma det gjores eksplisitt.

## Frontend-konvensjoner

### Filmonstre
- Hver HTML-side har en tilhorende JS-modul: `noter.html` → `js/noter.js`
- Felles API-klient: `js/sharepoint-api.js` (singleton, 5-min in-memory cache, request dedup)
- Navigasjon og tema: `js/navigation.js` (ThemeManager, MenuManager, initPage, rollesjekk)
- Medlemsinfo: `js/member-utils.js` (getCurrentMember fra localStorage)

### Autentisering
- E-postbasert OTP (engangskode)
- Medlemsdata lagres i `localStorage['korportal-member']`
- Roller: `admin > styre > medlem > anonym` (hierarkisk)
- Kun client-side rollesjekk — ingen server-side auth enna

### CSS
- Globale stiler: `css/style.css`
- Per-side CSS: `css/<sidenavn>.css`
- CSS custom properties for tema (dark/light): `--accent`, `--card`, `--text`, `--line`, etc.
- BEM-lignende klassenavn: `.uts-topbar`, `.mxml-dropzone`, `.wav-file-list`

### Admin-verktoy
- MusicXML-verktoy (fonetisk konvertering, repetisjonsekspandering): `js/musicxml-tools.js`
- WAV→MP3 konvertering: `js/wav-mp3-tool.js` (lamejs + JSZip, lazy-loaded)
- Vendor-biblioteker i `js/vendor/` (lamejs, jszip, pdf.js, html5-qrcode)

## Miljovariabler

Frontenden leser `window.ENV` fra `js/env.js`. Se `js/env-api.js` for alle nokkler.
API-et bruker `.env` — se `api-new/.env.example` for nokkler:
- `AZURE_STORAGE_CONNECTION_STRING` — Table Storage
- `AZURE_BLOB_CONNECTION_STRING` / `AZURE_BLOB_CONTAINER` — Blob Storage
- `SMTP_HOST/PORT/USER/PASS/FROM` — E-post via Outlook/Exchange Online

## E-post
- Bruker Outlook via M365-tenant (Exchange Online Plan 1)
- SMTP AUTH mot smtp.office365.com:587
- Nodemailer i api-new/

## Utvikling

```bash
# Frontend (statisk server pa port 3000)
node server.js

# API (Express pa port 3001)
cd api-new && npm install && cp .env.example .env  # fyll inn credentials
node server.js

# Bytt frontend til lokal API
# Kopier js/env-api.js til js/env.js
```

## Migrering

Se `NyArkitektur.md` for overordnet plan. Kort oppsummert:
1. Express-API i `api-new/` er ~90% komplett
2. Skal konverteres til Azure Functions (Consumption plan)
3. Frontend endres ikke — kun URL-bytte i `env.js`
4. Data migreres via `api-new/migrate.js` fra JSON-eksporter
5. Static Web Apps beholdes for frontend-hosting
