# Migration: Power Automate → Node/Express + Azure Table Storage

## 1. Alle endepunkter (63 stk)

Alle ressurser har full CRUD (Create/Read/Update/Delete) der det gir mening.

### Auth (2)

| # | Metode | Path | Beskrivelse |
|---|--------|------|-------------|
| 1 | POST | `/api/auth/send-kode` | Send innloggingskode til e-post |
| 2 | POST | `/api/auth/verifiser-kode` | Verifiser kode, returner medlem |

### Navigasjon (4)

| # | Metode | Path | Beskrivelse |
|---|--------|------|-------------|
| 3 | GET | `/api/navigasjon` | Hent navigasjonsmenyen |
| 4 | POST | `/api/navigasjon` | Opprett navigasjonselement |
| 5 | PATCH | `/api/navigasjon/:id` | Oppdater navigasjonselement |
| 6 | DELETE | `/api/navigasjon/:id` | Slett navigasjonselement |

### Artikler (4)

| # | Metode | Path | Beskrivelse |
|---|--------|------|-------------|
| 7 | GET | `/api/forside/artikkel?slug=frontpage` | Hent artikkel |
| 8 | POST | `/api/forside/artikkel` | Opprett artikkel |
| 9 | PATCH | `/api/forside/artikkel/:id` | Oppdater artikkel |
| 10 | DELETE | `/api/forside/artikkel/:id` | Slett artikkel |

### Kontaktpersoner (4)

| # | Metode | Path | Beskrivelse |
|---|--------|------|-------------|
| 11 | GET | `/api/forside/kontaktpersoner` | Hent kontaktpersoner |
| 12 | POST | `/api/forside/kontaktpersoner` | Opprett kontaktperson |
| 13 | PATCH | `/api/forside/kontaktpersoner/:id` | Oppdater kontaktperson |
| 14 | DELETE | `/api/forside/kontaktpersoner/:id` | Slett kontaktperson |

### Hurtiglenker (4)

| # | Metode | Path | Beskrivelse |
|---|--------|------|-------------|
| 15 | GET | `/api/forside/hurtiglenker` | Hent hurtiglenker |
| 16 | POST | `/api/forside/hurtiglenker` | Opprett hurtiglenke |
| 17 | PATCH | `/api/forside/hurtiglenker/:id` | Oppdater hurtiglenke |
| 18 | DELETE | `/api/forside/hurtiglenker/:id` | Slett hurtiglenke |

### Meldinger (5)

| # | Metode | Path | Beskrivelse |
|---|--------|------|-------------|
| 19 | GET | `/api/meldinger?limit=20&offset=0` | Hent meldinger (paginert) |
| 20 | POST | `/api/meldinger` | Opprett ny melding |
| 21 | POST | `/api/meldinger/kommentar` | Legg til kommentar |
| 22 | PATCH | `/api/meldinger/:id` | Oppdater melding |
| 23 | DELETE | `/api/meldinger/:id` | Slett melding |

### Innlegg (3)

| # | Metode | Path | Beskrivelse |
|---|--------|------|-------------|
| 24 | GET | `/api/innlegg?limit=20&offset=0` | Hent innlegg (paginert) |
| 25 | POST | `/api/innlegg` | Opprett nytt innlegg |
| 26 | POST | `/api/innlegg/kommentar` | Legg til kommentar |

### Øvelse (2)

| # | Metode | Path | Beskrivelse |
|---|--------|------|-------------|
| 27 | GET | `/api/ovelse/program` | Hent øvelsesprogram |
| 28 | POST | `/api/ovelse/sideskift` | Lagre sideskift |

### Nedlasting (4)

| # | Metode | Path | Beskrivelse |
|---|--------|------|-------------|
| 29 | GET | `/api/nedlasting/filer` | Hent nedlastbare filer |
| 30 | POST | `/api/nedlasting/filer` | Opprett nedlasting |
| 31 | PATCH | `/api/nedlasting/filer/:id` | Oppdater nedlasting |
| 32 | DELETE | `/api/nedlasting/filer/:id` | Slett nedlasting |

### Konserter (5)

| # | Metode | Path | Beskrivelse |
|---|--------|------|-------------|
| 33 | GET | `/api/konserter?upcoming=true` | Hent konserter |
| 34 | POST | `/api/konserter` | Opprett konsert |
| 35 | POST | `/api/konserter/billett` | Bestill billetter |
| 36 | PATCH | `/api/konserter/:id` | Oppdater konsert |
| 37 | DELETE | `/api/konserter/:id` | Slett konsert |

### Billetter — admin (3)

| # | Metode | Path | Beskrivelse |
|---|--------|------|-------------|
| 38 | GET | `/api/billetter/ubetalte` | Hent alle reservasjoner |
| 39 | POST | `/api/billetter/marker-betalt` | Marker som betalt |
| 40 | POST | `/api/billetter/slett` | Slett reservasjoner |

### Billettkontroll (1)

