# SharePoint Liste-skjemaer

Detaljert dokumentasjon av alle SharePoint-lister som brukes av Korportal.

## Innholdsfortegnelse

1. [Navigasjon](#navigasjon)
2. [Meldinger](#meldinger)
3. [Innlegg](#innlegg)
4. [Hurtiglenker](#hurtiglenker)
5. [Innhold](#innhold)
6. [Medlemmer](#medlemmer)
7. [Kontaktpersoner](#kontaktpersoner)
8. [Noter (Notebibliotek)](#noter-notebibliotek)
9. [Konserter](#konserter)
10. [Billettreservasjoner](#billettreservasjoner)
11. [Øvelse](#øvelse)
12. [Nedlasting](#nedlasting)
13. [Musikk](#musikk)
14. [Power Automate Flows](#power-automate-flows)

---

## Lagringsstrategi: Hybrid kolonner + JSON

Listene bruker en **hybridstruktur** der:

- **Nøkkelfelt** (som brukes til filtrering, sortering og visning i SharePoint-grensesnittet) lagres som **egne kolonner**
- **Komplekse/nestede data** (innhold, kommentarer, formattering, etc.) lagres som **JSON i en "Data"-kolonne** (Flerlinjers tekst)

### Fordeler

1. **Filtrerbar/sorterbar** i SharePoint UI og OData-spørringer via nøkkelkolonner
2. **Fleksibel** - komplekse strukturer (arrays, nestede objekter) håndteres enkelt i JSON
3. **Enkel å utvide** - nye felt kan legges til i JSON uten å endre SharePoint-skjemaet
4. **Abstraksjon** - Power Automate transformerer mellom intern lagring og API-format, slik at frontend er frikoblet fra lagringsstrukturen

### Hvilke lister bruker hybrid?

| Liste | Hybridstruktur | Grunn |
|-------|----------------|-------|
| Navigasjon | Nei | Kun enkle felt |
| Meldinger | **Ja** | Innhold, format, kommentarer i JSON |
| Innlegg | **Ja** | Innhold, forfatterdetaljer, kommentarer i JSON |
| Hurtiglenker | Nei | Kun enkle felt |
| Innhold | **Ja** | Innhold, format, bildeplassering i JSON |
| Medlemmer | Nei | Kun enkle felt |
| Kontaktpersoner | Nei | Kun enkle felt |
| Noter | Nei | Alle felt er filtrerbare kolonner |
| Konserter | **Ja** | Beskrivelse, program i JSON |
| Billettreservasjoner | Nei | Kun enkle felt |

### Eksempel: Meldinger

**SharePoint-kolonner** (nøkkelfelt):
| Kolonne | Bruk |
|---------|------|
| Title | Filtrering, visning i SP |
| PublishDate | Sortering, filtrering på dato |
| IsImportant | Filtrering |
| IsPinned | Filtrering/sortering |

**Data-kolonne** (JSON i Flerlinjers tekst):
```json
{
  "content": "Kjære kormedlemmer,\n\nVi ønsker alle velkommen...",
  "format": "markdown",
  "imageUrl": "",
  "comments": [
    {
      "authorId": "2",
      "authorName": "Ola Hansen",
      "text": "Flott, gleder meg!",
      "date": "2025-01-21T14:30:00Z"
    }
  ]
}
```

**Power Automate** transformerer dette til API-formatet som frontend forventer (definert i README), og omvendt ved skriving.

---

## Navigasjon

**Listenavn**: `Navigasjon`
**Formål**: Lagrer menystruktur for hovednavigasjonen med rollebasert tilgangskontroll

### Kolonner

| Intern navn | Visningsnavn | Type | Påkrevd | Beskrivelse |
|-------------|--------------|------|---------|-------------|
| Title | Tittel | Enkeltlinje tekst | Ja | Menyelementets navn |
| URL | URL | Enkeltlinje tekst | Ja | Lenke (relativ eller absolutt) |
| Icon | Ikon | Enkeltlinje tekst | Nei | Emoji eller CSS-klasse for ikon |
| Order | Rekkefølge | Tall | Nei | Sorteringsverdi (lavest først) |
| ParentId | Forelder | Lookup (til samme liste) | Nei | Referanse til forelder for undermeny |
| OpenInNewTab | Åpne i ny fane | Ja/Nei | Nei | Om lenken skal åpnes i ny fane |
| IsActive | Aktiv | Ja/Nei | Nei | Om elementet skal vises (standard: Ja) |
| MinRole | Minimumsrolle | Valg | Nei | Laveste rolle som har tilgang (standard: anonym) |
| HideWhenLoggedIn | Skjul for innloggede | Ja/Nei | Nei | Skjul når bruker er innlogget (f.eks. "Logg inn") |
| IsLogout | Er utlogging | Ja/Nei | Nei | Marker som utloggingsknapp |

### MinRole-valg (rollehierarki)

Rollene følger et hierarki der høyere roller inkluderer lavere:

```
admin   → har tilgang til: admin, styre, medlem, anonym
styre   → har tilgang til: styre, medlem, anonym
medlem  → har tilgang til: medlem, anonym
anonym  → har tilgang til: anonym
```

Eksempel: Et menyelement med `MinRole: "medlem"` vises for medlem, styre og admin, men ikke for anonyme besøkende.

### Eksempeldata

```json
[
  {
    "Title": "Hjem",
    "URL": "/",
    "Icon": "🏠",
    "Order": 1,
    "ParentId": null,
    "OpenInNewTab": false,
    "MinRole": "anonym",
    "HideWhenLoggedIn": false,
    "IsLogout": false
  },
  {
    "Title": "Konserter",
    "URL": "/konserter.html",
    "Icon": "🎭",
    "Order": 2,
    "ParentId": null,
    "OpenInNewTab": false,
    "MinRole": "anonym",
    "HideWhenLoggedIn": false,
    "IsLogout": false
  },
  {
    "Title": "Musikk fra oss",
    "URL": "/musikk.html",
    "Icon": "🎧",
    "Order": 3,
    "ParentId": null,
    "OpenInNewTab": false,
    "MinRole": "anonym",
    "HideWhenLoggedIn": false,
    "IsLogout": false
  },
  {
    "Title": "Meldinger",
    "URL": "/meldinger.html",
    "Icon": "📢",
    "Order": 4,
    "ParentId": null,
    "OpenInNewTab": false,
    "MinRole": "medlem",
    "HideWhenLoggedIn": false,
    "IsLogout": false
  },
  {
    "Title": "Innlegg",
    "URL": "/innlegg.html",
    "Icon": "💬",
    "Order": 5,
    "ParentId": null,
    "OpenInNewTab": false,
    "MinRole": "medlem",
    "HideWhenLoggedIn": false,
    "IsLogout": false
  },
  {
    "Title": "Øvelse",
    "URL": "/ovelse.html",
    "Icon": "🎼",
    "Order": 6,
    "ParentId": null,
    "OpenInNewTab": false,
    "MinRole": "medlem",
    "HideWhenLoggedIn": false,
    "IsLogout": false
  },
  {
    "Title": "Nedlasting",
    "URL": "/nedlasting.html",
    "Icon": "📥",
    "Order": 7,
    "ParentId": null,
    "OpenInNewTab": false,
    "MinRole": "medlem",
    "HideWhenLoggedIn": false,
    "IsLogout": false
  },
  {
    "Title": "Notebibliotek",
    "URL": "/noter.html",
    "Icon": "🎵",
    "Order": 8,
    "ParentId": null,
    "OpenInNewTab": false,
    "MinRole": "medlem",
    "HideWhenLoggedIn": false,
    "IsLogout": false
  },
  {
    "Title": "Styresider",
    "URL": "/styre.html",
    "Icon": "📋",
    "Order": 9,
    "ParentId": null,
    "OpenInNewTab": false,
    "MinRole": "styre",
    "HideWhenLoggedIn": false,
    "IsLogout": false
  },
  {
    "Title": "Administrasjon",
    "URL": "/admin.html",
    "Icon": "⚙️",
    "Order": 10,
    "ParentId": null,
    "OpenInNewTab": false,
    "MinRole": "admin",
    "HideWhenLoggedIn": false,
    "IsLogout": false
  },
  {
    "Title": "Logg inn",
    "URL": "/login.html",
    "Icon": "🔑",
    "Order": 11,
    "ParentId": null,
    "OpenInNewTab": false,
    "MinRole": "anonym",
    "HideWhenLoggedIn": true,
    "IsLogout": false
  },
  {
    "Title": "Logg ut",
    "URL": "#logout",
    "Icon": "🚪",
    "Order": 12,
    "ParentId": null,
    "OpenInNewTab": false,
    "MinRole": "medlem",
    "HideWhenLoggedIn": false,
    "IsLogout": true
  }
]
```

### SharePoint JSON for kolonneformatering

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
  "elmType": "a",
  "attributes": {
    "href": "[$URL]",
    "target": "=if([$OpenInNewTab], '_blank', '_self')"
  },
  "txtContent": "[$Title]"
}
```

---

## Meldinger

**Listenavn**: `Meldinger`
**Formål**: Meldinger fra styret til kormedlemmene
**Lagring**: Hybrid (nøkkelfelt som kolonner + innhold/kommentarer i JSON)

### Kolonner (nøkkelfelt)

| Intern navn | Visningsnavn | Type | Påkrevd | Beskrivelse |
|-------------|--------------|------|---------|-------------|
| Title | Tittel | Enkeltlinje tekst | Ja | Overskrift |
| PublishDate | Publiseringsdato | Dato og tid | Ja | Når meldingen skal vises |
| IsImportant | Er viktig | Ja/Nei | Nei | Marker som viktig melding |
| IsPinned | Festet | Ja/Nei | Nei | Fest øverst i listen |
| Data | Data | Flerlinjers tekst | Ja | JSON med innhold, format, bilde og kommentarer |

### Data-kolonne (JSON-struktur)

```json
{
  "content": "string – Hovedinnhold (tekst/markdown/html)",
  "format": "string – Innholdsformat: 'text', 'markdown' eller 'html'",
  "imageUrl": "string – URL til bilde (valgfri)",
  "comments": [
    {
      "authorId": "string – Medlemmets ID",
      "authorName": "string – Forfatterens navn",
      "text": "string – Kommentartekst",
      "date": "string – ISO 8601 dato"
    }
  ]
}
```

### Eksempeldata (slik det lagres i SharePoint)

```json
[
  {
    "Title": "Velkommen til nytt semester!",
    "PublishDate": "2025-01-20T10:00:00Z",
    "IsImportant": false,
    "IsPinned": true,
    "Data": "{\"content\":\"Kjære kormedlemmer,\\n\\nVi ønsker alle velkommen til et nytt og spennende semester!\\n\\n## Viktige datoer\\n\\n- **27. januar**: Første øvelse\\n- **15. mars**: Vårkonsert\",\"format\":\"markdown\",\"imageUrl\":\"\",\"comments\":[{\"authorId\":\"2\",\"authorName\":\"Ola Hansen\",\"text\":\"Gleder meg til semesteret!\",\"date\":\"2025-01-21T14:30:00Z\"}]}"
  },
  {
    "Title": "Påminnelse: Kontingent forfaller snart",
    "PublishDate": "2025-01-18T08:00:00Z",
    "IsImportant": true,
    "IsPinned": false,
    "Data": "{\"content\":\"Husk at kontingenten for vårsemesteret forfaller 1. februar.\\n\\nBeløp: 500 kr\\nKontonummer: 1234.56.78901\",\"format\":\"text\",\"imageUrl\":\"\",\"comments\":[]}"
  }
]
```

---

## Innlegg

**Listenavn**: `Innlegg`
**Formål**: Innlegg fra kormedlemmer til hverandre
**Lagring**: Hybrid (nøkkelfelt som kolonner + innhold/kommentarer i JSON)

### Kolonner (nøkkelfelt)

| Intern navn | Visningsnavn | Type | Påkrevd | Beskrivelse |
|-------------|--------------|------|---------|-------------|
| Title | Tittel | Enkeltlinje tekst | Ja | Overskrift |
| AuthorName | Forfatter | Enkeltlinje tekst | Ja | Forfatterens navn |
| PublishDate | Publiseringsdato | Dato og tid | Ja | Når innlegget ble publisert |
| Data | Data | Flerlinjers tekst | Ja | JSON med innhold, forfatterdetaljer og kommentarer |

### Data-kolonne (JSON-struktur)

```json
{
  "content": "string – Innholdet i innlegget",
  "authorId": "number – Forfatterens medlems-ID",
  "authorEmail": "string – Forfatterens e-post",
  "authorVoice": "string – Forfatterens stemmegruppe",
  "comments": [
    {
      "authorId": "string – Medlemmets ID",
      "authorName": "string – Forfatterens navn",
      "text": "string – Kommentartekst",
      "date": "string – ISO 8601 dato"
    }
  ]
}
```

### Eksempeldata (slik det lagres i SharePoint)

```json
[
  {
    "Title": "Takk for flott julebord!",
    "AuthorName": "Kari Nordmann",
    "PublishDate": "2025-01-22T18:30:00Z",
    "Data": "{\"content\":\"Vil bare si tusen takk til alle som bidro til et fantastisk julebord! Spesielt takk til festkomiteen.\",\"authorId\":1,\"authorEmail\":\"kari@example.com\",\"authorVoice\":\"Sopran 1\",\"comments\":[{\"authorId\":\"2\",\"authorName\":\"Ola Hansen\",\"text\":\"Enig! Fantastisk kveld!\",\"date\":\"2025-01-22T20:00:00Z\"}]}"
  },
  {
    "Title": "Samkjøring til konsert?",
    "AuthorName": "Ola Hansen",
    "PublishDate": "2025-01-20T10:15:00Z",
    "Data": "{\"content\":\"Er det noen som kjører fra Drammen-området til konserten i Oslo 15. mars? Jeg har plass til 3 personer.\",\"authorId\":2,\"authorEmail\":\"ola@example.com\",\"authorVoice\":\"Tenor 1\",\"comments\":[]}"
  }
]
```

---

## Hurtiglenker

**Listenavn**: `Hurtiglenker`
**Formål**: Snarveier til viktige ressurser for kormedlemmer

### Kolonner

| Intern navn | Visningsnavn | Type | Påkrevd | Beskrivelse |
|-------------|--------------|------|---------|-------------|
| Title | Tittel | Enkeltlinje tekst | Ja | Lenketekst |
| URL | URL | Hyperkobling | Ja | Destinasjons-URL |
| Icon | Ikon | Enkeltlinje tekst | Nei | Emoji for visuell identifikasjon |
| Description | Beskrivelse | Enkeltlinje tekst | Nei | Tooltip/hover-tekst |
| Order | Rekkefølge | Tall | Nei | Sorteringsverdi |
| OpenInNewTab | Åpne i ny fane | Ja/Nei | Nei | Standard: Ja |

### Eksempeldata

```json
[
  {
    "Title": "Konserter",
    "URL": "/konserter.html",
    "Icon": "🎭",
    "Description": "Se kommende konserter",
    "Order": 1,
    "OpenInNewTab": false
  },
  {
    "Title": "Øvelse",
    "URL": "/ovelse.html",
    "Icon": "🎵",
    "Description": "Noter og øvefiler",
    "Order": 2,
    "OpenInNewTab": false
  },
  {
    "Title": "Last ned noter",
    "URL": "/nedlasting.html",
    "Icon": "📥",
    "Description": "Last ned noter til semesteret",
    "Order": 3,
    "OpenInNewTab": false
  },
  {
    "Title": "Facebook-gruppe",
    "URL": "https://facebook.com/groups/koret",
    "Icon": "👥",
    "Description": "Vår Facebook-gruppe",
    "Order": 4,
    "OpenInNewTab": true
  }
]
```

---

## Innhold

**Listenavn**: `Innhold`
**Formål**: Dynamisk innhold for ulike sider (f.eks. forsideartikkel)
**Lagring**: Hybrid (nøkkelfelt som kolonner + innhold/formattering i JSON)

### Kolonner (nøkkelfelt)

| Intern navn | Visningsnavn | Type | Påkrevd | Beskrivelse |
|-------------|--------------|------|---------|-------------|
| Title | Tittel | Enkeltlinje tekst | Ja | Overskrift |
| Slug | Slug | Enkeltlinje tekst | Ja | Unik identifikator (f.eks. 'frontpage') |
| Page | Side | Valg | Nei | Hvilken side innholdet tilhører |
| Data | Data | Flerlinjers tekst | Ja | JSON med innhold, format og bildeinfo |

### Slug-verdier

- frontpage (Forsideartikkel)
- about (Om koret)
- history (Korets historie)

### Data-kolonne (JSON-struktur)

```json
{
  "content": "string – Hovedinnhold (tekst/markdown/html)",
  "format": "string – Innholdsformat: 'text', 'markdown' eller 'html'",
  "imageUrl": "string – URL til bilde (valgfri)",
  "imagePlacement": "string – 'over', 'under' eller 'angitt' ($picture i teksten)"
}
```

### Eksempeldata (slik det lagres i SharePoint)

```json
[
  {
    "Title": "Velkommen til Kammerkoret Utsikten",
    "Slug": "frontpage",
    "Page": "home",
    "Data": "{\"content\":\"Kammerkoret Utsikten er et blandet kor med rundt 40 sangere. Vi holder til i Oslo og øver hver mandag kveld.\\n\\n$picture\\n\\nKoret ble stiftet i 1995 og har siden den gang holdt en rekke konserter både i inn- og utland.\",\"format\":\"text\",\"imageUrl\":\"https://storage.blob.core.windows.net/images/kor-bilde.jpg\",\"imagePlacement\":\"angitt\"}"
  }
]
```

---

## Medlemmer

**Listenavn**: `Medlemmer`
**Formål**: Register over kormedlemmer med stemmegruppe og kontaktinfo

### Kolonner

| Intern navn | Visningsnavn | Type | Påkrevd | Beskrivelse |
|-------------|--------------|------|---------|-------------|
| Title | Navn | Enkeltlinje tekst | Ja | Fullt navn |
| Email | E-post | Enkeltlinje tekst | Ja | E-postadresse (brukes til innlogging) |
| Phone | Telefon | Enkeltlinje tekst | Nei | Telefonnummer |
| Voice | Stemme | Valg | Ja | Stemmegruppe |
| Role | Rolle | Valg | Nei | Brukerrolle i portalen |
| Picture | Bilde | Bilde | Nei | Profilbilde |
| JoinedAt | Medlem fra | Dato | Nei | Når personen ble medlem |

### Stemme-valg

- Sopran 1
- Sopran 2
- Alt 1
- Alt 2
- Tenor 1
- Tenor 2
- Bass 1
- Bass 2

### Rolle-valg

- medlem (Standard medlem)
- styre (Styremedlem - kan publisere meldinger)
- admin (Administrator - full tilgang)

### Eksempeldata

```json
[
  {
    "Title": "Kari Nordmann",
    "Email": "kari@example.com",
    "Phone": "+47 900 11 222",
    "Voice": "Sopran 1",
    "Role": "medlem",
    "JoinedAt": "2020-01-15"
  },
  {
    "Title": "Ola Hansen",
    "Email": "ola@example.com",
    "Phone": "+47 900 33 444",
    "Voice": "Tenor 1",
    "Role": "styre",
    "JoinedAt": "2018-08-20"
  },
  {
    "Title": "Anne Olsen",
    "Email": "anne@example.com",
    "Phone": "+47 900 55 666",
    "Voice": "Alt 2",
    "Role": "admin",
    "JoinedAt": "2015-03-10"
  }
]
```

---

## Kontaktpersoner

**Listenavn**: `Kontaktpersoner`
**Formål**: Kontaktinformasjon for dirigent, korleder og andre nøkkelpersoner

### Kolonner

| Intern navn | Visningsnavn | Type | Påkrevd | Beskrivelse |
|-------------|--------------|------|---------|-------------|
| Title | Navn | Enkeltlinje tekst | Ja | Fullt navn |
| Email | E-post | Enkeltlinje tekst | Ja | E-postadresse |
| Phone | Telefon | Enkeltlinje tekst | Nei | Telefonnummer |
| Kontaktrolle | Kontaktrolle | Enkeltlinje tekst | Ja | Rolle (Dirigent, Korleder, etc.) |
| Picture | Bilde | Bilde | Nei | Profilbilde |
| Order | Rekkefølge | Tall | Nei | Sorteringsverdi |

### Eksempeldata

```json
[
  {
    "Title": "Per Dirigansen",
    "Email": "dirigent@koret.no",
    "Phone": "+47 900 00 001",
    "Kontaktrolle": "Dirigent",
    "Order": 1
  },
  {
    "Title": "Kari Korleder",
    "Email": "leder@koret.no",
    "Phone": "+47 900 00 002",
    "Kontaktrolle": "Korleder",
    "Order": 2
  },
  {
    "Title": "Ola Kassansen",
    "Email": "kasserer@koret.no",
    "Phone": "+47 900 00 003",
    "Kontaktrolle": "Kasserer",
    "Order": 3
  }
]
```

---

## Noter (Notebibliotek)

**Listenavn**: `Noter`
**Formål**: Notearkiv for koret med PDF-filer og lydopptak per stemmegruppe

### Kolonner

| Intern navn | Visningsnavn | Type | Påkrevd | Beskrivelse |
|-------------|--------------|------|---------|-------------|
| Title | Tittel | Enkeltlinje tekst | Ja | Navn på musikkverket |
| Composer | Komponist | Enkeltlinje tekst | Nei | Komponistens navn |
| VoiceGroup | Stemmegruppe | Valg | Ja | Hvilken stemme noten gjelder for |
| Category | Kategori | Valg | Nei | Type musikk/anledning |
| PDFFileURL | PDF-fil | Hyperkobling | Nei | URL til PDF-notene |
| AudioFileURL | Lydfil | Hyperkobling | Nei | URL til lydopptak/øvingsfil |
| UploadDate | Opplastingsdato | Dato | Nei | Når noten ble lagt til (standard: Created) |
| Description | Beskrivelse | Flerlinjers tekst | Nei | Tilleggsinformasjon om verket |
| Difficulty | Vanskelighetsgrad | Valg | Nei | Vanskelighetsnivå |
| Duration | Varighet | Enkeltlinje tekst | Nei | Antatt spilletid |
| Arrangement | Arrangement | Enkeltlinje tekst | Nei | Hvem som har arrangert verket |
| Lyrics | Tekst | Flerlinjers tekst | Nei | Sangtekst |

### Stemmegruppe-valg

Disse verdiene støtter både spesifikke og generelle stemmer:

**Spesifikke stemmer (1. og 2. stemme):**
- Sopran-1
- Sopran-2
- Alt-1
- Alt-2
- Tenor-1
- Tenor-2
- Bass-1
- Bass-2

**Generelle stemmer (felles for begge):**
- Sopran
- Alt
- Tenor
- Bass

**Alle sammen:**
- Tutti

> **Viktig filtrering**: Når en bruker filtrerer på f.eks. "Bass-1", skal systemet også vise noter merket med "Bass" (generell stemme). Dette håndteres i JavaScript-koden med `voiceGroupMapping`.

### Kategori-valg

- Klassisk
- Folkemusikk
- Pop/Rock
- Julesanger
- Påskesanger
- Nasjonalsanger
- Spirituals
- Jazz
- Barnesanger
- Kirkemusikk
- Konsertrepertoar
- Øvelser

### Vanskelighetsgrad-valg

- Lett
- Middels
- Vanskelig

### Eksempeldata

```json
[
  {
    "Title": "Ja, vi elsker dette landet",
    "Composer": "Rikard Nordraak",
    "VoiceGroup": "Tutti",
    "Category": "Nasjonalsanger",
    "PDFFileURL": "https://tenant.sharepoint.com/sites/kor/Delte%20dokumenter/Noter/ja-vi-elsker-tutti.pdf",
    "AudioFileURL": "https://tenant.sharepoint.com/sites/kor/Delte%20dokumenter/Lydopptak/ja-vi-elsker-tutti.mp3",
    "UploadDate": "2025-01-15T10:00:00Z",
    "Difficulty": "Lett"
  },
  {
    "Title": "Tore Tang",
    "Composer": "Egil Monn-Iversen",
    "VoiceGroup": "Bass-1",
    "Category": "Folkemusikk",
    "PDFFileURL": "https://tenant.sharepoint.com/sites/kor/Delte%20dokumenter/Noter/tore-tang-bass1.pdf",
    "AudioFileURL": "https://tenant.sharepoint.com/sites/kor/Delte%20dokumenter/Lydopptak/tore-tang-bass1.mp3",
    "UploadDate": "2025-01-10T14:30:00Z",
    "Difficulty": "Middels",
    "Description": "Bass 1 stemme med egen inngang i takt 23"
  },
  {
    "Title": "Tore Tang",
    "Composer": "Egil Monn-Iversen",
    "VoiceGroup": "Bass",
    "Category": "Folkemusikk",
    "PDFFileURL": "https://tenant.sharepoint.com/sites/kor/Delte%20dokumenter/Noter/tore-tang-bass-felles.pdf",
    "AudioFileURL": "https://tenant.sharepoint.com/sites/kor/Delte%20dokumenter/Lydopptak/tore-tang-bass.mp3",
    "UploadDate": "2025-01-10T14:30:00Z",
    "Difficulty": "Middels",
    "Description": "Felles bass-stemme for hele bass-seksjonen"
  },
  {
    "Title": "Ave Maria",
    "Composer": "Franz Schubert",
    "VoiceGroup": "Sopran-1",
    "Category": "Klassisk",
    "PDFFileURL": "https://tenant.sharepoint.com/sites/kor/Delte%20dokumenter/Noter/ave-maria-sopran1.pdf",
    "AudioFileURL": null,
    "UploadDate": "2025-01-08T09:00:00Z",
    "Difficulty": "Vanskelig"
  }
]
```

### Mappestruktur for filer

Anbefalt struktur i SharePoint dokumentbibliotek:

```
Kor-dokumenter/
├── Noter/
│   ├── Klassisk/
│   ├── Folkemusikk/
│   ├── Julesanger/
│   └── ...
└── Lydopptak/
    ├── Sopran/
    ├── Alt/
    ├── Tenor/
    ├── Bass/
    └── Tutti/
```

### JSON kolonneformatering for Stemmegruppe

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
  "elmType": "span",
  "style": {
    "padding": "4px 8px",
    "border-radius": "12px",
    "font-size": "12px",
    "font-weight": "600",
    "background-color": "=if(indexOf(@currentField, 'Sopran') >= 0, '#fce7f3', if(indexOf(@currentField, 'Alt') >= 0, '#ede9fe', if(indexOf(@currentField, 'Tenor') >= 0, '#d1fae5', if(indexOf(@currentField, 'Bass') >= 0, '#dbeafe', '#fef3c7'))))",
    "color": "=if(indexOf(@currentField, 'Sopran') >= 0, '#9d174d', if(indexOf(@currentField, 'Alt') >= 0, '#5b21b6', if(indexOf(@currentField, 'Tenor') >= 0, '#065f46', if(indexOf(@currentField, 'Bass') >= 0, '#1e40af', '#92400e'))))"
  },
  "txtContent": "@currentField"
}
```

---

## Konserter

**Listenavn**: `Konserter`
**Formål**: Oversikt over kommende konserter med billettinformasjon
**Lagring**: Hybrid (nøkkelfelt som kolonner + beskrivelse/program i JSON)

### Kolonner (nøkkelfelt)

| Intern navn | Visningsnavn | Type | Påkrevd | Beskrivelse |
|-------------|--------------|------|---------|-------------|
| Title | Tittel | Enkeltlinje tekst | Ja | Konsertens navn |
| Date | Dato | Dato og tid | Ja | Dato og klokkeslett for konserten |
| Location | Sted | Enkeltlinje tekst | Ja | Hvor konserten holdes |
| Price | Pris | Tall | Nei | Billettpris i NOK (0 = gratis) |
| IsFree | Er gratis | Ja/Nei | Nei | Om konserten er gratis |
| TotalTickets | Totalt billetter | Tall | Nei | Maks antall billetter (0 = ubegrenset) |
| SoldTickets | Solgte billetter | Tall | Nei | Antall solgte/reserverte billetter |
| Category | Kategori | Valg | Nei | Type konsert |
| IsPublished | Publisert | Ja/Nei | Nei | Om konserten skal vises (standard: Ja) |
| Data | Data | Flerlinjers tekst | Ja | JSON med adresse, beskrivelse, program, bilde, billettlenke |

### Kategori-valg

- Vårkonsert
- Sommerkonsert
- Høstkonsert
- Julekonsert
- Jubileumskonsert
- Kirkekonsert
- Utendørskonsert
- Privat arrangement

### Data-kolonne (JSON-struktur)

```json
{
  "address": "string – Full adresse til lokalet",
  "description": "string – Beskrivelse av konserten",
  "program": "string – Liste over musikkstykker (linjeskift-separert)",
  "imageUrl": "string – URL til bilde for konserten",
  "ticketUrl": "string – Ekstern billettlenke (valgfri)"
}
```

### Eksempeldata (slik det lagres i SharePoint)

```json
[
  {
    "Title": "Vårkonsert 2025",
    "Date": "2025-04-12T19:00:00Z",
    "Location": "Kulturhuset, Store sal",
    "Price": 250,
    "IsFree": false,
    "TotalTickets": 150,
    "SoldTickets": 87,
    "Category": "Vårkonsert",
    "IsPublished": true,
    "Data": "{\"address\":\"Storgata 1, 0101 Oslo\",\"description\":\"Vår tradisjonelle vårkonsert med et variert program fra klassisk til moderne kormusikk.\",\"program\":\"Ja, vi elsker\\nTore Tang\\nMed en bølge av lengsel\\nVåren (Grieg)\\nHallelujah (Cohen)\",\"imageUrl\":\"https://tenant.sharepoint.com/sites/kor/SiteAssets/varkonsert-2025.jpg\",\"ticketUrl\":\"\"}"
  },
  {
    "Title": "Sommerserenade",
    "Date": "2025-06-21T18:00:00Z",
    "Location": "Slottsparken",
    "Price": 0,
    "IsFree": true,
    "TotalTickets": 0,
    "SoldTickets": 0,
    "Category": "Utendørskonsert",
    "IsPublished": true,
    "Data": "{\"address\":\"Slottsplassen, Oslo\",\"description\":\"Gratis utendørskonsert i sommerkvelden. Ta med pledd og piknik!\",\"program\":\"Bruremarsj fra Valdres\\nSommernatt\\nMåneskinnssonate\\nNordlyset\",\"imageUrl\":\"\",\"ticketUrl\":\"\"}"
  },
  {
    "Title": "Julekonsert 2025",
    "Date": "2025-12-13T17:00:00Z",
    "Location": "Domkirken",
    "Price": 350,
    "IsFree": false,
    "TotalTickets": 200,
    "SoldTickets": 200,
    "Category": "Julekonsert",
    "IsPublished": true,
    "Data": "{\"address\":\"Kirkeveien 1, Oslo\",\"description\":\"Stemningsfulle juletoner i vakre omgivelser. Konserten fremføres to ganger.\",\"program\":\"Deilig er jorden\\nGlade jul\\nO Helga Natt\\nThe First Nowell\\nStille natt\",\"imageUrl\":\"\",\"ticketUrl\":\"\"}"
  }
]
```

### JSON kolonneformatering for billettstatus

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
  "elmType": "div",
  "children": [
    {
      "elmType": "span",
      "style": {
        "padding": "4px 8px",
        "border-radius": "12px",
        "font-size": "12px",
        "font-weight": "600",
        "background-color": "=if([$TotalTickets] == 0, '#d1fae5', if([$TotalTickets] - [$SoldTickets] <= 0, '#fecaca', if([$TotalTickets] - [$SoldTickets] <= 10, '#fef3c7', '#d1fae5')))",
        "color": "=if([$TotalTickets] == 0, '#065f46', if([$TotalTickets] - [$SoldTickets] <= 0, '#991b1b', if([$TotalTickets] - [$SoldTickets] <= 10, '#92400e', '#065f46')))"
      },
      "txtContent": "=if([$TotalTickets] == 0, 'Ubegrenset', if([$TotalTickets] - [$SoldTickets] <= 0, 'Utsolgt', toString([$TotalTickets] - [$SoldTickets]) + ' ledige'))"
    }
  ]
}
```

---

## Billettreservasjoner

**Listenavn**: `Billettreservasjoner`
**Formål**: Lagrer billettbestillinger fra nettsiden

### Kolonner

| Intern navn | Visningsnavn | Type | Påkrevd | Beskrivelse |
|-------------|--------------|------|---------|-------------|
| Title | Referanse | Enkeltlinje tekst | Ja | Auto-generert referansenummer |
| ConcertId | Konsert | Lookup (til Konserter) | Ja | Hvilken konsert reservasjonen gjelder |
| Name | Navn | Enkeltlinje tekst | Ja | Bestillers navn |
| Email | E-post | Enkeltlinje tekst | Ja | Bestillers e-post |
| Phone | Telefon | Enkeltlinje tekst | Nei | Bestillers telefon |
| TicketCount | Antall billetter | Tall | Ja | Antall billetter reservert |
| TotalPrice | Totalpris | Valuta | Ja | Total sum for bestillingen |
| Message | Melding | Flerlinjers tekst | Nei | Spesielle ønsker/behov |
| ReservationDate | Bestillingsdato | Dato og tid | Ja | Når bestillingen ble gjort |
| Status | Status | Valg | Ja | Bestillingens status |
| PaymentStatus | Betalingsstatus | Valg | Nei | Om betaling er mottatt |
| ConfirmationSent | Bekreftelse sendt | Ja/Nei | Nei | Om e-postbekreftelse er sendt |

### Status-valg

- Ny
- Bekreftet
- Kansellert
- Fullført

### Betalingsstatus-valg

- Venter
- Betalt
- Refundert

### Eksempeldata

```json
[
  {
    "Title": "RES-2025-0001",
    "ConcertId": 1,
    "Name": "Ola Nordmann",
    "Email": "ola@example.com",
    "Phone": "+47 900 11 222",
    "TicketCount": 2,
    "TotalPrice": 500,
    "Message": "Trenger rullestolplass",
    "ReservationDate": "2025-01-20T14:30:00Z",
    "Status": "Bekreftet",
    "PaymentStatus": "Betalt",
    "ConfirmationSent": true
  }
]
```

### Power Automate trigger for å oppdatere SoldTickets

Når en ny reservasjon opprettes, bør et flow oppdatere `SoldTickets` i Konserter-listen:

```
Trigger: When an item is created (Billettreservasjoner)
Actions:
1. Get item fra Konserter med ConcertId
2. Update item i Konserter:
   SoldTickets = original SoldTickets + TicketCount
3. Send confirmation email til bestiller
```

---

## Power Automate Flows

### Flow 1: Hent Navigasjon

**Trigger**: When a HTTP request is received (GET)

**Steg**:
1. **Get items** fra SharePoint-listen "Navigasjon"
   - Filter: `IsActive eq true` (eller tom for å hente alle)
   - Order By: `Order asc`
2. **Response** med status 200 og body:
   ```json
   {
     "value": @{body('Get_items')?['value']}
   }
   ```

**Request Body JSON Schema** (for POST):
```json
{
  "type": "object",
  "properties": {}
}
```

### Flow 2: Hent Meldinger

**Trigger**: When a HTTP request is received (GET)

**Steg**:
1. **Initialize variable** `today` = utcNow()
2. **Get items** fra SharePoint-listen "Meldinger"
   - Filter Query: `PublishDate le '@{variables('today')}'`
   - Order By: `PublishDate desc`
   - Top Count: `@{if(empty(triggerOutputs()['queries']?['$top']), 20, triggerOutputs()['queries']?['$top'])}`
3. **Response** med status 200

### Flow 3: Hent Hurtiglenker

**Trigger**: When a HTTP request is received (GET)

**Steg**:
1. **Get items** fra SharePoint-listen "Hurtiglenker"
   - Order By: `Order asc`
2. **Response** med status 200

### Flow 4: Hent Innhold

**Trigger**: When a HTTP request is received (GET)

**Steg**:
1. **Get items** fra SharePoint-listen "Innhold"
   - Filter Query: `Page eq '@{triggerOutputs()['queries']?['page']}'` (hvis page-parameter er satt)
   - Order By: `Order asc`
2. **Response** med status 200

### Flow 5: Hent Medlemmer

**Trigger**: When a HTTP request is received (GET)

**Steg**:
1. **Get items** fra SharePoint-listen "Medlemmer"
   - Filter Query: Dynamisk basert på query-parametere (voice, search)
   - Order By: `Title asc`
2. **Response** med status 200

### Flow 6: Hent Dokumenter

**Trigger**: When a HTTP request is received (GET)

**Steg**:
1. **Get files (properties only)** fra SharePoint-biblioteket "Dokumenter"
   - Folder: `@{triggerOutputs()['queries']?['folder']}` (hvis satt)
2. **Response** med status 200

### Flow 7: Hent Noter

**Trigger**: When a HTTP request is received (GET)

**Steg**:
1. **Get items** fra SharePoint-listen "Noter"
   - Order By: `Title asc`
2. **Response** med status 200 og body:
   ```json
   {
     "value": @{body('Get_items')?['value']}
   }
   ```

### Flow 8: Hent Konserter

**Trigger**: When a HTTP request is received (GET)

**Steg**:
1. **Initialize variable** `today` = utcNow()
2. **Get items** fra SharePoint-listen "Konserter"
   - Filter Query: `Date ge '@{variables('today')}' and IsPublished eq true`
   - Order By: `Date asc`
3. **Response** med status 200 og body:
   ```json
   {
     "value": @{body('Get_items')?['value']}
   }
   ```

### Flow 9: Opprett Billettreservasjon

**Trigger**: When a HTTP request is received (POST)

**Request Body JSON Schema**:
```json
{
  "type": "object",
  "properties": {
    "concertId": { "type": "integer" },
    "name": { "type": "string" },
    "email": { "type": "string" },
    "phone": { "type": "string" },
    "ticketCount": { "type": "integer" },
    "message": { "type": "string" },
    "totalPrice": { "type": "number" },
    "reservationDate": { "type": "string" }
  },
  "required": ["concertId", "name", "email", "ticketCount", "totalPrice"]
}
```

**Steg**:
1. **Initialize variable** `refNumber` = `RES-@{formatDateTime(utcNow(), 'yyyy')}-@{rand(1000,9999)}`
2. **Get item** fra Konserter med ID = concertId
3. **Condition**: Er det nok billetter tilgjengelig?
   - Ja:
     a. **Create item** i Billettreservasjoner
        - Title: refNumber
        - ConcertId: concertId
        - Name, Email, Phone, TicketCount, TotalPrice, Message
        - ReservationDate: utcNow()
        - Status: "Ny"
     b. **Update item** i Konserter
        - SoldTickets: original + ticketCount
     c. **Send an email** til bestilleren
     d. **Response** med status 200:
        ```json
        {
          "success": true,
          "referenceNumber": "@{variables('refNumber')}",
          "message": "Reservasjon bekreftet"
        }
        ```
   - Nei:
     **Response** med status 400:
     ```json
     {
       "success": false,
       "message": "Ikke nok billetter tilgjengelig"
     }
     ```

**Eksempel på Power Automate flow-definisjon:**

```json
{
  "definition": {
    "triggers": {
      "manual": {
        "type": "Request",
        "kind": "Http",
        "inputs": {
          "method": "GET"
        }
      }
    },
    "actions": {
      "Get_items": {
        "type": "ApiConnection",
        "inputs": {
          "host": {
            "connection": {
              "name": "@parameters('$connections')['sharepointonline']['connectionId']"
            }
          },
          "method": "get",
          "path": "/datasets/@{encodeURIComponent(encodeURIComponent('https://tenant.sharepoint.com/sites/kor'))}/tables/@{encodeURIComponent(encodeURIComponent('Noter'))}/items"
        }
      },
      "Response": {
        "type": "Response",
        "kind": "Http",
        "inputs": {
          "statusCode": 200,
          "headers": {
            "Content-Type": "application/json"
          },
          "body": {
            "value": "@body('Get_items')?['value']"
          }
        },
        "runAfter": {
          "Get_items": ["Succeeded"]
        }
      }
    }
  }
}
```

---

## Opprettelse av lister via PnP PowerShell

```powershell
# Koble til SharePoint
Connect-PnPOnline -Url "https://tenant.sharepoint.com/sites/intranet" -Interactive

# Opprett Navigasjon-liste (med rollebasert tilgangskontroll)
New-PnPList -Title "Navigasjon" -Template GenericList
Add-PnPField -List "Navigasjon" -DisplayName "URL" -InternalName "URL" -Type Text -Required
Add-PnPField -List "Navigasjon" -DisplayName "Ikon" -InternalName "Icon" -Type Text
Add-PnPField -List "Navigasjon" -DisplayName "Rekkefølge" -InternalName "Order" -Type Number
Add-PnPField -List "Navigasjon" -DisplayName "Åpne i ny fane" -InternalName "OpenInNewTab" -Type Boolean
Add-PnPField -List "Navigasjon" -DisplayName "Aktiv" -InternalName "IsActive" -Type Boolean
Add-PnPFieldFromXml -List "Navigasjon" -FieldXml '<Field Type="Choice" DisplayName="Minimumsrolle" Required="FALSE" Format="Dropdown" Name="MinRole"><Default>anonym</Default><CHOICES><CHOICE>anonym</CHOICE><CHOICE>medlem</CHOICE><CHOICE>styre</CHOICE><CHOICE>admin</CHOICE></CHOICES></Field>'
Add-PnPField -List "Navigasjon" -DisplayName "Skjul for innloggede" -InternalName "HideWhenLoggedIn" -Type Boolean
Add-PnPField -List "Navigasjon" -DisplayName "Er utlogging" -InternalName "IsLogout" -Type Boolean

# Opprett Meldinger-liste (fra styret) - Hybrid: nøkkelfelt + Data (JSON)
New-PnPList -Title "Meldinger" -Template GenericList
Add-PnPField -List "Meldinger" -DisplayName "Publiseringsdato" -InternalName "PublishDate" -Type DateTime -Required
Add-PnPField -List "Meldinger" -DisplayName "Er viktig" -InternalName "IsImportant" -Type Boolean
Add-PnPField -List "Meldinger" -DisplayName "Festet" -InternalName "IsPinned" -Type Boolean
Add-PnPField -List "Meldinger" -DisplayName "Data" -InternalName "Data" -Type Note -Required

# Opprett Innlegg-liste (fra medlemmer) - Hybrid: nøkkelfelt + Data (JSON)
New-PnPList -Title "Innlegg" -Template GenericList
Add-PnPField -List "Innlegg" -DisplayName "Forfatter" -InternalName "AuthorName" -Type Text -Required
Add-PnPField -List "Innlegg" -DisplayName "Publiseringsdato" -InternalName "PublishDate" -Type DateTime -Required
Add-PnPField -List "Innlegg" -DisplayName "Data" -InternalName "Data" -Type Note -Required

# Opprett Hurtiglenker-liste
New-PnPList -Title "Hurtiglenker" -Template GenericList
Add-PnPField -List "Hurtiglenker" -DisplayName "URL" -InternalName "URL" -Type URL -Required
Add-PnPField -List "Hurtiglenker" -DisplayName "Ikon" -InternalName "Icon" -Type Text
Add-PnPField -List "Hurtiglenker" -DisplayName "Beskrivelse" -InternalName "Description" -Type Text
Add-PnPField -List "Hurtiglenker" -DisplayName "Rekkefølge" -InternalName "Order" -Type Number
Add-PnPField -List "Hurtiglenker" -DisplayName "Åpne i ny fane" -InternalName "OpenInNewTab" -Type Boolean

# Opprett Innhold-liste (artikler og dynamisk innhold) - Hybrid: nøkkelfelt + Data (JSON)
New-PnPList -Title "Innhold" -Template GenericList
Add-PnPField -List "Innhold" -DisplayName "Slug" -InternalName "Slug" -Type Text -Required
Add-PnPFieldFromXml -List "Innhold" -FieldXml '<Field Type="Choice" DisplayName="Side" Required="FALSE" Format="Dropdown" Name="Page"><CHOICES><CHOICE>home</CHOICE><CHOICE>about</CHOICE></CHOICES></Field>'
Add-PnPField -List "Innhold" -DisplayName "Data" -InternalName "Data" -Type Note -Required

# Opprett Medlemmer-liste (kormedlemmer)
New-PnPList -Title "Medlemmer" -Template GenericList
Add-PnPField -List "Medlemmer" -DisplayName "E-post" -InternalName "Email" -Type Text -Required
Add-PnPField -List "Medlemmer" -DisplayName "Telefon" -InternalName "Phone" -Type Text
Add-PnPFieldFromXml -List "Medlemmer" -FieldXml '<Field Type="Choice" DisplayName="Stemme" Required="TRUE" Format="Dropdown" Name="Voice"><CHOICES><CHOICE>Sopran 1</CHOICE><CHOICE>Sopran 2</CHOICE><CHOICE>Alt 1</CHOICE><CHOICE>Alt 2</CHOICE><CHOICE>Tenor 1</CHOICE><CHOICE>Tenor 2</CHOICE><CHOICE>Bass 1</CHOICE><CHOICE>Bass 2</CHOICE></CHOICES></Field>'
Add-PnPFieldFromXml -List "Medlemmer" -FieldXml '<Field Type="Choice" DisplayName="Rolle" Required="FALSE" Format="Dropdown" Name="Role"><Default>medlem</Default><CHOICES><CHOICE>medlem</CHOICE><CHOICE>styre</CHOICE><CHOICE>admin</CHOICE></CHOICES></Field>'
Add-PnPField -List "Medlemmer" -DisplayName "Bilde" -InternalName "Picture" -Type Image
Add-PnPField -List "Medlemmer" -DisplayName "Medlem fra" -InternalName "JoinedAt" -Type DateTime

# Opprett Kontaktpersoner-liste
New-PnPList -Title "Kontaktpersoner" -Template GenericList
Add-PnPField -List "Kontaktpersoner" -DisplayName "E-post" -InternalName "Email" -Type Text -Required
Add-PnPField -List "Kontaktpersoner" -DisplayName "Telefon" -InternalName "Phone" -Type Text
Add-PnPField -List "Kontaktpersoner" -DisplayName "Kontaktrolle" -InternalName "Kontaktrolle" -Type Text -Required
Add-PnPField -List "Kontaktpersoner" -DisplayName "Bilde" -InternalName "Picture" -Type Image
Add-PnPField -List "Kontaktpersoner" -DisplayName "Rekkefølge" -InternalName "Order" -Type Number

# Opprett Noter-liste (Notebibliotek for kor)
New-PnPList -Title "Noter" -Template GenericList
Add-PnPField -List "Noter" -DisplayName "Komponist" -InternalName "Composer" -Type Text
Add-PnPFieldFromXml -List "Noter" -FieldXml '<Field Type="Choice" DisplayName="Stemmegruppe" Required="TRUE" Format="Dropdown" FillInChoice="FALSE" Name="VoiceGroup"><CHOICES><CHOICE>Sopran-1</CHOICE><CHOICE>Sopran-2</CHOICE><CHOICE>Sopran</CHOICE><CHOICE>Alt-1</CHOICE><CHOICE>Alt-2</CHOICE><CHOICE>Alt</CHOICE><CHOICE>Tenor-1</CHOICE><CHOICE>Tenor-2</CHOICE><CHOICE>Tenor</CHOICE><CHOICE>Bass-1</CHOICE><CHOICE>Bass-2</CHOICE><CHOICE>Bass</CHOICE><CHOICE>Tutti</CHOICE></CHOICES></Field>'
Add-PnPFieldFromXml -List "Noter" -FieldXml '<Field Type="Choice" DisplayName="Kategori" Required="FALSE" Format="Dropdown" FillInChoice="TRUE" Name="Category"><CHOICES><CHOICE>Klassisk</CHOICE><CHOICE>Folkemusikk</CHOICE><CHOICE>Pop/Rock</CHOICE><CHOICE>Julesanger</CHOICE><CHOICE>Påskesanger</CHOICE><CHOICE>Nasjonalsanger</CHOICE><CHOICE>Spirituals</CHOICE><CHOICE>Jazz</CHOICE><CHOICE>Barnesanger</CHOICE><CHOICE>Kirkemusikk</CHOICE><CHOICE>Konsertrepertoar</CHOICE><CHOICE>Øvelser</CHOICE></CHOICES></Field>'
Add-PnPField -List "Noter" -DisplayName "PDF-fil" -InternalName "PDFFileURL" -Type URL
Add-PnPField -List "Noter" -DisplayName "Lydfil" -InternalName "AudioFileURL" -Type URL
Add-PnPField -List "Noter" -DisplayName "Opplastingsdato" -InternalName "UploadDate" -Type DateTime
Add-PnPField -List "Noter" -DisplayName "Beskrivelse" -InternalName "Description" -Type Note
Add-PnPFieldFromXml -List "Noter" -FieldXml '<Field Type="Choice" DisplayName="Vanskelighetsgrad" Required="FALSE" Format="Dropdown" Name="Difficulty"><CHOICES><CHOICE>Lett</CHOICE><CHOICE>Middels</CHOICE><CHOICE>Vanskelig</CHOICE></CHOICES></Field>'
Add-PnPField -List "Noter" -DisplayName "Varighet" -InternalName "Duration" -Type Text
Add-PnPField -List "Noter" -DisplayName "Arrangement" -InternalName "Arrangement" -Type Text
Add-PnPField -List "Noter" -DisplayName "Tekst" -InternalName "Lyrics" -Type Note

# Opprett Konserter-liste - Hybrid: nøkkelfelt + Data (JSON)
New-PnPList -Title "Konserter" -Template GenericList
Add-PnPField -List "Konserter" -DisplayName "Dato" -InternalName "Date" -Type DateTime -Required
Add-PnPField -List "Konserter" -DisplayName "Sted" -InternalName "Location" -Type Text -Required
Add-PnPField -List "Konserter" -DisplayName "Pris" -InternalName "Price" -Type Number
Add-PnPField -List "Konserter" -DisplayName "Er gratis" -InternalName "IsFree" -Type Boolean
Add-PnPField -List "Konserter" -DisplayName "Totalt billetter" -InternalName "TotalTickets" -Type Number
Add-PnPField -List "Konserter" -DisplayName "Solgte billetter" -InternalName "SoldTickets" -Type Number
Add-PnPFieldFromXml -List "Konserter" -FieldXml '<Field Type="Choice" DisplayName="Kategori" Required="FALSE" Format="Dropdown" FillInChoice="TRUE" Name="Category"><CHOICES><CHOICE>Vårkonsert</CHOICE><CHOICE>Sommerkonsert</CHOICE><CHOICE>Høstkonsert</CHOICE><CHOICE>Julekonsert</CHOICE><CHOICE>Jubileumskonsert</CHOICE><CHOICE>Kirkekonsert</CHOICE><CHOICE>Utendørskonsert</CHOICE><CHOICE>Privat arrangement</CHOICE></CHOICES></Field>'
Add-PnPField -List "Konserter" -DisplayName "Publisert" -InternalName "IsPublished" -Type Boolean
Add-PnPField -List "Konserter" -DisplayName "Data" -InternalName "Data" -Type Note -Required

# Opprett Billettreservasjoner-liste
New-PnPList -Title "Billettreservasjoner" -Template GenericList
Add-PnPField -List "Billettreservasjoner" -DisplayName "Konsert" -InternalName "ConcertId" -Type Lookup -LookupList "Konserter" -LookupField "Title"
Add-PnPField -List "Billettreservasjoner" -DisplayName "Navn" -InternalName "Name" -Type Text -Required
Add-PnPField -List "Billettreservasjoner" -DisplayName "E-post" -InternalName "Email" -Type Text -Required
Add-PnPField -List "Billettreservasjoner" -DisplayName "Telefon" -InternalName "Phone" -Type Text
Add-PnPField -List "Billettreservasjoner" -DisplayName "Antall billetter" -InternalName "TicketCount" -Type Number -Required
Add-PnPField -List "Billettreservasjoner" -DisplayName "Totalpris" -InternalName "TotalPrice" -Type Currency -Required
Add-PnPField -List "Billettreservasjoner" -DisplayName "Melding" -InternalName "Message" -Type Note
Add-PnPField -List "Billettreservasjoner" -DisplayName "Bestillingsdato" -InternalName "ReservationDate" -Type DateTime -Required
Add-PnPFieldFromXml -List "Billettreservasjoner" -FieldXml '<Field Type="Choice" DisplayName="Status" Required="TRUE" Format="Dropdown" Name="Status"><Default>Ny</Default><CHOICES><CHOICE>Ny</CHOICE><CHOICE>Bekreftet</CHOICE><CHOICE>Kansellert</CHOICE><CHOICE>Fullført</CHOICE></CHOICES></Field>'
Add-PnPFieldFromXml -List "Billettreservasjoner" -FieldXml '<Field Type="Choice" DisplayName="Betalingsstatus" Required="FALSE" Format="Dropdown" Name="PaymentStatus"><Default>Venter</Default><CHOICES><CHOICE>Venter</CHOICE><CHOICE>Betalt</CHOICE><CHOICE>Refundert</CHOICE></CHOICES></Field>'
Add-PnPField -List "Billettreservasjoner" -DisplayName "Bekreftelse sendt" -InternalName "ConfirmationSent" -Type Boolean

Write-Host "Alle lister er opprettet!" -ForegroundColor Green
```

---

## Tilpasning

### Legge til nye kolonner

1. Legg til kolonnen i SharePoint-listen
2. Oppdater Power Automate flow hvis nødvendig
3. Oppdater `transformXxxData`-metoden i `sharepoint-api.js`

### Legge til ny liste

1. Opprett listen i SharePoint
2. Opprett Power Automate flow
3. Legg til endpoint i `.env`
4. Legg til config i `sharepoint-api.js`
5. Opprett `getXxx` og `transformXxxData` metoder
6. Dokumenter i denne filen
