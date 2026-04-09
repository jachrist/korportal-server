# Kammerkoret Utsikten - Korportal

En moderne korportal bygget med vanilla JavaScript og SharePoint som backend via Power Automate.

---

## Arkitektur

### Overordnet

Korportalen er en **statisk PWA** (Progressive Web App) uten build-steg. All kode kjører direkte i nettleseren. Arkitekturen er:

```
Bruker (nettleser/PWA)
    |
    ├── HTML-sider (en fil per side)
    ├── CSS (ett felles designsystem + ett ark per side)
    ├── JavaScript (ES6-moduler, en fil per side + felles moduler)
    |
    ├── Service Worker (offline-støtte og caching)
    |
    └── Power Automate HTTP-endepunkter (REST-aktige kall)
            |
            └── SharePoint Online (lister som database)
                    |
                    └── Azure Blob Storage (PDF, lyd, bilder)
```

**Dataflyt:** Nettleseren laster HTML/CSS/JS fra Azure Static Web Apps. JavaScript-koden kaller Power Automate-endepunkter (konfigurert i `js/env.js`) som henter/skriver data i SharePoint-lister. Binærfiler (noter, lydfiler, bilder) serveres fra Azure Blob Storage.

**Ingen backend-server:** Det finnes ingen Node.js/Express-server. Power Automate fungerer som et serverless API-lag mellom frontend og SharePoint.

### Nøkkelkomponenter

#### `js/env.js` - Konfigurasjon
Inneholder alle Power Automate-endepunkt-URLer som `window.ENV`-variabler. Denne filen er **ikke versjonskontrollert** (inneholder signerte tokens). `js/env.example.js` er malen. Service Worker cacher *ikke* denne filen - den hentes alltid fra nettverk slik at endringer i endepunkter trer i kraft umiddelbart.

#### `js/navigation.js` - Felles sideinitialisering
Importeres av alle sider. Håndterer:
- **Rollebasert tilgangskontroll** - hierarkisk (admin > styre > medlem > anonym)
- **Navigasjonsmeny** - hentes fra SharePoint med fallback til hardkodede elementer
- **Temabytte** - dark/light mode med localStorage-persistering
- **Innloggingssjekk** - omdirigerer til login.html hvis tilgang kreves

Alle beskyttede sider kaller `initPage({ requireAuth: true, requiredRole: 'medlem' })` ved oppstart.

#### `js/sharepoint-api.js` - API-lag
Singleton-klasse (`sharePointAPI`) som abstraherer all kommunikasjon med Power Automate. Inkluderer:
- **Caching** - 5 minutter for GET-kall, automatisk invalidering ved POST
- **Deduplisering** - samtidige identiske forespørsler slås sammen
- **Feilhåndtering** - egen `SharePointAPIError`-klasse
- **Datautpakking** - støtter både `{ data: [...] }` og `{ value: [...] }`-format

#### `js/member-utils.js` - Medlemshåndtering
Hjelpefunksjoner for å hente innlogget bruker fra `localStorage`, sjekke stemmegruppe, og håndtere utlogging.

#### `js/badge-manager.js` - Varslingsbadger
Sporer uleste elementer (meldinger, innlegg, konserter) via `lastSeen`-tidsstempler i localStorage. Oppdaterer badge-tall i menyen og PWA-app-badge via `navigator.setAppBadge()`. Sjekker maks hvert 30. minutt.

#### `sw.js` - Service Worker
Gir offline-støtte og raskere lasting via to cache-strategier:
- **Cache first** for statiske assets (CSS, JS, bilder) - serverer fra cache, oppdaterer i bakgrunnen
- **Network first** for HTML-sider og dynamisk innhold - prøver nettverk først, faller tilbake til cache

`js/sw-register.js` registrerer SW-en og håndterer automatisk oppdatering - når en ny versjon er klar, reloades siden automatisk. Cacheversjon bumpes manuelt i `sw.js` (`CACHE_NAME`, `STATIC_CACHE`, `DYNAMIC_CACHE`).

#### `manifest.json` - PWA-manifest
Gjør appen installerbar på mobil/desktop. Definerer navn, ikoner, farger og visningsformat (`standalone`).

#### `staticwebapp.config.json` - Azure-konfigurasjon
Konfigurerer hosting-miljøet:
- **Ruting** - alle ukjente stier faller tilbake til `index.html`
- **Sikkerhetshoder** - CSP, X-Frame-Options, XSS-beskyttelse
- **Autentisering** - Azure AD som identity provider
- **Feilsider** - tilpassede feilsider for 400/401/403/404

#### `css/style.css` - Designsystem
Felles stilark med CSS Custom Properties for dark/light mode. Definerer farger, spacing, typografi, radius og animasjoner. Alle sidesider importerer dette + sitt eget CSS-ark.

### Sideoversikt

| Side | Fil | Rolle | Beskrivelse |
|------|-----|-------|-------------|
| Forside | `index.html` | anonym | Artikkel, hurtiglenker, kontaktpersoner |
| Konserter | `konserter.html` | anonym | Kommende konserter med billettbestilling |
| Musikk | `musikk.html` | anonym | Innspilte konserter med lydavspilling |
| Medlemmer | `medlemmer.html` | medlem | Artikkel, arrangementer med RSVP |
| Meldinger | `meldinger.html` | medlem | Meldinger fra styret med kommentarer |
| Innlegg | `innlegg.html` | medlem | Innlegg fra medlemmer med kommentarer |
| Ovelse | `ovelse.html` | medlem | Noter (PDF), lydfiler, autoblading |
| Nedlasting | `nedlasting.html` | medlem | Nedlastbare filer |
| Min profil | `minprofil.html` | medlem | Profilredigering, varsler, tema |
| Notebibliotek | `noter.html` | styre | Filkategorisering, blob-opplasting |
| Styresider | `styre.html` | styre | Medlemsadministrasjon, kontingent, e-post |
| Billetter | `billetter.html` | styre | Administrere ubetalte reservasjoner |
| Billettkontroll | `billettkontroll.html` | styre | QR-skanning og innsjekk ved dør |
| Filbehandling | `filbehandling.html` | styre | Metadata-redigering for filer |
| Admin | `admin.html` | admin | Administrasjonsverktoy |
| Innlogging | `login.html` | anonym | Engangskode-innlogging |

### Autentisering

Innloggingsflyten bruker **engangskode via e-post**:

1. Bruker oppgir e-postadresse pa `login.html`
2. Frontend kaller `POST /auth/send-kode` (Power Automate sender e-post med 6-sifret kode)
3. Bruker taster inn koden
4. Frontend kaller `POST /auth/verifiser-kode`
5. Ved suksess lagres medlemsdata i `localStorage` (`korportal-member`)
6. Rollebasert tilgang styres av `role`-feltet i medlemsobjektet

### Caching-strategi

Tre lag med caching:

| Lag | Hvor | Varighet | Formål |
|-----|------|----------|--------|
| Service Worker | Nettleser | Cache first / Network first | Offline-støtte, rask lasting |
| SharePoint API-cache | JavaScript (minne) | 5 min | Unngå gjentatte API-kall |
| Power Automate | Server | Varierer | SharePoint throttling-beskyttelse |

`env.js` ekskluderes bevisst fra SW-cache slik at endringer i endepunkter trer i kraft umiddelbart.

---

## Oversikt