| # | Metode | Path | Beskrivelse |
|---|--------|------|-------------|
| 41 | POST | `/api/billettkontroll/valider` | Valider billett (innsjekk) |

### Musikk (4)

| # | Metode | Path | Beskrivelse |
|---|--------|------|-------------|
| 42 | GET | `/api/musikk/konserter` | Hent musikkarkiv |
| 43 | POST | `/api/musikk/konserter` | Opprett musikkonsert |
| 44 | PATCH | `/api/musikk/konserter/:id` | Oppdater musikkonsert |
| 45 | DELETE | `/api/musikk/konserter/:id` | Slett musikkonsert |

### Medlemmer & arrangementer (5)

| # | Metode | Path | Beskrivelse |
|---|--------|------|-------------|
| 46 | GET | `/api/medlemmer/side` | Hent medlemsside + arrangementer |
| 47 | POST | `/api/medlemmer/rsvp` | RSVP til arrangement |
| 48 | POST | `/api/medlemmer/arrangement` | Opprett arrangement |
| 49 | PATCH | `/api/medlemmer/arrangement/:id` | Oppdater arrangement |
| 50 | DELETE | `/api/medlemmer/arrangement/:id` | Slett arrangement |

### Filer (4)

| # | Metode | Path | Beskrivelse |
|---|--------|------|-------------|
| 51 | GET | `/api/filer` | Hent filoversikt |
| 52 | POST | `/api/filer/oppdater` | Oppdater fil-metadata (enkel/batch) |
| 53 | POST | `/api/filer/batch-oppdater` | Batch-oppdater fil-metadata |
| 54 | POST | `/api/filer/last-opp` | Last opp filer (base64) |

### Blob (2)

| # | Metode | Path | Beskrivelse |
|---|--------|------|-------------|
| 55 | POST | `/api/blob/last-opp` | Kopier filer til blob |
| 56 | POST | `/api/blob/tom` | Tøm blob container |

### Styre — admin (5)

| # | Metode | Path | Beskrivelse |
|---|--------|------|-------------|
| 57 | GET | `/api/styre/medlemmer` | Hent alle medlemmer |
| 58 | POST | `/api/styre/registrer` | Registrer nytt medlem |
| 59 | POST | `/api/styre/oppdater` | Oppdater medlem |
| 60 | POST | `/api/styre/slett` | Slett medlem |
| 61 | POST | `/api/styre/send-epost` | Send e-post til medlemmer |

### Profil (2)

| # | Metode | Path | Beskrivelse |
|---|--------|------|-------------|
| 62 | POST | `/api/profil/hent` | Hent profil |
| 63 | POST | `/api/profil/oppdater` | Oppdater profil |

---

## 2. JSON request/response-formater

### Auth

```
POST /api/auth/send-kode
Request:  { "email": "user@example.com" }
Response: { "success": true, "message": "Kode sendt til e-post." }

POST /api/auth/verifiser-kode
Request:  { "email": "user@example.com", "code": "123456" }
Response: { "success": true, "member": { "id": "MBR-xxx", "name": "Kari", "email": "kari@test.no", "voice": "sopran 1", "phone": "99887766", "role": "medlem" } }
```

### Navigasjon

```
GET /api/navigasjon
Response: [
  { "id": "NAV-xxx", "title": "Hjem", "url": "/", "icon": "🏠", "order": 0, "openInNewTab": false, "minRole": "anonym", "hideWhenLoggedIn": false, "isLogout": false }
]

POST /api/navigasjon
Request:  { "title": "Ny side", "url": "/side.html", "icon": "📄", "order": 5, "minRole": "medlem" }
Response: { "success": true, "id": "NAV-xxx" }

PATCH /api/navigasjon/:id
Request:  { "title": "Oppdatert tittel", "order": 3 }
Response: { "success": true, "message": "Navigasjonselement oppdatert." }

DELETE /api/navigasjon/:id
Response: { "success": true, "message": "Navigasjonselement slettet." }
```

### Artikkel

```
GET /api/forside/artikkel?slug=frontpage
Response: { "id": "frontpage", "title": "Velkommen", "text": "...", "format": "markdown", "imageUrl": "https://...", "imagePlacement": "angitt", "slug": "frontpage", "published": "2026-01-01T00:00:00Z", "author": null }

POST /api/forside/artikkel
Request:  { "title": "Ny artikkel", "text": "Innhold her...", "format": "markdown", "slug": "om-oss", "imageUrl": "", "imagePlacement": "over" }
Response: { "success": true, "id": "om-oss" }

PATCH /api/forside/artikkel/:id
Request:  { "title": "Oppdatert tittel", "text": "Nytt innhold" }
Response: { "success": true, "message": "Artikkel oppdatert." }

DELETE /api/forside/artikkel/:id
Response: { "success": true, "message": "Artikkel slettet." }
```

### Kontaktpersoner

