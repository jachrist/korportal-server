# Styrerom — dokumentarkiv, oppgaver og styremøter

Verktøy for styret til å organisere og følge opp **styremøter**, **arrangementer**,
**dokumenter** og **oppgaver**. Bygger på det som allerede finnes i Korportalen
(Files-tabell, Markdown-editor, varslingsplanlegger, rollestyring).

Tilgang: **styre + admin** (`initPage({ requiredRole: 'styre' })`). Rollehierarkiet
gjør at admin også slipper inn, gjest/anonym holdes ute.

## Samlende idé: alt henger på en *anledning*

En «anledning» er enten et **styremøte** eller et **arrangement**. Både dokumenter
og oppgaver merkes med anledning, så styret får «alt om dette møtet/arrangementet
på ett sted». Dette gjenbruker `anledning`-feltet som allerede tråder gjennom
Files/Practice/Events.

## 1. Dokumentarkiv

Gjenbruker **`Files`-tabellen** med `type: 'styredokument'` og egen tolkning av
metadataene. Musikk-fillogikken (`/api/filer/*`) røres ikke — styre-dokumenter får
en egen rute (`/api/styre/dokumenter`) som leser/skriver hele dokumentobjektet.

Dokumentfelt (i `jsonData`): `tittel`, `dokumenttype` (referat, protokoll, budsjett,
søknad, avtale, annet), `anledning` (møte/arrangement), `dato`, `forfatter`,
`status` (utkast/ferdig), `format` (`markdown` | `pdf` | `office`), `contentMd`
(for Markdown-dokumenter), `url` (for opplastede filer).

**To slags dokumenter:**

- **Levende dokumenter (Markdown):** skrives og redigeres i portalen med den
  eksisterende `MarkdownEditor`. Lagres som tekst (`contentMd`). Enkelt å søke,
  vise (rendret via `parse-markdown.js`), redigere og lagre.
- **Opplastede filer (Word/Office/PDF):** lastes opp og **tagges**, lastes ned og
  **vises**, men **behandles ikke** i portalen (redigeres i Word og lastes opp på
  nytt). PDF vises inline via `pdf.js`.

**PDF-generering:** «Generer PDF» rendrer et Markdown-dokument til stilsatt HTML og
lager en PDF **i nettleseren**, som deretter **arkiveres som et vanlig dokument**
(`format: 'pdf'`) — søkbart, taggbart og visbart på lik linje med resten. Bruker
et lite klient-bibliotek (`js/vendor/html2pdf.bundle.min.js`); uten det faller
knappen tilbake til nettleserens «Skriv ut → PDF».

**Søk/visning:** samme mønster som Filbehandling — søkefelt (tittel/type/møte/dato)
og filtre, liste, klikk for visning/redigering.

## 2. Oppgavelister

Ny **`Tasks`-tabell** (samme hybrid-modell): `anledning`, `tittel`, `beskrivelse`,
`frist`, `ansvarlig` (medlem), `status` (åpen/pågår/ferdig), `createdAt`,
`updatedAt`, `completedAt`.

- **Visninger:** Mine oppgaver, Forfalne, Neste 7 dager, og oppgaver per anledning.
  Merk som ferdig med ett trykk.
- **Oppfølging & varsling:** gjenbruker den daglige planleggeren i
  `lib/notifications.js`:
  - e-post til **ansvarlig** når en oppgave tildeles,
  - **frist-påminnelse** noen dager før frist og ved forfall,
  - kan legges som egen seksjon i digesten (samme `renderMemberDigest`-mønster,
    med `.ics` for frister).

## 3. Styremøte som variant av arrangement

Et **styremøte** er et **arrangement** (Events) med et `synlighet: 'styre'`-flagg.
Da kan møtet legges i kalenderen (samme `.ics`-mekanikk som andre arrangementer),
men det **filtreres bort fra den medlemsvendte** arrangementslista (`/api/medlemmer/side`)
og vises kun i Styrerommet (styre + admin). Slik knyttes agenda/referat (dokumenter)
og saker (oppgaver) til selve møtet via anledning.

## Roller og navigasjon

- Nytt menypunkt **«Styrerom»** i Navigation-tabellen med `minRole: 'styre'`.
- Egne sider: `styredokumenter.html`, `oppgaver.html` (og evt. en Styrerom-forside
  med anledning-oversikt). `styre.html` beholdes som medlems-administrasjon.

## Faser

1. ✅ **Dokumentarkiv** — Markdown-redigering + visning + søk, opplasting/nedlasting
   av Office/PDF, PDF-generering i nettleser med arkivering.
2. ✅ **Oppgaver** — CRUD + lister (Alle/Mine/Forfalne/Neste 7 dager) + status.
3. ✅ **Varsling/oppfølging** — tildeling-varsel (ved oppretting/tildeling) og
   frist-påminnelser via den daglige planleggeren (`runTaskReminders()` i
   `lib/notifications.js`): 3 dager før, på fristdagen og ved forfall, sporet med
   `remind`-flagg per oppgave så det ikke gjentas daglig. Batches per ansvarlig,
   med `.ics`-vedlegg for fristene. Manuell test: `POST /api/admin/send-oppgavevarsler`
   (`?dry-run=true`).
4. ⏳ **Styremøte-variant** — `synlighet: 'styre'` på arrangementer + kobling
   agenda/referat/oppgaver per møte.

## Beslutninger (avklart med styret)

- Office-filer: lastes opp, tagges, lastes ned og vises — men behandles ikke.
- PDF: genereres i nettleser og behandles som et vanlig dokument.
- Struktur: `Tasks`-tabell + `type: 'styredokument'` på `Files`.
- Styremøte = variant av arrangement (kalender-bart), synlig kun for styre + admin.