Korportalen er en responsiv PWA-webapplikasjon for Kammerkoret Utsikten. Den henter data dynamisk fra SharePoint-lister via Power Automate HTTP-endepunkter.

## Teknologistakk

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Backend**: SharePoint Online lister
- **Integrasjon**: Power Automate (HTTP-triggede flows)
- **Hosting**: Azure Static Web Apps
- **Autentisering**: Azure AD

## Prosjektstruktur

```
korportal/
├── index.html              # Forside (offentlig)
├── ovelse.html             # Øvelsesside med noter og øvefiler
├── meldinger.html          # Meldinger fra styret
├── innlegg.html            # Innlegg fra medlemmer
├── nedlasting.html         # Nedlastbare filer
├── noter.html              # Spillelister og filer (styre/admin)
├── konserter.html          # Kommende konserter (offentlig)
├── musikk.html             # Innspillinger fra koret (offentlig)
├── medlemmer.html          # Medlemsside med arrangementer (medlem)
├── login.html              # Innlogging med engangskode
├── admin.html              # Administrasjon (kun admin)
├── styre.html              # Styresider: medlemsadministrasjon (styre/admin)
├── minprofil.html          # Min profil: personlige innstillinger (medlem)
├── billetter.html          # Billettadministrasjon (styre/admin)
├── billettkontroll.html    # QR-skanning og innsjekk ved dør (styre/admin)
├── filbehandling.html      # Filkategorisering og metadata (styre/admin)
├── css/
│   ├── style.css           # Felles stilark (design system)
│   ├── ovelse.css          # Øvelsesside
│   ├── meldinger.css       # Meldinger
│   ├── innlegg.css         # Innlegg
│   ├── nedlasting.css      # Nedlasting
│   ├── noter.css           # Spillelister og filer
│   ├── konserter.css       # Konserter
│   ├── musikk.css          # Musikk
│   ├── medlemmer.css       # Medlemmer
│   ├── login.css           # Innlogging
│   ├── admin.css           # Admin
│   ├── styre.css           # Styresider
│   ├── minprofil.css       # Min profil
│   ├── billetter.css       # Billettadministrasjon
│   ├── billettkontroll.css # Billettkontroll
│   └── filbehandling.css   # Filbehandling
├── js/
│   ├── navigation.js       # Felles navigasjon og tema (modul)
│   ├── member-utils.js     # Medlemshåndtering
│   ├── sharepoint-api.js   # SharePoint API-hjelpeklasse
│   ├── main.js             # Forside
│   ├── ovelse.js           # Øvelsesside
│   ├── meldinger.js        # Meldinger
│   ├── innlegg.js          # Innlegg
│   ├── nedlasting.js       # Nedlasting
│   ├── noter.js            # Spillelister og filer
│   ├── konserter.js        # Konserter
│   ├── musikk.js           # Musikk
│   ├── medlemmer.js        # Medlemmer
│   ├── login.js            # Innlogging
│   ├── admin.js            # Admin
│   ├── styre.js            # Styresider
│   ├── minprofil.js        # Min profil
│   ├── billetter.js        # Billettadministrasjon
│   ├── billettkontroll.js  # Billettkontroll (QR-skanning)
│   └── filbehandling.js    # Filbehandling
├── assets/
│   └── email-ticket.html   # E-postmal for billetter (Power Automate)
├── mock-data/              # Testdata for utvikling
├── sharepoint/
│   └── list-schemas.md     # SharePoint liste-dokumentasjon
├── sw.js                   # Service Worker (PWA)
├── manifest.json           # PWA manifest
├── staticwebapp.config.json # Azure Static Web Apps konfig
└── README.md               # Denne filen
```

## Roller og tilgang

| Rolle | Tilgang |
|-------|---------|
| `anonym` | Forside, Konserter, Musikk |
| `medlem` | Alt over + Øvelse, Meldinger, Innlegg, Nedlasting, Medlemmer, Min profil |
| `styre` | Alt over + Publisering av meldinger, Styresider (medlemsadmin, e-post), Billettadministrasjon, Billettkontroll, Filbehandling, Spillelister og filer |
| `admin` | Alt over + Admin-side, Filbehandling |

## Kom i gang

### Forutsetninger

- SharePoint Online-tilgang
- Power Automate (inkludert i Microsoft 365)
- Azure-abonnement (for hosting)
- Moderne nettleser

### 1. Konfigurer SharePoint-lister

Opprett følgende lister i SharePoint. Se `sharepoint/list-schemas.md` for detaljerte skjemaer.

| Liste | Formål |
|-------|--------|
| Navigasjon | Menystruktur |
| Meldinger | Meldinger fra styret til medlemmene |
| Innlegg | Innlegg fra kormedlemmer |
| Hurtiglenker | Snarveier til ressurser |
| Innhold | Dynamisk sideinnhold (forsideartikkel m.m.) |
| Medlemmer | Kormedlemmer med stemmegruppe og kontaktinfo |
| Kontaktpersoner | Dirigent, korleder og styrekontakter |
| Noter | Notebibliotek med PDF og øvefiler |
| Konserter | Kommende konserter med billettinfo |
| Billettreservasjoner | Bestillinger med betalingsstatus |
| Øvelse | Øvelsesrepertoar med noter og lydfiler |
| Nedlasting | Nedlastbare filer for medlemmer |
| Musikk | Innspillinger fra konserter |

### 2. Opprett Power Automate flows

For hver liste, opprett en HTTP-trigget flow. Se navnestandard nedenfor.