```
GET /api/forside/kontaktpersoner
Response: [
  { "id": "KON-xxx", "name": "Kari", "email": "dirigent@kor.no", "phone": "99 88 77 66", "kontaktrolle": "Dirigent", "image": null, "order": 0 }
]

POST /api/forside/kontaktpersoner
Request:  { "name": "Per Dirigansen", "email": "dirigent@kor.no", "phone": "+47 900 00 001", "kontaktrolle": "Dirigent", "order": 1 }
Response: { "success": true, "id": "KON-xxx" }

PATCH /api/forside/kontaktpersoner/:id
Request:  { "phone": "+47 900 00 002" }
Response: { "success": true, "message": "Kontaktperson oppdatert." }

DELETE /api/forside/kontaktpersoner/:id
Response: { "success": true, "message": "Kontaktperson slettet." }
```

### Hurtiglenker

```
GET /api/forside/hurtiglenker
Response: [
  { "id": "QL-xxx", "title": "Konserter", "url": "/konserter.html", "icon": "🎭", "description": "Se kommende konserter", "order": 0, "openInNewTab": true }
]

POST /api/forside/hurtiglenker
Request:  { "title": "Facebook-gruppe", "url": "https://facebook.com/groups/koret", "icon": "👥", "description": "Vår gruppe", "order": 4, "openInNewTab": true }
Response: { "success": true, "id": "QL-xxx" }

PATCH /api/forside/hurtiglenker/:id
Request:  { "title": "Oppdatert lenke", "url": "/ny-side.html" }
Response: { "success": true, "message": "Hurtiglenke oppdatert." }

DELETE /api/forside/hurtiglenker/:id
Response: { "success": true, "message": "Hurtiglenke slettet." }
```

### Meldinger

```
GET /api/meldinger?limit=20&offset=0
Response: { "data": [...], "total": 42, "limit": 20, "offset": 0, "hasMore": true }

Message: { "id": "MSG-xxx", "title": "...", "content": "...", "format": "markdown", "author": "Styret", "publishedAt": "2026-01-20T10:00:00Z", "imageUrl": "", "isImportant": false, "isPinned": false, "commentCount": 2, "comments": [{ "id": "CMT-xxx", "author": "Kari", "email": "kari@test.no", "text": "...", "createdAt": "2026-01-21T10:30:00Z" }] }

POST /api/meldinger
Request:  { "title": "...", "content": "...", "authorName": "Ola", "authorEmail": "ola@kor.no" }
Response: { "success": true, "id": "MSG-xxx" }

POST /api/meldinger/kommentar
Request:  { "messageId": "MSG-xxx", "text": "...", "authorName": "Kari", "authorEmail": "kari@test.no" }
Response: { "success": true, "message": "Kommentar lagt til." }
```

### Innlegg

```
GET /api/innlegg?limit=20&offset=0
Response: { "data": [...], "total": 15, "limit": 20, "offset": 0, "hasMore": false }

Post: { "id": "POST-xxx", "title": "...", "content": "...", "author": { "id": "MBR-xxx", "name": "Kari" }, "createdAt": "2026-01-22T18:30:00Z", "commentCount": 2, "comments": [...] }

POST /api/innlegg
Request:  { "title": "...", "content": "...", "authorId": "MBR-xxx", "authorName": "Kari", "authorEmail": "kari@kor.no", "authorVoice": "Sopran 1" }
Response: { "success": true, "id": "POST-xxx" }

POST /api/innlegg/kommentar
Request:  { "postId": "POST-xxx", "text": "...", "authorName": "Kari", "authorEmail": "kari@test.no" }
Response: { "success": true, "message": "Kommentar lagt til." }
```

### Øvelse

```
GET /api/ovelse/program
Response: {
  "title": "Vårprogram 2026",
  "voice": "tutti",
  "baseUrls": { "pdf": "https://utsiktenblob.blob.core.windows.net/sanger/", "audio": "https://utsiktenblob.blob.core.windows.net/sanger/" },
  "notes": [{
    "id": "Sanctus", "noteTitle": "Sanctus", "pdfFilename": "Sanctus.pdf",
    "audio": { "sopran 1": "Sanctus-S1.mp3", "tutti": "Sanctus-Tutti.mp3" },
    "pageTurns": [{ "time": 45.2, "page": 2 }], "sortOrder": 1
  }]
}

POST /api/ovelse/sideskift
Request:  { "workId": "Sanctus", "pageTurns": [{ "time": 45.2, "page": 2 }, { "time": 92.8, "page": 3 }] }
Response: { "success": true, "message": "Sideskift lagret." }
```

### Nedlasting

