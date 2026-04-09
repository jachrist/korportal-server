# Ny arkitektur: Azure Functions + Table Storage

Vurdering og forslag til migrering fra Power Automate + SharePoint til en enklere og rimeligere arkitektur.

---

## 1. Nåsituasjon

### Arkitektur

```
Nettleser (PWA)
  → Power Automate HTTP-flyter (34 endepunkt-URLer med SAS-token)
    → SharePoint Online-lister (13 lister, hybrid kolonne+JSON)
    → Azure Blob Storage (sanger-container: noter, ovefiler, opptak)
```

### Kostnader (nåvaerende)

| Komponent | Formål | Kostnadsdriver |
|-----------|--------|----------------|
| Microsoft 365 / SharePoint | Lagring + listedata | Lisens per bruker eller via organisasjonens M365 |
| Power Automate | 34 HTTP-flyter | Premium-koblinger (HTTP request trigger), flytkjoringer |
| Azure Blob Storage | PDF-er, MP3-er, bilder | Liten (~GB-omfang), rimelig |
| Azure Static Web Apps (Free) | Hosting av PWA | Gratis |

**Hovedkostnad:** Power Automate Premium-lisens for HTTP request-triggere, samt SharePoint-avhengigheten som krever M365-lisens.

### Hva flytene faktisk gjor

Gjennomgang av alle 34 Power Automate-flyter viser at de fleste er enkle CRUD-operasjoner:

| Kategori | Antall flyter | Kompleksitet |
|----------|---------------|-------------|
| Ren GET (hent + transformer) | 14 | Lav - kun lesing og JSON-mapping |
| Enkel POST (valider + lagre) | 12 | Lav - enkel preprosessering |
| POST med sideeffekter | 4 | Medium - e-postutsending, kryss-referanser |
| POST med forretningslogikk | 4 | Medium - billettreferanser, RSVP-upsert, innsjekk |

**Konklusjon:** Ingen av flytene har kompleks orkestrering, ventelogikk eller tredjeparts-integrasjoner som rettferdiggjor Power Automate. Alt kan erstattes med enkle HTTP-endepunkter.

---

## 2. Foreslatt ny arkitektur

### Alternativ A: Azure Functions (anbefalt)

```
Nettleser (PWA)
  → Azure Functions (HTTP-triggere, Node.js)
    → Azure Table Storage (15 tabeller)
    → Azure Blob Storage (uendret)
    → SMTP / Azure Communication Services (e-post)
```

### Alternativ B: Express pa Azure App Service / Container Apps

```
Nettleser (PWA)
  → Express/Node.js (enkelt prosess)
    → Azure Table Storage
    → Azure Blob Storage
    → SMTP
```

### Anbefaling: Alternativ A (Azure Functions)

| Faktor | Azure Functions | Express pa App Service |
|--------|----------------|----------------------|
| Kostnad ved lavt volum | ~gratis (Consumption plan) | ~50-100 kr/mnd (B1) |
| Skalering | Automatisk | Manuell / autoscale-regler |
| Kaldstart | 1-3 sek (Consumption) | Ingen (alltid pa) |
| Vedlikehold | Minimalt (serverless) | OS-oppdateringer, restart |
| Deployment | `func azure functionapp publish` | Docker / ZIP deploy |
| Lokal utvikling | `func start` | `node server.js` |

For et kor med ~25 medlemmer og lavt trafikkvolum er Consumption-planen i praksis gratis (<1 million kjoringer/mnd er gratis). Kaldstart pa 1-3 sekunder er akseptabelt.

**Merk:** Express-versjonen i `api-new/` er allerede implementert og fungerer. Den kan deployeres direkte til Azure Functions med minimale endringer (se seksjon 6).

---

## 3. Kostnadssammenligning

### Navaerende (estimert)

| Tjeneste | Kostnad/mnd |
|----------|-------------|
| Power Automate Premium (per bruker eller per flyt) | 100-350 kr |
| SharePoint (via M365) | Inkludert i organisasjonslisens |
| Azure Blob Storage | ~5 kr |
| **Totalt** | **~105-355 kr/mnd** + M365-avhengighet |

### Ny arkitektur (estimert)

| Tjeneste | Kostnad/mnd |
|----------|-------------|
| Azure Functions (Consumption) | ~0 kr (gratisniva) |
| Azure Table Storage | ~1-2 kr |
| Azure Blob Storage | ~5 kr (uendret) |
| SMTP (f.eks. Brevo/Resend free tier) | ~0 kr |
| **Totalt** | **~6-7 kr/mnd** |

**Besparelse: ~95-350 kr/mnd**, pluss fjerning av SharePoint/M365-avhengighet.

---

## 4. Datamodell: Azure Table Storage

### Designprinsipper

Table Storage har begrensninger sammenlignet med SQL, men for denne appens behov er det mer enn tilstrekkelig:

