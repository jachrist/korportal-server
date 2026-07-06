/**
 * Daglig medlemsvarsling.
 *
 * Én gang i døgnet sjekkes det om det finnes nye eller oppdaterte meldinger,
 * innlegg eller arrangementer siden forrige kjøring. Hvert medlem som har
 * slått på varsling for den aktuelle typen (`varsler` i medlemsraden) får en
 * oppsummerings-e-post. Tidspunktet for siste kjøring lagres i tabellen
 * `NotificationState`, slik at vinduet «siden sist» er robust mot omstart.
 */

const { listEntities, getEntity, upsertEntity, buildEntity } = require('./db');
const { now } = require('./helpers');
const { createTransporter, renderMemberDigest } = require('./mailer');

const STATE_TABLE = 'NotificationState';
const STATE_KEY = 'digest';
const DEFAULT_WINDOW_HOURS = 24;

// Kobling mellom varsel-flagg, tabell og opprettelses-tidsstempel.
const SOURCES = [
  { key: 'meldinger',     label: 'Meldinger',     singular: 'melding',     table: 'Messages', createdField: 'publishedAt' },
  { key: 'innlegg',       label: 'Innlegg',       singular: 'innlegg',     table: 'Posts',    createdField: 'createdAt' },
  { key: 'arrangementer', label: 'Arrangementer', singular: 'arrangement', table: 'Events',   createdField: 'createdAt' },
];

function toTime(v) {
  const t = Date.parse(v);
  return Number.isNaN(t) ? 0 : t;
}

async function getLastRunAt() {
  const row = await getEntity(STATE_TABLE, 'state', STATE_KEY);
  return row?.lastRunAt || null;
}

async function setLastRunAt(iso) {
  await upsertEntity(STATE_TABLE, buildEntity('state', STATE_KEY, {}, { id: STATE_KEY, lastRunAt: iso }));
}

/**
 * Finn nye/oppdaterte elementer per type siden `sinceIso`.
 * @returns {Promise<Object>} { meldinger: [...], innlegg: [...], arrangementer: [...] }
 *   der hvert element er { id, title, isNew, changedAt }.
 */
async function collectChanges(sinceIso) {
  const sinceT = toTime(sinceIso);
  const result = {};

  for (const src of SOURCES) {
    const items = await listEntities(src.table);
    result[src.key] = items
      .map(it => {
        const createdT = toTime(it[src.createdField]);
        const changedT = Math.max(createdT, toTime(it.updatedAt));
        return {
          id: it.id,
          title: it.title || '(uten tittel)',
          isNew: createdT > sinceT,
          changedT,
        };
      })
      .filter(x => x.changedT > sinceT)
      .sort((a, b) => b.changedT - a.changedT)
      .map(x => ({ id: x.id, title: x.title, isNew: x.isNew, changedAt: new Date(x.changedT).toISOString() }));
  }

  return result;
}

/**
 * Kjør daglig oppsummering.
 * @param {object} [opts]
 * @param {boolean} [opts.force]  - ignorer lagret «siste kjøring» (bruk 24t-vindu)
 *                                  og ikke oppdater tidsstempelet. For testing.
 * @param {number}  [opts.windowHours]
 * @returns {Promise<object>} oppsummering av kjøringen
 */
async function runDailyDigest({ force = false, windowHours = DEFAULT_WINDOW_HOURS } = {}) {
  const runAt = now();
  const fallback = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();
  const sinceIso = force ? fallback : (await getLastRunAt()) || fallback;

  const changes = await collectChanges(sinceIso);
  const totalChanges = SOURCES.reduce((n, s) => n + changes[s.key].length, 0);

  const summary = {
    runAt,
    since: sinceIso,
    forced: force,
    changes: Object.fromEntries(SOURCES.map(s => [s.key, changes[s.key].length])),
    recipients: 0,
    sent: 0,
    failed: 0,
    status: 'ok',
  };

  if (totalChanges === 0) {
    if (!force) await setLastRunAt(runAt);
    summary.status = 'no-changes';
    return summary;
  }

  const transporter = createTransporter();
  if (!transporter) {
    // SMTP ikke satt opp — ikke flytt tidsstempelet, så endringene fanges opp neste gang.
    summary.status = 'no-smtp';
    return summary;
  }

  const members = await listEntities('Members');

  for (const member of members) {
    const email = (member.email || member.epost || '').trim();
    if (!email) continue;

    const varsler = member.varsler || { innlegg: true, arrangementer: true, meldinger: true };
    const sections = SOURCES
      .filter(s => varsler[s.key] !== false && changes[s.key].length > 0)
      .map(s => ({ label: s.label, singular: s.singular, items: changes[s.key] }));

    if (sections.length === 0) continue;

    summary.recipients++;
    try {
      await transporter.sendMail(renderMemberDigest({ member, sections }));
      summary.sent++;
    } catch (err) {
      summary.failed++;
      console.error(`Varsling: kunne ikke sende til ${email}:`, err.message);
    }
  }

  if (!force) await setLastRunAt(runAt);
  return summary;
}

/**
 * Start en enkel intern planlegger som kjører oppsummeringen én gang i døgnet,
 * ved/etter `NOTIFY_DIGEST_HOUR` (server-lokal tid, default 08). Ticker hver
 * time og bruker lagret «siste kjøring» for å unngå dobbeltsending ved omstart.
 * Settes `NOTIFY_DIGEST_ENABLED=false` er planleggeren av.
 */
function startDailyScheduler() {
  if (process.env.NOTIFY_DIGEST_ENABLED === 'false') {
    console.log('Daglig medlemsvarsling er deaktivert (NOTIFY_DIGEST_ENABLED=false).');
    return;
  }

  const parsedHour = parseInt(process.env.NOTIFY_DIGEST_HOUR, 10);
  const targetHour = Number.isFinite(parsedHour) ? Math.min(Math.max(parsedHour, 0), 23) : 8;

  const tick = async () => {
    try {
      const nowDate = new Date();
      if (nowDate.getHours() < targetHour) return;

      const last = await getLastRunAt();
      if (last) {
        const lastDate = new Date(last);
        const sameDay =
          lastDate.getFullYear() === nowDate.getFullYear() &&
          lastDate.getMonth() === nowDate.getMonth() &&
          lastDate.getDate() === nowDate.getDate();
        if (sameDay) return;
      }

      console.log('Kjører daglig medlemsvarsling...');
      const result = await runDailyDigest();
      console.log('Medlemsvarsling ferdig:', JSON.stringify(result));
    } catch (err) {
      console.error('Medlemsvarsling feilet:', err.message);
    }
  };

  // Første forsøk kort tid etter oppstart, deretter hver time.
  setTimeout(tick, 15000).unref?.();
  setInterval(tick, 60 * 60 * 1000).unref?.();
  console.log(`Daglig medlemsvarsling aktiv (kjører fra kl. ${String(targetHour).padStart(2, '0')}:00 server-tid).`);
}

module.exports = { runDailyDigest, collectChanges, getLastRunAt, setLastRunAt, startDailyScheduler };