1. Gå til [Power Automate](https://make.powerautomate.com)
2. Opprett ny **Instant cloud flow**
3. Velg **When a HTTP request is received** som trigger
4. Legg til **Get items** fra SharePoint
5. Legg til **Response** med JSON-body
6. Lagre og kopier HTTP POST URL

## Power Automate Navnestandard

### Format
```
[Prosjekt] - [Modul] - [Handling] - [Beskrivelse]
```

### Prefix
Alle flows for korportalen starter med: `Utsikten -`

### Flows

| Flow-navn | Metode | Beskrivelse |
|-----------|--------|-------------|
| `Utsikten - Forside - GET - Artikkel` | GET | Henter forsideartikkel |
| `Utsikten - Forside - GET - Kontaktpersoner` | GET | Henter kontaktpersoner |
| `Utsikten - Forside - GET - Hurtiglenker` | GET | Henter hurtiglenker |
| `Utsikten - Meldinger - GET - Liste` | GET | Henter meldinger fra styret |
| `Utsikten - Meldinger - POST - Ny` | POST | Oppretter ny melding fra styret |
| `Utsikten - Meldinger - POST - Kommentar` | POST | Legger til kommentar på melding |
| `Utsikten - Innlegg - GET - Liste` | GET | Henter medlemsinnlegg |
| `Utsikten - Innlegg - POST - Nytt` | POST | Oppretter nytt innlegg |
| `Utsikten - Innlegg - POST - Kommentar` | POST | Legger til kommentar på innlegg |
| `Utsikten - Øvelse - GET - Program` | GET | Henter øvelsesprogram med repertoar |
| `Utsikten - Øvelse - GET - Filer` | GET | Henter noter og øvefiler |
| `Utsikten - Noter - GET - Bibliotek` | GET | Henter notebiblioteket |
| `Utsikten - Nedlasting - GET - Filer` | GET | Henter nedlastbare filer |
| `Utsikten - Konserter - GET - Liste` | GET | Henter kommende konserter |
| `Utsikten - Konserter - POST - Billett` | POST | Bestiller konsertbilletter |
| `Utsikten - Billetter - GET - Ubetalte` | GET | Henter ubetalte reservasjoner (styre) |
| `Utsikten - Billetter - POST - MarkerBetalt` | POST | Markerer reservasjoner som betalt + sender e-postbillett |
| `Utsikten - Musikk - GET - Konserter` | GET | Henter innspilte konserter |
| `Utsikten - Medlemmer - GET - Side` | GET | Henter medlemsside-data (artikkel + arrangementer) |
| `Utsikten - Medlemmer - POST - RSVP` | POST | Registrerer deltakelse på arrangement |
| `Utsikten - Auth - POST - SendKode` | POST | Sender innloggingskode på e-post |
| `Utsikten - Auth - POST - VerifiserKode` | POST | Verifiserer innloggingskode |
| `Utsikten - Auth - GET - Medlem` | GET | Henter medlemsdata etter innlogging |
| `Utsikten - Billettkontroll - POST - Valider` | POST | Validerer billettreferanse og registrerer innsjekk |
| `Utsikten - Filer - GET - Liste` | GET | Henter alle filer med metadata |
| `Utsikten - Filer - POST - OppdaterMetadata` | POST | Oppdaterer metadata for en fil |
| `Utsikten - Filer - POST - BatchOppdater` | POST | Batch-oppdaterer anledning for flere filer |
| `Utsikten - Blob - POST - LastOpp` | POST | Laster opp markerte filer til Azure Blob |
| `Utsikten - Blob - POST - Tøm` | POST | Tømmer all blob-storage |
| `Utsikten - Øvelse - POST - Sideskift` | POST | Lagrer sideskifttidspunkter for autoblading |
| `Utsikten - Styre - GET - Medlemmer` | GET | Henter alle medlemmer for styreadministrasjon |
| `Utsikten - Styre - POST - RegistrerMedlem` | POST | Registrerer nytt medlem |
| `Utsikten - Styre - POST - OppdaterMedlem` | POST | Oppdaterer eksisterende medlem |
| `Utsikten - Styre - POST - SlettMedlem` | POST | Sletter et medlem |
| `Utsikten - Styre - POST - SendEpost` | POST | Sender e-post til valgte medlemmer |
| `Utsikten - Profil - POST - Hent` | POST | Henter profil for innlogget medlem |
| `Utsikten - Profil - POST - Oppdater` | POST | Oppdaterer profildata og innstillinger |

### Response-format

Alle GET-flows skal returnere JSON med følgende struktur:

```json
{
  "success": true,
  "data": [ ... ],
  "count": 10
}
```

POST-flows returnerer:

```json
{
  "success": true,
  "message": "Beskrivelse av resultat",
  "id": "eventuell-ny-id"
}
```

### Feilhåndtering

Ved feil returneres:

```json
{
  "success": false,
  "error": "Feilmelding som kan vises til bruker"
}
```

---

## API-spesifikasjon (JSON-formater)

### Autentisering

#### `POST /auth/send-kode`

**Request:**
```json
{
  "email": "medlem@example.com"
}
```

**Response (success):**
```json
{
  "success": true,
  "message": "Kode sendt til medlem@example.com"
}
```

**Response (ukjent e-post):**
```json
{
  "success": false,
  "error": "E-postadressen er ikke registrert som medlem"
}
```

---

#### `POST /auth/verifiser-kode`

**Request:**
```json
{
  "email": "medlem@example.com",
  "code": "123456"
}
```

**Response (success):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "member": {
    "id": 42,
    "name": "Ola Nordmann",
    "email": "medlem@example.com",
    "role": "medlem",
    "voice": "tenor 1"
  }
}
```

**Response (feil kode):**
```json
{
  "success": false,
  "error": "Ugyldig eller utløpt kode"
}
```

---

### Navigasjon

#### `GET /navigasjon`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Forside",
      "url": "/index.html",
      "icon": "🏠",
      "order": 1,
      "openInNewTab": false,
      "role": "anonym",
      "hideWhenLoggedIn": false,
      "isLogout": false
    },
    {
      "id": 2,
      "title": "Øvelse",
      "url": "/ovelse.html",
      "icon": "🎼",
      "order": 2,
      "openInNewTab": false,
      "role": "medlem",
      "hideWhenLoggedIn": false,
      "isLogout": false
    },
    {
      "id": 3,
      "title": "Logg ut",
      "url": "#",
      "icon": null,
      "order": 99,
      "openInNewTab": false,
      "role": "medlem",
      "hideWhenLoggedIn": false,
      "isLogout": true
    }
  ],
  "count": 3
}
```

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | number | Unik ID |
| `title` | string | Menyelement-navn |
| `url` | string | Lenke |
| `icon` | string? | Ikon (emoji eller null) |
| `order` | number | Sorteringsrekkefølge |
| `openInNewTab` | boolean | Åpne i ny fane |
| `role` | string | Minimum rolle for visning: `"anonym"`, `"medlem"`, `"styre"`, `"admin"` |
| `hideWhenLoggedIn` | boolean | Skjul når bruker er innlogget (f.eks. "Logg inn"-lenke) |
| `isLogout` | boolean | Om dette er en utloggingsknapp |

---

### Forside

#### `GET /forside/artikkel`

**Request:** Ingen body

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "Velkommen til Kammerkoret Utsikten",
    "text": "Artikkelinnhold her...\n\n$picture\n\nMer tekst...",
    "format": "text",
    "imageUrl": "https://storage.blob.core.windows.net/images/forside.jpg",
    "imagePlacement": "angitt"
  }
}
```

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `title` | string | Artikkeltittel |
| `text` | string | Innhold (kan inneholde `$picture` for bildeplassering) |
| `format` | string | `"text"`, `"markdown"`, eller `"html"` |
| `imageUrl` | string? | URL til bilde (valgfritt) |
| `imagePlacement` | string | `"over"`, `"under"`, eller `"angitt"` |

---

#### `GET /forside/kontaktpersoner`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Kari Nordmann",
      "email": "dirigent@utsiktenkor.no",
      "phone": "99 88 77 66",
      "kontaktrolle": "Dirigent"
    },
    {
      "id": 2,
      "name": "Ola Hansen",
      "email": "leder@utsiktenkor.no",
      "phone": "99 11 22 33",
      "kontaktrolle": "Korleder"
    }
  ],
  "count": 2
}
```

---

#### `GET /forside/hurtiglenker`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "title": "Konserter",
      "url": "/konserter.html",
      "icon": "🎭",
      "description": "Se kommende konserter",
      "order": 1,
      "openInNewTab": false
    }
  ],
  "count": 1
}
```

---

### Meldinger

#### `GET /meldinger/liste`

**Request headers:**
```
Authorization: Bearer <token>
```

**Query params (valgfritt):**
- `limit` - Maks antall (default: 20)
- `offset` - Start fra (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 101,
      "title": "Viktig info om julekonserten",
      "content": "Husk å møte opp kl 17:00 for lydprøve...",
      "format": "markdown",
      "author": "Styret",
      "publishedAt": "2024-12-01T10:00:00Z",
      "imageUrl": "",
      "isImportant": true,
      "isPinned": false,
      "commentCount": 3,
      "comments": [
        {
          "id": 201,
          "author": "Ola Nordmann",
          "email": "ola@example.com",
          "text": "Takk for info!",
          "createdAt": "2024-12-01T12:30:00Z"
        }
      ]
    }
  ],
  "count": 15,
  "total": 45
}
```

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `format` | string | Innholdsformat: `"text"`, `"markdown"` eller `"html"` |
| `imageUrl` | string | URL til bilde (tom streng hvis ingen) |
| `comments[].email` | string | Kommentarforfatterens e-post |