```
GET /api/nedlasting/filer
Response: [
  { "id": "DL-xxx", "title": "Lift me up", "fileUrl": "https://utsiktenblob.blob.core.windows.net/sanger/Lift-Me-Up.pdf", "filename": "Lift-Me-Up.pdf", "category": "Noter", "fileSize": null, "uploadedAt": null, "sortOrder": 1 }
]

POST /api/nedlasting/filer
Request:  { "title": "Ny note", "fileUrl": "https://blob.../ny-note.pdf", "filename": "ny-note.pdf", "category": "Noter", "sortOrder": 5 }
Response: { "success": true, "id": "DL-xxx" }

PATCH /api/nedlasting/filer/:id
Request:  { "title": "Oppdatert tittel", "category": "Øvefiler" }
Response: { "success": true, "message": "Nedlasting oppdatert." }

DELETE /api/nedlasting/filer/:id
Response: { "success": true, "message": "Nedlasting slettet." }
```

### Konserter

```
GET /api/konserter?upcoming=true&$top=10
Response: [
  { "id": "CON-xxx", "title": "Vårkonsert 2026", "date": "2026-04-18", "time": "19:00", "location": "Kulturhuset", "address": "Youngstorget 3", "description": "...", "imageUrl": null, "ticketPrice": 250, "ticketsAvailable": 63, "ticketUrl": null, "isPublic": true, "status": "available", "category": null }
]

POST /api/konserter
Request:  { "title": "Høstkonsert 2026", "date": "2026-10-15", "time": "19:00", "location": "Kulturhuset", "address": "Youngstorget 3", "description": "...", "ticketPrice": 250, "ticketsAvailable": 100, "isPublic": true }
Response: { "success": true, "id": "CON-xxx" }

POST /api/konserter/billett
Request:  { "concertId": "CON-xxx", "name": "Ola", "email": "ola@test.no", "phone": "+47 123 45 678", "ticketCount": 2, "message": "", "totalPrice": 500, "reservationDate": "2026-03-08T12:00:00Z" }
Response: { "success": true, "referenceNumber": "UTK-2026-0042", "bookingReference": "UTK-2026-0042", "totalPrice": 500, "message": "Bestilling mottatt!" }

PATCH /api/konserter/:id
Request:  { "title": "Oppdatert tittel", "ticketsAvailable": 50 }
Response: { "success": true, "message": "Konsert oppdatert." }

DELETE /api/konserter/:id
Response: { "success": true, "message": "Konsert slettet." }
```

### Billetter (admin)

```
GET /api/billetter/ubetalte
Response: [
  { "id": "BIL-xxx", "ticketId": "UTK-2026-0042", "concertId": "1", "concertTitle": "Vårkonsert 2026", "concertDate": "2026-04-18", "name": "Ola", "email": "ola@test.no", "phone": "+47 123 45 678", "ticketCount": 2, "totalPrice": 500, "reservationDate": "2026-02-01T12:00:00Z", "isPaid": false }
]

POST /api/billetter/marker-betalt
Request:  { "reservationIds": ["BIL-xxx", "BIL-yyy"] }
Response: { "success": true, "updatedIds": ["BIL-xxx", "BIL-yyy"], "message": "2 reservasjoner markert som betalt." }

POST /api/billetter/slett
Request:  { "reservationIds": ["BIL-xxx"] }
Response: { "success": true, "message": "1 reservasjoner slettet." }
```

### Billettkontroll

```
POST /api/billettkontroll/valider
Request:  { "referenceNumber": "UTK-2026-0042" }
Response: { "status": "valid", "message": "Gyldig billett — sjekket inn" }
         | { "status": "already_checked_in", "message": "Allerede sjekket inn" }
         | { "status": "not_paid", "message": "Ikke betalt" }
         | { "status": "not_found", "message": "Ukjent billett" }
```

### Musikk

```
GET /api/musikk/konserter
Response: [
  { "id": "MUS-xxx", "title": "Julekonsert 2024", "date": "2024-12-15", "location": "Vålerenga kirke",
    "images": [{ "url": "https://...", "caption": "Koret" }],
    "tracks": [{ "id": 1, "title": "O Helga Natt", "duration": 245, "audioUrl": "https://..." }]
  }
]

POST /api/musikk/konserter
Request:  { "title": "Vårkonsert 2025", "date": "2025-05-15", "location": "Oslo konserthus", "images": [], "tracks": [{ "id": 1, "title": "Våren", "duration": 180, "audioUrl": "https://..." }] }
Response: { "success": true, "id": "MUS-xxx" }

PATCH /api/musikk/konserter/:id
Request:  { "title": "Oppdatert tittel", "tracks": [...] }
Response: { "success": true, "message": "Musikkonsert oppdatert." }

DELETE /api/musikk/konserter/:id
Response: { "success": true, "message": "Musikkonsert slettet." }
```

### Medlemmer