- **PartitionKey + RowKey** er eneste indeks. All filtrering utover dette scanner hele partisjon.
- **Hybrid JSON-monster** fra SharePoint videreforst: sokbare felt som egne kolonner, resten i en `jsonData`-kolonne. Dette fungerer godt fordi alle sporrringer enten henter alt eller filtrerer pa 1-2 felt.
- **Ingen relasjoner**: Entiteter er selvstendige. Kryss-referanser (f.eks. konsert-tittel pa billett) loses ved oppslag.

### Tabellskjema (15 tabeller)

| Tabell | PartitionKey | RowKey | Sokbare kolonner | Kommentar |
|--------|-------------|--------|------------------|-----------|
| **Navigation** | `navigation` | `NAV-xxx` | `order` | Flat liste, sortert |
| **Articles** | `article` | slug (f.eks. `frontpage`) | `page` | Slug som noykel = direkte oppslag |
| **Contacts** | `contact` | `KON-xxx` | `order` | Fa elementer, full scan OK |
| **QuickLinks** | `quicklink` | `QL-xxx` | `order` | Fa elementer, full scan OK |
| **Messages** | `message` | `MSG-xxx` | `publishedAt`, `isPinned` | Kommentarer som nestet array i jsonData |
| **Posts** | `post` | `POST-xxx` | `createdAt` | Kommentarer som nestet array i jsonData |
| **Practice** | `program` / `practice` | `meta` / verk-ID | — | To partisjonnokkler: meta-info + noter |
| **Downloads** | `download` | `DL-xxx` | `category` | |
| **Concerts** | `concert` | `CON-xxx` | `date`, `isPublic` | Filtrering pa dato for kommende |
| **TicketReservations** | `reservation` | `BIL-xxx` | `concertId`, `isPaid`, `referenceNumber` | Flest sokbare felt |
| **Music** | `music` | `MUS-xxx` | `date` | Tracks og images i jsonData |
| **Members** | `member` | `MBR-xxx` | `email`, `role`, `voice` | Oppslag pa e-post for innlogging |
| **Events** | `event` | `EVT-xxx` | `date` | RSVP-liste i jsonData |
| **Files** | `file` | `FIL-xxx` | `kategori`, `verk`, `anledning` | Filmetadata, blob-URL i jsonData |
| **AuthCodes** | `authcode` | unik ID | `email`, `expiresAt` | Kortlevde, slettes etter bruk |

### Datavolum-estimat

| Tabell | Forventet antall rader | Vekst |
|--------|----------------------|-------|
| Members | ~25-30 | Stabil |
| Messages | ~50-100/ar | Lav vekst |
| Posts | ~20-50/ar | Lav vekst |
| Events | ~30-50/ar | Lav vekst |
| Concerts | ~3-5/ar | Minimal |
| TicketReservations | ~50-200/ar | Moderat |
| Navigation, Articles, Contacts, QuickLinks | <20 hver | Tilnarmet statisk |
| Practice, Downloads, Files | ~20-100 | Stabil |
| Music | ~5-10 | Minimal |
| AuthCodes | Flyktige | Slettes automatisk |

**Totalt: ~300-600 rader.** Table Storage hndterer millioner — dette er helt uproblematisk. Full table-scan pa 50 rader tar <10ms.

### Optimaliseringsmuligheter i datamodellen

Gjeldende modell i `api-new/` er allerede god, men noen forbedringer kan vurderes:

**1. AuthCodes: Automatisk opprydding**
Koder som har utlopt blir liggende. En TTL-mekanisme eller en periodisk Functions-timer (f.eks. daglig) som sletter `expiresAt < now` vil holde tabellen ren.

**2. Kommentarer som egen tabell?**
I dag lagres kommentarer som nestet array inne i meldingens/innleggets `jsonData`. For <50 kommentarer per melding er dette greit. Hvis kommentarvolum oker betydelig, kan de flyttes til en egen tabell med `PartitionKey = messageId`. Men for navaerende volum er den nestede modellen enklere og raskere.

**3. Arrangementer: Attendees som egen tabell?**
Samme vurdering som kommentarer. For 25 medlemmer per arrangement er nestet array helt OK. Unodvendig a normalisere.

**4. Billettreservasjoner: Partisjonering pa concertId**
I dag bruker alle reservasjoner `PartitionKey = reservation`. For storre volum kan `PartitionKey = concertId` gi bedre ytelse ved konsert-spesifikke sporringer. Men med <200 rader totalt er dette overoptimalisering.

**Konklusjon:** Navarende datamodell er godt tilpasset appens volum. Ingen strukturelle endringer nodvendig.

---

## 5. Endepunktdesign med Azure Functions

### Struktur

