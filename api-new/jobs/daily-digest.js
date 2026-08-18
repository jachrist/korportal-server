#!/usr/bin/env node
/**
 * CLI for den daglige medlemsvarslingen.
 *
 * Normalt kjøres varslingen automatisk av den innebygde planleggeren i
 * server.js (se lib/notifications.js). Dette skriptet lar deg kjøre den
 * manuelt eller via cron — nyttig for testing, eller hvis du heller vil styre
 * kjøringen med cron enn den innebygde planleggeren. Bruker du cron, slå av
 * den innebygde planleggeren med NOTIFY_DIGEST_ENABLED=false så du ikke sender
 * dobbelt.
 *
 * Bruk:
 *   node jobs/daily-digest.js              # kjør og send
 *   node jobs/daily-digest.js --dry-run    # vis hvem som ville fått e-post, uten å sende
 *   node jobs/daily-digest.js --force      # bruk 24t-vindu, ikke flytt «siste kjøring»
 *
 * Se deploy/README.md for cron-oppsett og miljøvariabler (SMTP_*, SITE_URL,
 * NOTIFY_DIGEST_ENABLED, NOTIFY_DIGEST_HOUR).
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { runDailyDigest } = require('../lib/notifications');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');

  const r = await runDailyDigest({ dryRun, force });

  console.log(`\nMedlemsvarsling (${r.status})`);
  console.log(`  Vindu siden:  ${r.since}`);
  console.log(`  Endringer:    meldinger=${r.changes.meldinger}, innlegg=${r.changes.innlegg}, arrangementer=${r.changes.arrangementer}`);
  console.log(`  Mottakere:    ${r.recipients}`);

  if (r.preview && r.preview.length) {
    console.log(dryRun ? '  Ville sendt til:' : '  Bygget for:');
    for (const p of r.preview) {
      console.log(`    - ${p.email}${p.name ? ` (${p.name})` : ''}: ${p.sections.join(', ')}`);
    }
  }

  if (!dryRun) console.log(`  Sendt:        ${r.sent}${r.failed ? `, feilet: ${r.failed}` : ''}`);
  if (r.status === 'no-smtp') {
    console.log('  ⚠ SMTP er ikke konfigurert — ingen e-post sendt. «Siste kjøring» ble ikke flyttet.');
  }
  console.log('');

  process.exit(r.failed > 0 || r.status === 'no-smtp' ? 1 : 0);
}

main().catch(err => {
  console.error('Varsling feilet:', err);
  process.exit(1);
});