---

#### `POST /meldinger/ny`

Oppretter en ny melding fra styret. Kun styre/admin har tilgang.

**Miljøvariabel:** `POWER_AUTOMATE_CREATE_MESSAGE_URL`

**Request:**
```json
{
  "title": "Viktig info om vårkonserten",
  "content": "Husk å møte opp kl 17:00 for lydprøve...",
  "authorName": "Kari Nordmann",
  "authorEmail": "kari@example.com"
}
```

| Felt | Type | Påkrevd | Beskrivelse |
|------|------|---------|-------------|
| `title` | string | Ja | Meldingstittel |
| `content` | string | Ja | Innhold (støtter markdown) |
| `authorName` | string | Ja | Forfatterens navn |
| `authorEmail` | string | Ja | Forfatterens e-post |

**Response:**
```json
{
  "success": true,
  "message": "Melding publisert",
  "id": 102
}
```

---

#### `POST /meldinger/kommentar`

**Miljøvariabel:** `POWER_AUTOMATE_MESSAGE_COMMENTS_URL`

**Request:**
```json
{
  "messageId": "101",
  "text": "Takk for info!",
  "authorName": "Ola Nordmann",
  "authorEmail": "ola@example.com"
}
```

| Felt | Type | Påkrevd | Beskrivelse |
|------|------|---------|-------------|
| `messageId` | string | Ja | ID til meldingen (konverteres til streng) |
| `text` | string | Ja | Kommentartekst |
| `authorName` | string | Ja | Forfatterens navn |
| `authorEmail` | string | Ja | Forfatterens e-post |

**Response:**
```json
{
  "success": true,
  "message": "Kommentar lagt til",
  "id": 202
}
```

---

### Innlegg

#### `GET /innlegg/liste`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 301,
      "title": "Noen som vil samkjøre til konserten?",
      "content": "Jeg kjører fra Majorstuen...",
      "author": {
        "id": 42,
        "name": "Ola Nordmann"
      },
      "createdAt": "2024-11-28T14:00:00Z",
      "commentCount": 5,
      "comments": []
    }
  ],
  "count": 10,
  "total": 28
}
```

---

#### `POST /innlegg/nytt`

**Miljøvariabel:** `POWER_AUTOMATE_CREATE_POST_URL`

**Request:**
```json
{
  "title": "Noen som vil samkjøre?",
  "content": "Jeg kjører fra Majorstuen...",
  "authorName": "Ola Nordmann",
  "authorEmail": "ola@example.com",
  "authorVoice": "tenor 1"
}
```

| Felt | Type | Påkrevd | Beskrivelse |
|------|------|---------|-------------|
| `title` | string | Ja | Innleggstittel |
| `content` | string | Ja | Innhold (støtter markdown) |
| `authorName` | string | Ja | Forfatterens navn |
| `authorEmail` | string | Ja | Forfatterens e-post |
| `authorVoice` | string | Nei | Forfatterens stemmegruppe (f.eks. "tenor 1") |

**Response:**
```json
{
  "success": true,
  "message": "Innlegg publisert",
  "id": 302
}
```

---

#### `POST /innlegg/kommentar`

**Miljøvariabel:** `POWER_AUTOMATE_POST_COMMENTS_URL`

**Request:**
```json
{
  "postId": "301",
  "text": "Jeg kan sitte på!",
  "authorName": "Kari Nordmann",
  "authorEmail": "kari@example.com"
}
```

| Felt | Type | Påkrevd | Beskrivelse |
|------|------|---------|-------------|
| `postId` | string | Ja | ID til innlegget (konverteres til streng) |
| `text` | string | Ja | Kommentartekst |
| `authorName` | string | Ja | Forfatterens navn |
| `authorEmail` | string | Ja | Forfatterens e-post |

**Response:**
```json
{
  "success": true,
  "message": "Kommentar lagt til",
  "id": 402
}
```

---

### Øvelse

#### `GET /ovelse/program`

Henter øvelsesdata med repertoar, noter og lydfiler. Returnerer alle verk med base-URLer for PDF og audio, samt eventuelt registrerte sideskifttidspunkter for autoblading.

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "Vårprogram 2026",
    "voice": "tutti",
    "baseUrls": {
      "pdf": "https://storage.blob.core.windows.net/sanger/",
      "audio": "https://storage.blob.core.windows.net/sanger/"
    },
    "notes": [
      {
        "id": "Sanctus",
        "noteTitle": "Sanctus",
        "pdfFilename": "Sanctus - Ola Gjeilo.pdf",
        "audio": {
          "sopran 1": "Sanctus - Sopran 1.mp3",
          "sopran 2": "Sanctus - Sopran 2.mp3",
          "alt 1": "Sanctus - Alt 1.mp3",
          "alt 2": "Sanctus - Alt 2.mp3",
          "tenor 1": "Sanctus - Tenor 1.mp3",
          "tenor 2": "Sanctus - Tenor 2.mp3",
          "bass 1": "Sanctus - Bass 1.mp3",
          "bass 2": "Sanctus - Bass 2.mp3",
          "tutti": "Sanctus - Tutti.mp3"
        },
        "pageTurns": [
          { "time": 45.2, "page": 2 },
          { "time": 92.8, "page": 3 },
          { "time": 138.5, "page": 4 }
        ]
      },
      {
        "id": "Northern Lights",
        "noteTitle": "Northern Lights",
        "pdfFilename": "Northern Lights - Ola Gjeilo.pdf",
        "audio": {},
        "pageTurns": []
      }
    ]
  }
}
```

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `title` | string | Programtittel |
| `voice` | string | Standard stemmegruppe |
| `baseUrls.pdf` | string | Basis-URL for PDF-filer |
| `baseUrls.audio` | string | Basis-URL for lydfiler |
| `notes[].id` | string | Unik verk-ID |
| `notes[].noteTitle` | string | Visningstittel |
| `notes[].pdfFilename` | string | Filnavn for PDF (kombineres med `baseUrls.pdf`) |
| `notes[].audio` | object | Nøkkel = stemmegruppe, verdi = filnavn (kombineres med `baseUrls.audio`) |
| `notes[].pageTurns` | array | Sideskifttidspunkter for autoblading. Tom array hvis ikke registrert. |
| `notes[].pageTurns[].time` | number | Tidspunkt i sekunder for sideskift |
| `notes[].pageTurns[].page` | number | Sidenummer det skal blas til (1-indeksert). Trenger ikke være sekvensielt - støtter hopp (dal segno, coda). |

---

#### `POST /ovelse/sideskift`

Lagrer sideskifttidspunkter for et verk. Brukes av admin-verktøyet for registrering av autoblading.

**Request:**
```json
{
  "workId": "Sanctus",
  "pageTurns": [
    { "time": 45.2, "page": 2 },
    { "time": 92.8, "page": 3 },
    { "time": 120.3, "page": 2 },
    { "time": 138.5, "page": 4 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sideskifttidspunkter lagret"
}
```

