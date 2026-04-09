/**
 * Miljøvariabler for Korportal — Node/Express API
 *
 * Erstatter Power Automate-URLer med lokale API-endepunkter.
 * Kopier denne filen til js/env.js for å bytte til den nye API-en.
 */
window.ENV = {
    // Navigasjon - henter menystruktur med rollebasert tilgang
    POWER_AUTOMATE_NAVIGATION_URL: 'http://localhost:3001/api/navigasjon',

    // Kunngjøringer (ikke i bruk)
    POWER_AUTOMATE_ANNOUNCEMENTS_URL: '',

    // Hurtiglenker - henter snarveier til viktige ressurser
    POWER_AUTOMATE_QUICKLINKS_URL: 'http://localhost:3001/api/forside/hurtiglenker',

    // Konserter - henter kommende konserter
    POWER_AUTOMATE_CONCERTS_URL: 'http://localhost:3001/api/konserter',

    // Billettreservasjoner - mottar billettbestillinger (POST)
    POWER_AUTOMATE_TICKET_RESERVATIONS_URL: 'http://localhost:3001/api/konserter/billett',

    // Øvelsesdata - henter noter og lydfiler for korøving
    POWER_AUTOMATE_PRACTICE_URL: 'http://localhost:3001/api/ovelse/program',

    // Artikler - henter artikkelinnhold
    POWER_AUTOMATE_ARTICLES_URL: 'http://localhost:3001/api/forside/artikkel',

    // Kontaktpersoner - henter kontaktinformasjon
    POWER_AUTOMATE_CONTACTS_URL: 'http://localhost:3001/api/forside/kontaktpersoner',

    // Meldinger fra styret
    POWER_AUTOMATE_MESSAGES_URL: 'http://localhost:3001/api/meldinger',

    // Meldinger kommentarer (POST)
    POWER_AUTOMATE_MESSAGE_COMMENTS_URL: 'http://localhost:3001/api/meldinger/kommentar',

    // Innlegg fra medlemmer
    POWER_AUTOMATE_POSTS_URL: 'http://localhost:3001/api/innlegg',

    // Opprett nytt innlegg (POST)
    POWER_AUTOMATE_CREATE_POST_URL: 'http://localhost:3001/api/innlegg',

    // Innlegg kommentarer (POST)
    POWER_AUTOMATE_POST_COMMENTS_URL: 'http://localhost:3001/api/innlegg/kommentar',

    // Nedlasting - henter nedlastbare filer
    POWER_AUTOMATE_DOWNLOADS_URL: 'http://localhost:3001/api/nedlasting/filer',

    // Musikk - henter innspilte konserter
    POWER_AUTOMATE_MUSIC_URL: 'http://localhost:3001/api/musikk/konserter',

    // Billettadministrasjon - henter ubetalte reservasjoner (GET)
    POWER_AUTOMATE_TICKET_ADMIN_URL: 'http://localhost:3001/api/billetter/ubetalte',

    // Billettadministrasjon - markerer reservasjoner som betalt (POST)
    POWER_AUTOMATE_TICKET_ADMIN_UPDATE_URL: 'http://localhost:3001/api/billetter/marker-betalt',

    // Billettadministrasjon - sletter ubetalte reservasjoner (POST)
    POWER_AUTOMATE_TICKET_ADMIN_DELETE_URL: 'http://localhost:3001/api/billetter/slett',

    // Min profil - henter medlemsprofil (POST, med { epost } i body)
    POWER_AUTOMATE_PROFILE_URL: 'http://localhost:3001/api/profil/hent',

    // Min profil - oppdaterer medlemsprofil (POST)
    POWER_AUTOMATE_PROFILE_UPDATE_URL: 'http://localhost:3001/api/profil/oppdater',

    // Medlemsside - henter artikkel og arrangementer
    POWER_AUTOMATE_MEMBERS_PAGE_URL: 'http://localhost:3001/api/medlemmer/side',

    // Medlemsside - RSVP for arrangementer (POST)
    POWER_AUTOMATE_MEMBERS_PAGE_RSVP_URL: 'http://localhost:3001/api/medlemmer/rsvp',

    // Autentisering - sender engangskode (POST)
    POWER_AUTOMATE_AUTH_SEND_CODE_URL: 'http://localhost:3001/api/auth/send-kode',

    // Autentisering - verifiserer engangskode (POST)
    POWER_AUTOMATE_AUTH_VERIFY_CODE_URL: 'http://localhost:3001/api/auth/verifiser-kode',

    // Filbehandling - henter alle filer med metadata (GET)
    POWER_AUTOMATE_FILES_URL: 'http://localhost:3001/api/filer',

    // Filbehandling - oppdaterer metadata for merkede filer (POST)
    POWER_AUTOMATE_FILES_UPDATE_URL: 'http://localhost:3001/api/filer/oppdater',

    // Blob-storage - tømmer all blob-storage (POST)
    POWER_AUTOMATE_BLOB_CLEAR_URL: 'http://localhost:3001/api/blob/tom',

    // Blob-storage - laster opp markerte filer til Azure Blob (POST)
    POWER_AUTOMATE_BLOB_UPLOAD_URL: 'http://localhost:3001/api/blob/last-opp',

    // Billettkontroll - validerer billettreferanse og registrerer innsjekk (POST)
    POWER_AUTOMATE_TICKET_VALIDATE_URL: 'http://localhost:3001/api/billettkontroll/valider',

    // Øvelse - lagrer sideskifttidspunkter for autoblading (POST)
    POWER_AUTOMATE_PRACTICE_PAGETURNS_URL: 'http://localhost:3001/api/ovelse/sideskift',

    // Meldinger - lagrer ny melding (POST)
    POWER_AUTOMATE_CREATE_MESSAGE_URL: 'http://localhost:3001/api/meldinger',

    // Arrangementer - lagrer nytt
    POWER_AUTOMATE_CREATE_EVENT_URL: 'http://localhost:3001/api/medlemmer/arrangement',

    // Filopplasting - laster opp nye filer som base64 (POST)
    POWER_AUTOMATE_FILES_UPLOAD_URL: 'http://localhost:3001/api/filer/last-opp',

    // Styresider - henter alle medlemmer (GET)
    POWER_AUTOMATE_STYRE_MEMBERS_URL: 'http://localhost:3001/api/styre/medlemmer',

    // Styresider - registrerer nytt medlem (POST)
    POWER_AUTOMATE_STYRE_REGISTER_MEMBER_URL: 'http://localhost:3001/api/styre/registrer',

    // Styresider - oppdaterer eksisterende medlem (POST)
    POWER_AUTOMATE_STYRE_UPDATE_MEMBER_URL: 'http://localhost:3001/api/styre/oppdater',

    // Styresider - sletter medlem (POST)
    POWER_AUTOMATE_STYRE_DELETE_MEMBER_URL: 'http://localhost:3001/api/styre/slett',

    // Styresider - sender e-post til medlemmer (POST)
    POWER_AUTOMATE_STYRE_SEND_EMAIL_URL: 'http://localhost:3001/api/styre/send-epost',

};