```
GET /api/medlemmer/side
Response: {
  "article": { "title": "Velkommen!", "text": "...", "format": "markdown", "imageUrl": "...", "imagePlacement": "angitt" },
  "events": [{
    "id": "EVT-xxx", "title": "Korøvelse", "description": "...", "date": "2026-02-10",
    "startTime": "18:00", "endTime": "20:30", "location": "Øvingslokalet",
    "attendees": [{ "name": "Ola", "email": "ola@test.no", "status": "attending" }],
    "totalMembers": 25
  }]
}

POST /api/medlemmer/rsvp
Request:  { "eventId": "EVT-xxx", "action": "attending", "memberName": "Kari", "memberEmail": "kari@kor.no" }
Response: { "success": true, "message": "RSVP registrert." }

POST /api/medlemmer/arrangement
Request:  { "title": "Ekstraøvelse", "description": "...", "date": "2026-03-15", "startTime": "10:00", "endTime": "15:00", "location": "Kirken", "authorName": "Kari", "authorEmail": "kari@kor.no" }
Response: { "success": true, "id": "EVT-xxx" }
```

### Filer

```
GET /api/filer
Response: { "filer": [{ "id": "1", "navn": "Halleluja - Sopran.mp3", "kategori": "Øvefil", "url": "/filer/musikk/...", "sortering": 1, "verk": "Halleluja", "stemme": "Sopran-1", "anledning": "Julekonsert 2024" }] }

POST /api/filer/oppdater
Request (enkel): { "id": "1", "kategori": "Øvefil", "verk": "Halleluja", "stemme": "Sopran-1", "sortering": 1, "anledning": "Julekonsert 2024" }
Request (batch): { "fileIds": ["1","2","3"], "kategori": "Note", "verk": "Halleluja" }
Response: { "success": true, "message": "3 fil(er) oppdatert." }

POST /api/filer/last-opp
Request:  { "filer": [{ "navn": "file.pdf", "innhold": "<base64>" }] }
Response: { "success": true, "uploadedCount": 1 }
```

### Blob

```
POST /api/blob/last-opp
Request:  { "files": [{ "id": "1", "url": "https://source/file.mp3", "navn": "file.mp3" }] }
Response: { "success": true, "uploadedCount": 1 }

POST /api/blob/tom
Request:  { "action": "clear_all" }
Response: { "success": true, "deletedCount": 15, "message": "15 filer slettet fra blob storage." }
```

### Styre (admin)

```
GET /api/styre/medlemmer
Response: [{ "id": "MBR-xxx", "name": "Anna", "email": "anna@test.no", "phone": "+47 901 23 456", "voice": "sopran 1", "role": "admin", "kontingentBetalt": true, "joinedAt": "2019-08-15" }]

POST /api/styre/registrer
Request:  { "name": "Anna", "email": "anna@test.no", "phone": "+47 901 23 456", "voice": "sopran 1", "role": "admin", "kontingentBetalt": true }
Response: { "success": true, "id": "MBR-xxx" }

POST /api/styre/oppdater
Request:  { "memberId": "MBR-xxx", "name": "Anna", "kontingentBetalt": false }
Response: { "success": true, "message": "Medlem oppdatert." }

POST /api/styre/slett
Request:  { "memberId": "MBR-xxx" }
Response: { "success": true, "message": "Medlem slettet." }

POST /api/styre/send-epost
Request:  { "recipients": ["anna@test.no", "erik@test.no"], "subject": "Emne", "message": "Meldingstekst" }
Response: { "success": true, "message": "E-post sendt." }
```

### Profil

```
POST /api/profil/hent
Request:  { "epost": "kari@test.no" }
Response: { "navn": "Kari Nordmann", "epost": "kari@test.no", "telefon": "+47 99887766", "stemme": "Sopran 1", "varsler": { "innlegg": true, "arrangementer": true, "meldinger": true }, "preferanser": { "tema": "dark" } }

POST /api/profil/oppdater
Request:  { "epost": "kari@test.no", "navn": "Kari Nordmann", "telefon": "+47 99887766", "stemme": "Sopran 1", "varsler": { "innlegg": true, "arrangementer": false, "meldinger": true }, "preferanser": { "tema": "dark" } }
Response: { "success": true, "message": "Profil oppdatert." }
```

---

## 3. Azure Table Storage — opprett tabeller

```bash
# Sett connection string som miljøvariabel
export AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=utsiktenblob;AccountKey=...;EndpointSuffix=core.windows.net"

# Opprett tabeller (15 stk)
az storage table create --name Navigation --connection-string "$AZURE_STORAGE_CONNECTION_STRING"
az storage table create --name Articles --connection-string "$AZURE_STORAGE_CONNECTION_STRING"
az storage table create --name Contacts --connection-string "$AZURE_STORAGE_CONNECTION_STRING"
az storage table create --name QuickLinks --connection-string "$AZURE_STORAGE_CONNECTION_STRING"
az storage table create --name Messages --connection-string "$AZURE_STORAGE_CONNECTION_STRING"
az storage table create --name Posts --connection-string "$AZURE_STORAGE_CONNECTION_STRING"
az storage table create --name Practice --connection-string "$AZURE_STORAGE_CONNECTION_STRING"
az storage table create --name Downloads --connection-string "$AZURE_STORAGE_CONNECTION_STRING"
az storage table create --name Concerts --connection-string "$AZURE_STORAGE_CONNECTION_STRING"
az storage table create --name TicketReservations --connection-string "$AZURE_STORAGE_CONNECTION_STRING"
az storage table create --name Music --connection-string "$AZURE_STORAGE_CONNECTION_STRING"
az storage table create --name Members --connection-string "$AZURE_STORAGE_CONNECTION_STRING"
az storage table create --name Events --connection-string "$AZURE_STORAGE_CONNECTION_STRING"
az storage table create --name Files --connection-string "$AZURE_STORAGE_CONNECTION_STRING"
az storage table create --name AuthCodes --connection-string "$AZURE_STORAGE_CONNECTION_STRING"
```