---

### Noter (bibliotek — legacy)

Brukes av øvelsessiden og andre steder som trenger notebiblioteket.

**Miljøvariabel:** `POWER_AUTOMATE_NOTES_URL`

#### `GET /noter/bibliotek`

**Query params (valgfritt):**
- `voice` - Filter på stemme
- `category` - Filter på kategori
- `search` - Søketekst

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 501,
      "title": "Ave Maria",
      "composer": "Franz Biebl",
      "voiceGroup": "Tenor-1",
      "category": "Klassisk",
      "pdfUrl": "https://storage.blob.core.windows.net/noter/ave-maria-t1.pdf",
      "audioUrl": "https://storage.blob.core.windows.net/audio/ave-maria-t1.mp3"
    }
  ],
  "count": 45,
  "categories": ["Klassisk", "Folkemusikk", "Julesanger", "Moderne"]
}
```

---

### Nedlasting

#### `GET /nedlasting/filer`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 601,
      "title": "Medlemsliste 2025",
      "description": "Oppdatert kontaktliste for alle medlemmer",
      "filename": "medlemsliste-2025.pdf",
      "fileUrl": "https://storage.blob.core.windows.net/filer/medlemsliste-2025.pdf",
      "fileSize": 245000,
      "mimeType": "application/pdf",
      "uploadedAt": "2025-01-15T09:00:00Z",
      "category": "Administrasjon"
    }
  ],
  "count": 12
}
```

---

### Konserter

#### `GET /konserter/liste`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 701,
      "title": "Vårkonsert 2025",
      "description": "Konsert med vårens vakreste sanger",
      "date": "2025-04-15",
      "time": "19:00",
      "location": "Oslo Konserthus",
      "address": "Munkedamsveien 14, 0115 Oslo",
      "imageUrl": "https://storage.blob.core.windows.net/images/varkonsert.jpg",
      "ticketPrice": 250,
      "ticketsAvailable": 150,
      "ticketUrl": null,
      "isPublic": true
    }
  ],
  "count": 3
}
```

---

#### `POST /konserter/billett`

**Request:**
```json
{
  "concertId": 701,
  "name": "Per Hansen",
  "email": "per@example.com",
  "phone": "+47 99887766",
  "ticketCount": 2,
  "message": "Trenger rullestolplass"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bestilling mottatt! Bekreftelse sendt til per@example.com",
  "referenceNumber": "UTK-2026-0042",
  "totalPrice": 500
}
```

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `referenceNumber` | string | Unik referanse som kunden bruker ved Vipps-betaling |
| `totalPrice` | number | Totalbeløp i NOK |

---

### Billettadministrasjon (styre/admin)

#### `GET /billetter/ubetalte`

Henter alle ubetalte billettreservasjoner for administrasjon.

**Miljøvariabel:** `POWER_AUTOMATE_TICKET_ADMIN_URL`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "concertId": 1,
      "concertTitle": "Vårkonsert 2026",
      "concertDate": "2026-04-18",
      "name": "Ola Nordmann",
      "email": "ola@example.com",
      "phone": "+47 123 45 678",
      "ticketCount": 2,
      "totalPrice": 500,
      "reservationDate": "2026-02-01T12:00:00Z",
      "isPaid": false
    }
  ]
}
```

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | number | Unik reservasjons-ID |
| `concertId` | number | ID til konserten |
| `concertTitle` | string | Konsertnavn |
| `concertDate` | string | Konsertdato (YYYY-MM-DD) |
| `name` | string | Kundens navn |
| `email` | string | Kundens e-post |
| `phone` | string | Kundens telefon (kan være tom) |
| `ticketCount` | number | Antall billetter |
| `totalPrice` | number | Totalbeløp i NOK |
| `reservationDate` | string | Tidspunkt for bestilling (ISO 8601) |
| `isPaid` | boolean | Betalingsstatus |

---

#### `POST /billetter/marker-betalt`

Markerer valgte reservasjoner som betalt. Flyten skal oppdatere SharePoint-lista og sende e-postbillett til hver kunde via malen `assets/email-ticket.html`.

**Miljøvariabel:** `POWER_AUTOMATE_TICKET_ADMIN_UPDATE_URL`

**Request:**
```json
{
  "reservationIds": ["1", "3", "5"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "3 reservasjoner markert som betalt",
  "updatedIds": ["1", "3", "5"]
}
```

---

#### E-postmal (`assets/email-ticket.html`)

Tabell-basert HTML-mal med inline CSS for e-postklienter. Flyten erstatter følgende tokens:

| Token | Beskrivelse |
|-------|-------------|
| `{{CONCERT_TITLE}}` | Konsertnavn |
| `{{CONCERT_DATE}}` | Dato (f.eks. "18. april 2026") |
| `{{CONCERT_TIME}}` | Klokkeslett (f.eks. "19:00") |
| `{{CONCERT_LOCATION}}` | Konsertsted |
| `{{TICKET_HOLDER_NAME}}` | Kundens navn |
| `{{TICKET_COUNT}}` | Antall billetter |
| `{{TOTAL_PRICE}}` | Totalpris i NOK |
| `{{REFERENCE_NUMBER}}` | Referansenummer (f.eks. UTK-2026-0042) |
| `{{QR_CODE_URL}}` | URL til QR-kode-bilde (se under) |
| `{{LOGO_URL}}` | URL til korets logo |

**QR-kode genereres i flyten** med denne URL-en:
```
https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=<referansenummer>
```

---

### Billettkontroll (styre/admin)

#### `POST /billettkontroll/valider`

Validerer en billettreferanse ved QR-skanning og registrerer innsjekk i Billettreservasjoner-listen. Flyten slår opp referansenummeret, sjekker status, og markerer billetten som innsjekket hvis gyldig.

**Miljøvariabel:** `POWER_AUTOMATE_TICKET_VALIDATE_URL`

**Request:**
```json
{
  "referenceNumber": "UTK-2026-0042"
}
```

**Response:** `status` for fargekoding + `message` som vises direkte i appen.

| Status | Message | Farge |
|--------|---------|-------|
| `valid` | Gyldig billett — sjekket inn | Grønn |
| `already_checked_in` | Allerede sjekket inn | Gul |
| `not_paid` | Ikke betalt | Rød |
| `not_found` | Ukjent billett | Rød |

**Response (gyldig):**
```json
{
  "status": "valid",
  "message": "Gyldig billett — sjekket inn"
}
```

**Response (allerede sjekket inn):**
```json
{
  "status": "already_checked_in",
  "message": "Allerede sjekket inn"
}
```

**Response (ikke betalt):**
```json
{
  "status": "not_paid",
  "message": "Ikke betalt"
}
```

**Response (ikke funnet):**
```json
{
  "status": "not_found",
  "message": "Ukjent billett"
}
```

---

### Musikk (innspillinger)

