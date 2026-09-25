/**
 * Innloggingslogg — lagrer hendelser fra routes/auth.js i AuthLog-tabellen
 * (vises på admin-siden) og skriver samme linje til konsollen (journalctl).
 * Selve engangskoden eller gjestepassordet lagres aldri.
 */
const { db, upsertEntity, buildEntity } = require('./db');
const { generateId, now } = require('./helpers');

const RETENTION_DAYS = 60;

// Hendelsestyper og nivå (info/warn/error) — brukes også av admin-siden
const EVENT_LEVELS = {
  'kode-sendt': 'info',
  'ukjent-adresse': 'warn',
  'sendefeil': 'error',
  'smtp-mangler': 'error',
  'feil-kode': 'warn',
  'utlopt-kode': 'warn',
  'innlogget': 'info',
  'medlem-mangler': 'warn',
  'gjest-innlogget': 'info',
  'gjest-avvist': 'warn',
};

let lastPrune = 0;

function pruneOldEntries() {
  // Maks én gang i timen
  if (Date.now() - lastPrune < 60 * 60 * 1000) return;
  lastPrune = Date.now();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('DELETE FROM "AuthLog" WHERE createdAt < ?').run(cutoff);
}

/**
 * Logg en innloggingshendelse.
 * @param {string} type - nøkkel i EVENT_LEVELS
 * @param {string} email - e-postadressen hendelsen gjelder ('' for gjest)
 * @param {string} message - lesbar beskrivelse
 * @param {object} [details] - ekstra felt (messageId, smtpResponse, errorCode, ...)
 */
async function logAuthEvent(type, email, message, details = {}) {
  const level = EVENT_LEVELS[type] || 'info';
  const line = `auth: [${type}] ${email ? email + ': ' : ''}${message}`;
  details = Object.fromEntries(Object.entries(details).filter(([, v]) => v !== undefined && v !== null));
  const extra = Object.entries(details).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ');
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(extra ? `${line} ${extra}` : line);

  try {
    const createdAt = now();
    const safeEmail = String(email || '').slice(0, 200);
    await upsertEntity('AuthLog', buildEntity('authlog', generateId(), {
      createdAt, type, email: safeEmail,
    }, {
      createdAt, type, level, email: safeEmail, message, ...details,
    }));
    pruneOldEntries();
  } catch (err) {
    // Logging skal aldri stoppe innloggingen
    console.error('auth-log: kunne ikke lagre hendelse:', err.message);
  }
}

module.exports = { logAuthEvent, EVENT_LEVELS, RETENTION_DAYS };