> **Merk:** Tabellene opprettes også automatisk ved oppstart av serveren (`ensureTables()` i `server.js`).

---

## 4. Tabellskjema

Alle tabeller bruker `jsonData`-kolonne for hele JSON-objektet. I tillegg har hver tabell søkbare kolonner som egne Table Storage-kolonner:

| Tabell | PartitionKey | RowKey | Søkbare kolonner |
|--------|-------------|--------|------------------|
| Navigation | `navigation` | unik ID | `order`, `role` |
| Articles | `article` | unik ID | `page` |
| Contacts | `contact` | unik ID | `kontaktrolle` |
| QuickLinks | `quicklink` | unik ID | `order` |
| Messages | `message` | `MSG-xxx` | `publishedAt`, `isPinned` |
| Posts | `post` | `POST-xxx` | `createdAt` |
| Practice | `practice` | verk-ID (f.eks. `Sanctus`) | — |
| Downloads | `download` | unik ID | `category` |
| Concerts | `concert` | unik ID | `date`, `isPublic` |
| TicketReservations | `reservation` | `BIL-xxx` | `concertId`, `isPaid`, `referenceNumber` |
| Music | `music` | unik ID | `date` |
| Members | `member` | `MBR-xxx` | `email`, `role`, `voice` |
| Events | `event` | `EVT-xxx` | `date` |
| Files | `file` | `FIL-xxx` | `kategori`, `verk`, `anledning` |
| AuthCodes | `authcode` | unik ID | `email`, `expiresAt` |

---

## 5. Seed-data for testing

### Navigasjon

```bash
az storage entity insert --table-name Navigation --connection-string "$AZURE_STORAGE_CONNECTION_STRING" \
  --entity PartitionKey=navigation RowKey=nav-1 order=0 role=anonym \
  jsonData='{"title":"Hjem","url":"/","icon":"🏠","order":0,"openInNewTab":false,"minRole":"anonym","hideWhenLoggedIn":false,"isLogout":false}'

az storage entity insert --table-name Navigation --connection-string "$AZURE_STORAGE_CONNECTION_STRING" \
  --entity PartitionKey=navigation RowKey=nav-2 order=1 role=anonym \
  jsonData='{"title":"Konserter","url":"/konserter.html","icon":"🎭","order":1,"openInNewTab":false,"minRole":"anonym","hideWhenLoggedIn":false,"isLogout":false}'

az storage entity insert --table-name Navigation --connection-string "$AZURE_STORAGE_CONNECTION_STRING" \
  --entity PartitionKey=navigation RowKey=nav-3 order=2 role=medlem \
  jsonData='{"title":"Øvelse","url":"/ovelse.html","icon":"🎵","order":2,"openInNewTab":false,"minRole":"medlem","hideWhenLoggedIn":false,"isLogout":false}'
```

### Medlem (for innlogging)

```bash
az storage entity insert --table-name Members --connection-string "$AZURE_STORAGE_CONNECTION_STRING" \
  --entity PartitionKey=member RowKey=MBR-test01 email=test@kammerkoretutsikten.no role=admin voice="sopran 1" \
  jsonData='{"name":"Test Bruker","email":"test@kammerkoretutsikten.no","phone":"+47 99887766","voice":"sopran 1","role":"admin","kontingentBetalt":true,"joinedAt":"2024-01-01","varsler":{"innlegg":true,"arrangementer":true,"meldinger":true},"preferanser":{"tema":"light"}}'
```

### Forsideartikkel

```bash
az storage entity insert --table-name Articles --connection-string "$AZURE_STORAGE_CONNECTION_STRING" \
  --entity PartitionKey=article RowKey=frontpage page=frontpage \
  jsonData='{"title":"Velkommen til Kammerkoret Utsikten","text":"Vi er et blandet kor i Oslo.","format":"markdown","imageUrl":"","imagePlacement":"over","slug":"frontpage","published":"2026-01-01T00:00:00Z","author":null}'
```

### Konsert