#### `GET /musikk/konserter`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 801,
      "title": "Julekonsert 2024",
      "date": "2024-12-15",
      "location": "Vålerenga kirke",
      "description": "Magisk julekonsert med tradisjonsrike sanger",
      "images": [
        {
          "url": "https://storage.blob.core.windows.net/images/jul2024-1.jpg",
          "caption": "Koret i aksjon"
        },
        {
          "url": "https://storage.blob.core.windows.net/images/jul2024-2.jpg",
          "caption": "Fullsatt kirke"
        }
      ],
      "tracks": [
        {
          "id": 1,
          "title": "O Helga Natt",
          "duration": 245,
          "audioUrl": "https://storage.blob.core.windows.net/audio/jul2024/01-o-helga-natt.mp3"
        },
        {
          "id": 2,
          "title": "Deilig er jorden",
          "duration": 198,
          "audioUrl": "https://storage.blob.core.windows.net/audio/jul2024/02-deilig-er-jorden.mp3"
        }
      ]
    }
  ],
  "count": 5
}
```

---

### Medlemsside

#### `GET /medlemmer/side`

Henter artikkel og arrangementer for medlemssiden.

**Miljøvariabel:** `POWER_AUTOMATE_MEMBERS_PAGE_URL`

**Response:**
```json
{
  "success": true,
  "data": {
    "article": {
      "title": "Velkommen, kormedlemmer!",
      "text": "Her finner du informasjon...\n\n$picture\n\nMer tekst...",
      "format": "markdown",
      "imageUrl": "https://storage.blob.core.windows.net/images/medlemmer.jpg",
      "imagePlacement": "angitt"
    },
    "events": [
      {
        "id": 1,
        "title": "Korøvelse",
        "description": "Vanlig øvelse med fokus på vårkonsert",
        "date": "2026-02-10",
        "startTime": "18:00",
        "endTime": "20:30",
        "location": "Øvingslokalet, Kulturhuset",
        "attendees": [
          { "name": "Ola Nordmann", "email": "ola@example.com", "status": "attending" },
          { "name": "Kari Hansen", "email": "kari@example.com", "status": "not_attending" }
        ],
        "totalMembers": 25
      }
    ]
  }
}
```

---

#### `POST /medlemmer/rsvp`

Registrerer deltakelse på arrangement.

**Miljøvariabel:** `POWER_AUTOMATE_MEMBERS_PAGE_RSVP_URL`

**Request:**
```json
{
  "eventId": 1,
  "action": "attending",
  "memberName": "Ola Nordmann",
  "memberEmail": "ola@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registrert som deltaker"
}
```

| Felt | Type | Verdier |
|------|------|---------|
| `action` | string | `"attending"` eller `"not_attending"` |
| `status` (attendees) | string | `"attending"`, `"not_attending"` |

---

### Filbehandling (styre/admin)

#### `GET /filer/liste`

Henter alle filer med metadata for kategorisering.

**Miljoevariabel:** `POWER_AUTOMATE_FILES_URL`

**Response:**
```json
{
  "success": true,
  "filer": [
    {
      "id": "1",
      "navn": "Halleluja - Sopran ovefil.mp3",
      "kategori": "Øvefil",
      "url": "/filer/musikk/halleluja-sopran.mp3",
      "sortering": 1,
      "verk": "Halleluja fra Messias",
      "stemme": "Sopran-1",
      "anledning": "Julekonsert 2024"
    },
    {
      "id": "5",
      "navn": "Ave Maria - Partitur.pdf",
      "kategori": "Note",
      "url": "/filer/noter/ave-maria-partitur.pdf",
      "sortering": 5,
      "verk": "Ave Maria",
      "stemme": "Partitur",
      "anledning": "Varkonsert 2025"
    },
    {
      "id": "8",
      "navn": "Konsertbilde domkirken.jpg",
      "kategori": "",
      "url": "/filer/bilder/domkirken-2024.jpg",
      "sortering": null,
      "verk": "",
      "stemme": "",
      "anledning": "Julekonsert 2024"
    }
  ]
}
```

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | string | SharePoint elementnummer |
| `navn` | string | Filnavn med filtype (f.eks. `"Halleluja - Sopran.mp3"`) |
| `kategori` | string | `"Note"`, `"Opptak"`, `"Øvefil"`, `"Sideskift"` eller tom |
| `url` | string | URL til filen |
| `sortering` | number/null | Rekkefølge i konsert (null hvis ikke satt) |
| `verk` | string | Musikkverkets navn |
| `stemme` | string | Stemmegruppe |
| `anledning` | string | Konsert/hendelse |

**Stemme-verdier:**
- `Sopran-1`, `Sopran-2`
- `Alt-1`, `Alt-2`
- `Tenor-1`, `Tenor-2`
- `Bass-1`, `Bass-2`
- `Tutti`, `Partitur`

---

#### `POST /filer/oppdater`

Oppdaterer metadata for en fil.

**Miljoevariabel:** `POWER_AUTOMATE_FILES_UPDATE_URL`

**Request:**
```json
{
  "id": "1",
  "kategori": "Øvefil",
  "verk": "Halleluja fra Messias",
  "stemme": "Sopran-1",
  "sortering": 1,
  "anledning": "Julekonsert 2024"
}
```

| Felt | Type | Påkrevd | Beskrivelse |
|------|------|---------|-------------|
| `id` | string | Ja | Fil-ID |
| `kategori` | string | Nei | Note, Opptak, Øvefil, Sideskift eller tom |
| `verk` | string | Nei | Musikkverkets navn |
| `stemme` | string | Nei | Stemmegruppe |
| `sortering` | number/null | Nei | Rekkefølge i konsert |
| `anledning` | string | Nei | Konsert/hendelse |

**Response:**
```json
{
  "success": true,
  "message": "Metadata oppdatert"
}
```

---

### Spillelister og filer (styre/admin)

Siden `noter.html` er en admin-side for filbehandling med multi-valg, batch-oppdatering av metadata og blob-storage-operasjoner. Bruker de samme filendepunktene som filbehandling pluss egne blob-endepunkter.

Datahenting bruker `GET /filer/liste` (dokumentert over). Filene filtreres på `kategori`-feltet:

| `kategori`-verdi | Filterkategori |
|-------------------|----------------|
| `Note` | Note |
| `Opptak` | Opptak |
| `Øvefil` | Øvefil |
| `Sideskift` | Sideskift |
| (tom) | Ukategorisert |

Sortering følger `sortering`-feltet (numerisk), deretter `navn` alfabetisk.

Søk matcher mot `navn`, `anledning` og `verk`.

---

#### `POST /filer/batch-oppdater`

Batch-oppdaterer metadata for flere filer samtidig. Brukes fra spillelister-siden. Kun felt som er inkludert i requesten oppdateres.

**Miljøvariabel:** `POWER_AUTOMATE_FILES_UPDATE_URL`

**Request:**
```json
{
  "fileIds": ["1", "3", "6"],
  "kategori": "Øvefil", 
  "verk": "Halleluja fra Messias",
  "stemme": "sopran-1",
  "sortering": 5,
  "anledning": "Vårkonsert 2026"
}
```

| Felt | Type | Påkrevd | Beskrivelse |
|------|------|---------|-------------|
| `fileIds` | string[] | Ja | Liste med fil-IDer som skal oppdateres |
| `kategori` | string | Nei | Note, Opptak, Øvefil, Sideskift |
| `verk` | string | Nei | Musikkverkets navn |
| `stemme` | string | Nei | Stemmegruppe |
| `sortering` | number | Nei | Rekkefølge i konsert |
| `anledning` | string | Nei | Konsert/hendelse |

**Response:**
```json
{
  "success": true,
  "message": "3 filer oppdatert"
}
```

---

#### `POST /blob/last-opp`

Laster opp markerte filer til Azure Blob Storage.

**Miljøvariabel:** `POWER_AUTOMATE_BLOB_UPLOAD_URL`

**Request:**
```json
{
  "files": [
    {
      "id": "1",
      "url": "/filer/musikk/halleluja-sopran.mp3",
      "navn": "Halleluja - Sopran ovefil.mp3"
    },
    {
      "id": "6",
      "url": "/filer/noter/o-magnum-alt.pdf",
      "navn": "O Magnum Mysterium - Alt stemme.pdf"
    }
  ]
}
```

| Felt | Type | Påkrevd | Beskrivelse |
|------|------|---------|-------------|
| `files` | array | Ja | Liste med filreferanser |
| `files[].id` | string | Ja | Fil-ID |
| `files[].url` | string | Ja | URL til kildefilen |
| `files[].navn` | string | Ja | Filnavn med filtype |

**Response:**
```json
{
  "success": true,
  "message": "2 filer lastet opp til blob-storage"
}
```

---

#### `POST /blob/tøm`

Tømmer all blob-storage. Krever bekreftelse i UI.

**Miljøvariabel:** `POWER_AUTOMATE_BLOB_CLEAR_URL`

**Request:**
```json
{
  "action": "clear_all"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Blob-storage er tømt"
}
```

---

### Styresider (styre/admin)

Medlemsadministrasjon med CRUD-operasjoner, kontingentsporing og e-postutsending.

#### `GET /styre/medlemmer`

Henter alle medlemmer for styreadministrasjon.

**Miljøvariabel:** `POWER_AUTOMATE_STYRE_MEMBERS_URL`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "Anna Johansen",
      "email": "anna.johansen@example.com",
      "phone": "+47 901 23 456",
      "voice": "sopran 1",
      "role": "admin",
      "kontingentBetalt": true,
      "joinedAt": "2019-08-15"
    }
  ]
}
```

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id` | string | Unik medlems-ID |
| `name` | string | Fullt navn |
| `email` | string | E-postadresse |
| `phone` | string | Telefonnummer (kan være tom) |
| `voice` | string | Stemmegruppe (f.eks. `"sopran 1"`, `"bass 2"`) |
| `role` | string | `"medlem"`, `"styre"` eller `"admin"` |
| `kontingentBetalt` | boolean | Om kontingent er betalt |
| `joinedAt` | string | Dato for medlemskap (YYYY-MM-DD) |

---

#### `POST /styre/registrer-medlem`

Registrerer nytt medlem.

**Miljøvariabel:** `POWER_AUTOMATE_STYRE_REGISTER_MEMBER_URL`

**Request:**
```json
{
  "name": "Ny Medlem",
  "email": "ny@example.com",
  "phone": "+47 912 34 567",
  "voice": "tenor 1",
  "role": "medlem",
  "kontingentBetalt": false
}
```

| Felt | Type | Påkrevd | Beskrivelse |
|------|------|---------|-------------|
| `name` | string | Ja | Fullt navn |
| `email` | string | Ja | E-postadresse |
| `phone` | string | Nei | Telefonnummer |
| `voice` | string | Ja | Stemmegruppe |
| `role` | string | Ja | `"medlem"`, `"styre"` eller `"admin"` |
| `kontingentBetalt` | boolean | Nei | Kontingent betalt (default: false) |

**Response:**
```json
{
  "success": true,
  "message": "Medlem registrert",
  "id": "42"
}
```

---

#### `POST /styre/oppdater-medlem`

Oppdaterer et eksisterende medlem. Kun felt som er inkludert oppdateres.

**Miljøvariabel:** `POWER_AUTOMATE_STYRE_UPDATE_MEMBER_URL`

**Request:**
```json
{
  "memberId": "42",
  "name": "Oppdatert Navn",
  "voice": "alt 1",
  "kontingentBetalt": true
}
```

| Felt | Type | Påkrevd | Beskrivelse |
|------|------|---------|-------------|
| `memberId` | string | Ja | Medlems-ID |
| `name` | string | Nei | Fullt navn |
| `email` | string | Nei | E-postadresse |
| `phone` | string | Nei | Telefonnummer |
| `voice` | string | Nei | Stemmegruppe |
| `role` | string | Nei | Rolle |
| `kontingentBetalt` | boolean | Nei | Kontingent betalt |

**Response:**
```json
{
  "success": true,
  "message": "Medlem oppdatert"
}
```

---

#### `POST /styre/slett-medlem`

Sletter et medlem.

**Miljøvariabel:** `POWER_AUTOMATE_STYRE_DELETE_MEMBER_URL`

**Request:**
```json
{
  "memberId": "42"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Medlem slettet"
}
```

---

#### `POST /styre/send-epost`

Sender e-post til valgte medlemmer.

**Miljøvariabel:** `POWER_AUTOMATE_STYRE_SEND_EMAIL_URL`

**Request:**
```json
{
  "recipients": ["anna@example.com", "erik@example.com"],
  "subject": "Viktig info om øvelse",
  "message": "Husk å ta med noter til neste øvelse..."
}
```

| Felt | Type | Påkrevd | Beskrivelse |
|------|------|---------|-------------|
| `recipients` | string[] | Ja | Liste med e-postadresser |
| `subject` | string | Ja | E-postemne |
| `message` | string | Ja | Meldingsinnhold |

**Response:**
```json
{
  "success": true,
  "message": "E-post sendt til 2 mottakere"
}
```

#### E-postmal (`assets/email-member.html`)

Tabell-basert HTML-mal med inline CSS, samme designsystem som billettmalen. Flyten erstatter følgende tokens:

| Token | Beskrivelse |
|-------|-------------|
| `{{SUBJECT}}` | E-postemne (brukes i `<title>` og som overskrift) |
| `{{MESSAGE}}` | Meldingsinnhold (støtter linjeskift via `white-space: pre-line`) |
| `{{SENDER_NAME}}` | Avsenderens navn |
| `{{SENT_DATE}}` | Sendedato (f.eks. "7. mars 2026") |
| `{{LOGO_URL}}` | URL til korets logo |

---

### Min profil (medlem)

Profilside der medlemmer kan oppdatere personlig informasjon, e-postvarsler og app-innstillinger. Data lagres i SharePoint og synkroniseres med localStorage.

#### `POST /profil/hent`

Henter profildata for innlogget medlem.

**Miljøvariabel:** `POWER_AUTOMATE_PROFILE_URL`

**Request:**
```json
{
  "epost": "medlem@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "navn": "Ola Nordmann",
    "epost": "ola@example.com",
    "telefon": "+47 99887766",
    "stemme": "tenor 1",
    "varsler": {
      "innlegg": true,
      "arrangementer": true,
      "meldinger": false
    },
    "preferanser": {
      "tema": "dark"
    }
  }
}
```

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `navn` | string | Fullt navn |
| `epost` | string | E-postadresse |
| `telefon` | string | Telefonnummer |
| `stemme` | string | Stemmegruppe (f.eks. `"sopran 1"`, `"bass 2"`) |
| `varsler.innlegg` | boolean | Varsle om nye innlegg |
| `varsler.arrangementer` | boolean | Varsle om nye arrangementer |
| `varsler.meldinger` | boolean | Varsle om meldinger fra styret |
| `preferanser.tema` | string | `"dark"` eller `"light"` |

---

#### `POST /profil/oppdater`

Oppdaterer profildata og innstillinger.

**Miljøvariabel:** `POWER_AUTOMATE_PROFILE_UPDATE_URL`

**Request:**
```json
{
  "epost": "ola@example.com",
  "navn": "Ola Nordmann",
  "telefon": "+47 99887766",
  "stemme": "tenor 1",
  "varsler": {
    "innlegg": true,
    "arrangementer": true,
    "meldinger": false
  },
  "preferanser": {
    "tema": "dark"
  }
}
```

| Felt | Type | Påkrevd | Beskrivelse |
|------|------|---------|-------------|
| `epost` | string | Ja | E-post (brukes som nøkkel) |
| `navn` | string | Nei | Fullt navn |
| `telefon` | string | Nei | Telefonnummer |
| `stemme` | string | Nei | Stemmegruppe |
| `varsler` | object | Nei | E-postvarsler (innlegg, arrangementer, meldinger) |
| `preferanser` | object | Nei | App-innstillinger (tema) |

**Response:**
```json
{
  "success": true,
  "message": "Profil oppdatert"
}
```

---

## Felles datatyper

### Member (bruker/medlem)
```json
{
  "id": 42,
  "name": "Ola Nordmann",
  "email": "ola@example.com",
  "role": "medlem",
  "voice": "tenor 1",
  "phone": "99887766",
  "joinedAt": "2020-01-15"
}
```

| Felt | Type | Verdier |
|------|------|---------|
| `role` | string | `"anonym"`, `"medlem"`, `"styre"`, `"admin"` |
| `voice` | string | `"sopran 1"`, `"sopran 2"`, `"alt 1"`, `"alt 2"`, `"tenor 1"`, `"tenor 2"`, `"bass 1"`, `"bass 2"` |

### Timestamps

Alle tidsstempler bruker ISO 8601-format i UTC:
```
"2025-01-26T14:30:00Z"
```

### Feilkoder

| HTTP-kode | Betydning |
|-----------|-----------|
| 200 | OK |
| 400 | Ugyldig request (manglende/feil felt) |
| 401 | Ikke autentisert |
| 403 | Ikke autorisert (feil rolle) |
| 404 | Ressurs ikke funnet |
| 500 | Serverfeil |

---

### 3. Konfigurer miljøvariabler

```bash
cp .env.example .env
```

Rediger `js/env.js` og fyll inn Power Automate-URLene. Se `js/env.example.js` for oversikt over alle variabler.

### 4. Lokal utvikling

For lokal utvikling kan du bruke en enkel HTTP-server:

```bash
# Med Python
python -m http.server 8080