Hver Function har en egen mappe med `function.json` (binding-konfigurasjon) og `index.js` (handler). Alternativt kan v4-programmingsmodellen brukes med en enkelt `src/functions/*.js`-fil per endepunkt.

### Anbefalt: Azure Functions v4 (Node.js)

```
api/
  src/
    functions/
      navigasjon.js          # GET /api/navigasjon
      artikkel.js             # GET /api/forside/artikkel
      kontaktpersoner.js      # GET /api/forside/kontaktpersoner
      hurtiglenker.js         # GET /api/forside/hurtiglenker
      meldinger.js            # GET+POST /api/meldinger, POST /api/meldinger/kommentar
      innlegg.js              # GET+POST /api/innlegg, POST /api/innlegg/kommentar
      ovelse.js               # GET /api/ovelse/program, POST /api/ovelse/sideskift
      nedlasting.js           # GET /api/nedlasting/filer
      konserter.js            # GET+POST /api/konserter, POST /api/konserter/billett
      billetter.js            # GET+POST /api/billetter/*
      billettkontroll.js      # POST /api/billettkontroll/valider
      musikk.js               # GET /api/musikk/konserter
      medlemmer.js            # GET /api/medlemmer/side, POST rsvp+arrangement
      filer.js                # GET+POST /api/filer/*
      blob.js                 # POST /api/blob/*
      styre.js                # GET+POST /api/styre/*
      profil.js               # POST /api/profil/*
      auth.js                 # POST /api/auth/*
    lib/
      table-client.js         # Gjenbruk fra api-new/
      helpers.js              # Gjenbruk fra api-new/
  host.json
  package.json
```

### Konvertering fra Express til Azure Functions

Eksisterende Express-ruter i `api-new/routes/` kan konverteres mekanisk:

**Express (navarende):**
```js
router.get('/meldinger', async (req, res) => {
    const items = await listEntities('Messages');
    res.json({ success: true, data: items });
});
```

**Azure Functions v4:**
```js
const { app } = require('@azure/functions');
const { listEntities } = require('../lib/table-client');

app.http('getMeldinger', {
    methods: ['GET'],
    route: 'meldinger',
    handler: async (request, context) => {
        const items = await listEntities('Messages');
        return { jsonBody: { body: { success: true, data: items } } };
    }
});
```

Endringene er mekaniske: `req.body` → `await request.json()`, `res.json()` → `return { jsonBody }`. Forretningslogikken er identisk.

### Viktig: Response-wrapper

Frontenden (`sharepoint-api.js`) forventer responser wrappet i `{ body: ... }`. Express-versjonen gjor dette via middleware. I Functions ma wrappingen legges i hvert endepunkt eller i en felles hjelpefunksjon:

```js
function respond(data, status = 200) {
    return { status, jsonBody: { body: data } };
}
```

---

## 6. Hva er allerede implementert?

`api-new/`-mappen inneholder en fungerende Express-versjon med:

| Komponent | Status | Filer |
|-----------|--------|-------|
| Table Storage-klient (CRUD) | Komplett | `lib/table-client.js` |
| Hjelpefunksjoner (paginering, ID-generering) | Komplett | `lib/helpers.js` |
| Response-wrapper (`{ body }`) | Komplett | `server.js` middleware |
| Alle 18 route-filer | Komplett | `routes/*.js` |
| Migrerings-script | Komplett | `migrate.js` |
| Eksporterte JSON-testdata | Delvis | `data/*.json` |
| Endpoint-mapping (env.js) | Komplett | `env.js` |
| Fullstendig API-dokumentasjon | Komplett | `migration.md` |

### Hva gjenstaar

| Oppgave | Kommentar |
|---------|-----------|
| Testing av alle ruter mot faktisk Table Storage | Kun lokal utvikling sa langt |
| E-postlevering (SMTP-konfigurasjon) | Nodemailer er satt opp, men SMTP-server ma konfigureres |
| Konvertering til Azure Functions (valgfritt) | Express kan ogsaa deployeres som App Service / Container App |
| Sikkerhet: Server-side autentisering | Kun client-side auth i dag (localStorage) |
| Produksjonsdeploy og DNS | Azure-oppsett |

---

## 7. Migreringsstrategi

### Fase 1: Klargjoring (ingen nedetid)

- Verifiser at alle ruter i `api-new/` fungerer med Table Storage
- Kjor `migrate.js` for a kopiere data fra Power Automate-eksporter til Table Storage
- Test frontenden lokalt med `env-api.js` (peker til localhost:3001)

### Fase 2: Deploy av ny API

**Alternativ A — Azure Functions:**
- Konverter Express-ruter til Functions v4-format
- Deploy med `func azure functionapp publish`
- Konfigurer miljovaribler (connection string, SMTP)

**Alternativ B — Azure App Service:**
- Deploy Express-appen direkte
- Konfigurer miljovaribler
- Sett opp always-on eller health check