```bash
az storage entity insert --table-name Concerts --connection-string "$AZURE_STORAGE_CONNECTION_STRING" \
  --entity PartitionKey=concert RowKey=concert-1 date=2026-04-18 isPublic=true \
  jsonData='{"title":"Vårkonsert 2026","date":"2026-04-18","time":"19:00","location":"Kulturhuset, Store sal","address":"Youngstorget 3, Oslo","description":"Vår årlige vårkonsert med variert repertoar.","imageUrl":null,"ticketPrice":250,"ticketsAvailable":100,"ticketUrl":null,"isPublic":true,"status":"available","category":null}'
```

---

## 6. Verifisering

```bash
cd api-new
npm install
cp .env.example .env   # Fyll inn connection string
node server.js          # Starter på port 3001

# Test endepunkter:
curl http://localhost:3001/api/health
curl http://localhost:3001/api/navigasjon
curl http://localhost:3001/api/forside/artikkel?slug=frontpage
curl http://localhost:3001/api/forside/kontaktpersoner
curl http://localhost:3001/api/forside/hurtiglenker
curl http://localhost:3001/api/meldinger
curl http://localhost:3001/api/innlegg
curl http://localhost:3001/api/ovelse/program
curl http://localhost:3001/api/nedlasting/filer
curl http://localhost:3001/api/konserter
curl http://localhost:3001/api/billetter/ubetalte
curl http://localhost:3001/api/musikk/konserter
curl http://localhost:3001/api/medlemmer/side
curl http://localhost:3001/api/filer
curl http://localhost:3001/api/styre/medlemmer

# Test POST-endepunkter:
curl -X POST http://localhost:3001/api/auth/send-kode -H "Content-Type: application/json" -d '{"email":"test@kammerkoretutsikten.no"}'
curl -X POST http://localhost:3001/api/billettkontroll/valider -H "Content-Type: application/json" -d '{"referenceNumber":"UTK-2026-0042"}'
```

---

## 7. Mapping: env.js → nye endepunkter

For å bytte frontenden over til den nye API-en, oppdater `js/env.js`:

| Gammel variabel | Ny URL |
|----------------|--------|
| `POWER_AUTOMATE_NAVIGATION_URL` | `http://localhost:3001/api/navigasjon` |
| `POWER_AUTOMATE_ARTICLES_URL` | `http://localhost:3001/api/forside/artikkel` |
| `POWER_AUTOMATE_CONTACTS_URL` | `http://localhost:3001/api/forside/kontaktpersoner` |
| `POWER_AUTOMATE_QUICKLINKS_URL` | `http://localhost:3001/api/forside/hurtiglenker` |
| `POWER_AUTOMATE_MESSAGES_URL` | `http://localhost:3001/api/meldinger` |
| `POWER_AUTOMATE_CREATE_MESSAGE_URL` | `http://localhost:3001/api/meldinger` |
| `POWER_AUTOMATE_MESSAGE_COMMENTS_URL` | `http://localhost:3001/api/meldinger/kommentar` |
| `POWER_AUTOMATE_POSTS_URL` | `http://localhost:3001/api/innlegg` |
| `POWER_AUTOMATE_CREATE_POST_URL` | `http://localhost:3001/api/innlegg` |
| `POWER_AUTOMATE_POST_COMMENTS_URL` | `http://localhost:3001/api/innlegg/kommentar` |
| `POWER_AUTOMATE_PRACTICE_URL` | `http://localhost:3001/api/ovelse/program` |
| `POWER_AUTOMATE_PRACTICE_PAGETURNS_URL` | `http://localhost:3001/api/ovelse/sideskift` |
| `POWER_AUTOMATE_DOWNLOADS_URL` | `http://localhost:3001/api/nedlasting/filer` |
| `POWER_AUTOMATE_CONCERTS_URL` | `http://localhost:3001/api/konserter` |
| `POWER_AUTOMATE_TICKET_RESERVATIONS_URL` | `http://localhost:3001/api/konserter/billett` |
| `POWER_AUTOMATE_TICKET_ADMIN_URL` | `http://localhost:3001/api/billetter/ubetalte` |
| `POWER_AUTOMATE_TICKET_ADMIN_UPDATE_URL` | `http://localhost:3001/api/billetter/marker-betalt` |
| `POWER_AUTOMATE_TICKET_ADMIN_DELETE_URL` | `http://localhost:3001/api/billetter/slett` |
| `POWER_AUTOMATE_TICKET_VALIDATE_URL` | `http://localhost:3001/api/billettkontroll/valider` |
| `POWER_AUTOMATE_MUSIC_URL` | `http://localhost:3001/api/musikk/konserter` |
| `POWER_AUTOMATE_MEMBERS_PAGE_URL` | `http://localhost:3001/api/medlemmer/side` |
| `POWER_AUTOMATE_MEMBERS_PAGE_RSVP_URL` | `http://localhost:3001/api/medlemmer/rsvp` |
| `POWER_AUTOMATE_CREATE_EVENT_URL` | `http://localhost:3001/api/medlemmer/arrangement` |
| `POWER_AUTOMATE_FILES_URL` | `http://localhost:3001/api/filer` |
| `POWER_AUTOMATE_FILES_UPDATE_URL` | `http://localhost:3001/api/filer/oppdater` |
| `POWER_AUTOMATE_FILES_UPLOAD_URL` | `http://localhost:3001/api/filer/last-opp` |
| `POWER_AUTOMATE_BLOB_UPLOAD_URL` | `http://localhost:3001/api/blob/last-opp` |
| `POWER_AUTOMATE_BLOB_CLEAR_URL` | `http://localhost:3001/api/blob/tom` |
| `POWER_AUTOMATE_STYRE_MEMBERS_URL` | `http://localhost:3001/api/styre/medlemmer` |
| `POWER_AUTOMATE_STYRE_REGISTER_MEMBER_URL` | `http://localhost:3001/api/styre/registrer` |
| `POWER_AUTOMATE_STYRE_UPDATE_MEMBER_URL` | `http://localhost:3001/api/styre/oppdater` |
| `POWER_AUTOMATE_STYRE_DELETE_MEMBER_URL` | `http://localhost:3001/api/styre/slett` |
| `POWER_AUTOMATE_STYRE_SEND_EMAIL_URL` | `http://localhost:3001/api/styre/send-epost` |
| `POWER_AUTOMATE_PROFILE_URL` | `http://localhost:3001/api/profil/hent` |
| `POWER_AUTOMATE_PROFILE_UPDATE_URL` | `http://localhost:3001/api/profil/oppdater` |
| `POWER_AUTOMATE_AUTH_SEND_CODE_URL` | `http://localhost:3001/api/auth/send-kode` |
| `POWER_AUTOMATE_AUTH_VERIFY_CODE_URL` | `http://localhost:3001/api/auth/verifiser-kode` |