# Med Node.js (npx)
npx serve

# Med VS Code Live Server-utvidelsen
# Høyreklikk på index.html -> "Open with Live Server"
```

### 5. Deploy til Azure Static Web Apps

#### Alternativ A: Fra VS Code (anbefalt)

1. **Installer utvidelsen** - Søk etter "Azure Static Web Apps" i VS Code Extensions

2. **Logg inn** - Klikk på Azure-ikonet i sidepanelet og logg inn med Azure-kontoen din

3. **Opprett Static Web App**:
   - Høyreklikk på abonnementet ditt
   - Velg "Create Static Web App (Advanced)..."
   - Følg veiviseren:
     - Navn: `korportal`
     - Region: `West Europe`
     - Build preset: `Custom`
     - App location: `/`
     - Output location: `/`

4. **Deploy oppdateringer**:
   - Høyreklikk på appen i Azure-panelet
   - Velg "Deploy to Static Web App..."
   - Eller koble til GitHub for automatisk deploy ved push

#### Alternativ B: Med Azure CLI

```bash
# Installer Azure CLI
az login

# Opprett Static Web App
az staticwebapp create \
  --name korportal \
  --resource-group din-ressursgruppe \
  --source https://github.com/din-bruker/korportal \
  --location westeurope \
  --branch main \
  --app-location "/" \
  --output-location "/"