### Fase 3: Bytte frontend (kort nedetid)

- Oppdater `js/env.js` med nye API-URLer
- Deploy frontend (oppdater SW-versjon)
- Verifiser alle sider

### Fase 4: Rydde opp

- Deaktiver Power Automate-flyter
- Vurder a beholde SharePoint-data som backup i en overgangsperiode
- Fjern unodvendige M365-lisenser nar SharePoint ikke lenger trengs

---

## 8. Sikkerhetsoverveielser

### Navarende modell (svakheter)

- **Ingen server-side autentisering**: API-endepunktene (bade Power Automate og Express) har ingen auth-sjekk. Alle med URL-en kan kalle dem.
- **SAS-token i URL**: Power Automate-URLene inneholder signerte tokens, men disse er langlevde og gir full tilgang.
- **Client-side rollesjekk**: Rollebasert tilgang hndheges kun i nettleseren — det er trivielt a omga.

### Anbefalte forbedringer

**Minimum (enkel a implementere):**
- Legg til en enkel API-nokkel (`x-api-key`-header) som valideres i Functions/Express middleware
- API-nokkelen bakes inn i `env.js` (ikke hemmelig, men forhindrer tilfeldig tilgang)

**Bedre (moderat innsats):**
- Returner en signert JWT ved vellykket innlogging (`/api/auth/verifiser-kode`)
- Valider JWT i middleware pa alle beskyttede endepunkter
- Legg role-claim i token for server-side rollesjekk

**Merk:** For en intern kor-app med 25 brukere er dette en avveining mellom sikkerhet og kompleksitet. API-nokkel er sannsynligvis tilstrekkelig.

---

## 9. I hvor stor grad kan Claude hjelpe?

### Kan gjore fullt ut

| Oppgave | Kommentar |
|---------|-----------|
| Konvertere Express-ruter til Azure Functions v4 | Mekanisk transformasjon av alle 18 route-filer |
| Skrive `function.json` / `host.json` | Standard Functions-konfigurasjon |
| Implementere response-wrapper for Functions | Enkel hjelpefunksjon |
| Implementere JWT-autentisering | Middleware + login-endepunkt |
| Skrive enhetstester for alle endepunkter | Jest/Vitest med mocket Table Storage |
| Oppdatere `env.js` med Functions-URLer | Direkte redigering |
| Oppdatere `sw.js`-caching | Direkte redigering |
| Lage deploy-script / GitHub Actions | Standard CI/CD-oppsett |
| Skrive migreringsverifiserings-script | Sammenligne gammel og ny API-respons |
| Dokumentere ny arkitektur | Allerede delvis gjort |

### Kan hjelpe med (krever din input)

| Oppgave | Hva trengs fra deg |
|---------|-------------------|
| Azure Functions-oppsett | Tilgang til Azure-portalen, subscription-valg |
| SMTP-konfigurasjon | Valg av e-posttjeneste, credentials |
| DNS/domene-oppsett | Domeneregistrar-tilgang |
| Data-migrering (kjoring) | Tilgang til navarende Power Automate-data |
| Produksjonstesting | Verifisering i nettleser, funksjonell test |

### Utenfor rekkevidde

| Oppgave | Grunn |
|---------|-------|
| Azure-portaloperasjoner | Krever nettlesertilgang til portalen |
| Power Automate-deaktivering | Krever Power Platform-tilgang |
| M365-lisenshndtering | Krever admin-tilgang |
| Domene-DNS-endringer | Krever registrar-tilgang |

---

## 10. Oppsummering

| Aspekt | Navarende | Ny |
|--------|-----------|-----|
| **Backend** | Power Automate (34 flyter) | Azure Functions (18 filer) |
| **Lagring** | SharePoint-lister | Azure Table Storage |
| **Binærfiler** | Azure Blob Storage | Azure Blob Storage (uendret) |
| **E-post** | Power Automate-connector | SMTP / Azure Communication Services |
| **Frontend** | Uendret | Uendret (kun `env.js` oppdateres) |
| **Kostnad** | ~105-355 kr/mnd | ~6-7 kr/mnd |
| **Avhengigheter** | M365 + Power Platform | Kun Azure Storage |
| **Implementeringsstatus** | — | Express-versjon ~90% komplett i `api-new/` |
| **Gjenstaaende arbeid** | — | Test, deploy, evt. Functions-konvertering |

Den storste verdien i migreringen er **fjerning av Power Automate/SharePoint-avhengigheten** og den tilhorende lisenskostnaden. Selve den tekniske overgangen er lav-risiko fordi:

1. Frontend endres ikke (kun URL-bytte i `env.js`)
2. Express-implementasjonen er allerede skrevet og dokumentert
3. Datamodellen er allerede designet og migrerings-script finnes
4. Konvertering til Azure Functions er mekanisk og kan automatiseres