---

## 8. Migrering fra Power Automate (`migrate.js`)

Scriptet leser JSON-filer (output fra Power Automate GET-flytene) og skriver til Azure Table Storage. Ingen SharePoint-tilkobling nødvendig.

### Steg for steg

1. **Kjør hver GET-flyt** (via nettleser, Postman eller REST Client)
2. **Kopier responsen** og lagre som JSON-fil i `data/`-mappen
3. **Kjør migreringsscriptet**

### Filnavn i `data/`-mappen

Lagre output fra hver flyt med dette filnavnet:

| Power Automate-flyt (GET) | Lagre som |
|--------------------------|-----------|
| NAVIGATION_URL | `data/navigation.json` |
| MESSAGES_URL | `data/messages.json` |
| POSTS_URL | `data/posts.json` |
| QUICKLINKS_URL | `data/quicklinks.json` |
| ARTICLES_URL | `data/articles.json` |
| STYRE_MEMBERS_URL | `data/members.json` |
| CONTACTS_URL | `data/contacts.json` |
| CONCERTS_URL | `data/concerts.json` |
| TICKET_ADMIN_URL | `data/ticketreservations.json` |
| DOWNLOADS_URL | `data/downloads.json` |
| MUSIC_URL | `data/music.json` |
| PRACTICE_URL | `data/practice.json` |
| MEMBERS_PAGE_URL (events) | `data/events.json` |

> **Tips:** Responsen kan være wrappet i `{ "body": [...] }` eller `{ "data": [...] }` — scriptet håndterer dette automatisk.

### Bruk

```bash
# Se hva som ville blitt migrert (ingen skriving)
node migrate.js --dry-run

# Kjør full migrering av alle filer som finnes i data/
node migrate.js

# Migrer kun utvalgte tabeller
node migrate.js --table=navigation,members
node migrate.js --table=concerts --dry-run
```

### Hva migreres

| JSON-fil | → Table Storage | Kommentar |
|----------|----------------|-----------|
| `navigation.json` | Navigation | Håndterer `role` som objekt eller streng |
| `messages.json` | Messages | Inkl. embedded kommentarer |
| `posts.json` | Posts | Inkl. embedded kommentarer |
| `quicklinks.json` | QuickLinks | |
| `articles.json` | Articles | Bruker slug som RowKey |
| `members.json` | Members | Legger til standardverdier for varsler/preferanser |
| `contacts.json` | Contacts | |
| `concerts.json` | Concerts | |
| `ticketreservations.json` | TicketReservations | Beregner isPaid fra data |
| `downloads.json` | Downloads | |
| `music.json` | Music | Inkl. tracks og images |
| `practice.json` | Practice | Splittes: 1 meta-rad + 1 rad per note |
| `events.json` | Events | Inkl. attendees |

### Tips

- Kjør `--dry-run` først for å verifisere at alt ser riktig ut
- Scriptet er idempotent — kan kjøres flere ganger (upsert, ikke insert)
- Filer som ikke finnes i `data/` hoppes over uten feil
- Sjekk Power Automate-flytene for eventuell tilleggslogikk før migrering
- For `events.json`: hent events-arrayet fra MEMBERS_PAGE_URL-responsen (`response.events`)