```

## SharePoint Liste-strukturer

### Navigasjon

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| Title | Tekst | Menyelement-navn |
| URL | Tekst | Lenke |
| Icon | Tekst | Ikon (emoji/klasse) |
| Order | Tall | Sorteringsrekkefølge |
| OpenInNewTab | Ja/Nei | Åpne i ny fane |

### Kunngjøringer

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| Title | Tekst | Overskrift |
| Content | Flerlinjers tekst | Innhold (HTML) |
| PublishDate | Dato | Publiseringsdato |
| IsImportant | Ja/Nei | Marker som viktig |
| Category | Valg | Kategori |

### Hurtiglenker

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| Title | Tekst | Lenketekst |
| URL | Tekst | Lenke |
| Icon | Tekst | Ikon |
| Description | Tekst | Beskrivelse |
| Order | Tall | Sorteringsrekkefølge |

### Noter (Notebibliotek)

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| Title | Tekst | Navn på musikkverket |
| Composer | Tekst | Komponist |
| VoiceGroup | Valg | Stemmegruppe (Sopran-1, Alt-1, Bass, Tutti, etc.) |
| Category | Valg | Kategori (Klassisk, Folkemusikk, Julesanger, etc.) |
| PDFFileURL | URL | Lenke til PDF-noter |
| AudioFileURL | URL | Lenke til lydopptak |

### Billettreservasjoner

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| Title | Tekst | Kundens navn |
| Email | Tekst | Kundens e-post |
| Phone | Tekst | Kundens telefon |
| ConcertId | Oppslag | Kobling til Konserter-listen |
| TicketCount | Tall | Antall billetter |
| TotalPrice | Tall | Totalbeløp (NOK) |
| ReferenceNumber | Tekst | Unik referanse (f.eks. UTK-2026-0042) |
| ReservationDate | Dato | Tidspunkt for bestilling |
| IsPaid | Ja/Nei | Om billetten er betalt |
| PaidDate | Dato | Tidspunkt for betaling |
| IsCheckedIn | Ja/Nei | Om billetten er sjekket inn ved dør |
| CheckinTime | Dato | Tidspunkt for innsjekk |

> **Merk**: Stemmegrupper stotter bade spesifikke stemmer (Bass-1, Bass-2) og generelle (Bass). Ved filtrering pa f.eks. Bass-1 vises ogsa noter merket med Bass.

### Filbibliotek (for filbehandling)

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | Automatisk | SharePoint elementnummer (heltall, sendes som streng) |
| Navn | Tekst | Filnavn med filtype (f.eks. `Halleluja - Sopran.mp3`) |
| Kategori | Valg | Note, Opptak, Øvefil, Sideskift (eller tom) |
| URL | URL | Lenke til filen |
| Sortering | Tall | Rekkefølge i konsert |
| Verk | Tekst | Musikkverkets navn |
| Stemme | Valg | Stemmegruppe |
| Anledning | Tekst | Konsert/hendelse |

Se `sharepoint/list-schemas.md` for komplett dokumentasjon.

## Sikkerhet

- Alle Power Automate-URLer inneholder signerte tokens
- Azure AD-autentisering for brukertilgang
- CSP-headers konfigurert i `staticwebapp.config.json`
- XSS-beskyttelse implementert i JavaScript

## Utvikling

### Kodestandard

- ES6+ JavaScript med moduler
- BEM-navngivning for CSS
- Semantisk HTML5
- Mobile-first responsivt design

### Testing

```bash
# Kjør med lokal server og test i nettleser
# Bruk nettleserens DevTools for debugging
```

## Lisens

Intern bruk.

## Kontakt

IT-avdelingen
