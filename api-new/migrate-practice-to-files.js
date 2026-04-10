/**
 * Engangsskript: Konverterer eksisterende Practice-data til Files-oppføringer.
 *
 * Leser noter fra Practice-tabellen og oppretter Files-rader med
 * type, stemme, verk og anledning. Setter også aktiv anledning i Practice meta.
 *
 * Bruk:
 *   node migrate-practice-to-files.js [--dry-run] [--anledning="Vårkonsert 2026"]
 */

require('dotenv').config();
const { listEntities, getEntity, upsertEntity, buildEntity, ensureTables } = require('./lib/db');
const { generateId } = require('./lib/helpers');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const anledningArg = args.find(a => a.startsWith('--anledning='));
const ANLEDNING = anledningArg ? anledningArg.split('=').slice(1).join('=') : 'Vårprogram 2026';

async function migrate() {
  console.log('=== Migrering: Practice → Files ===');
  console.log(`Anledning: ${ANLEDNING}`);
  console.log(`Modus: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  ensureTables();

  const items = await listEntities('Practice');
  const meta = items.find(i => i.partitionKey === 'program');
  const notes = items.filter(i => i.partitionKey === 'practice');

  console.log(`Fant ${notes.length} noter i Practice-tabellen`);
  console.log('');

  let created = 0;

  for (const note of notes) {
    const verk = note.noteTitle || note.id;
    const sortOrder = note.sortOrder || 999;

    // 1. Opprett noter-fil (PDF)
    if (note.pdfFilename) {
      const id = generateId('FIL');
      const data = {
        id,
        navn: note.pdfFilename,
        type: 'noter',
        stemme: '',
        verk,
        anledning: ANLEDNING,
        sortering: sortOrder,
      };

      if (DRY_RUN) {
        console.log(`  [DRY] noter: ${note.pdfFilename} (verk: ${verk}, sort: ${sortOrder})`);
      } else {
        await upsertEntity('Files', buildEntity('file', id, {
          type: 'noter', stemme: '', verk, anledning: ANLEDNING, sortering: sortOrder,
        }, data));
      }
      created++;
    }

    // 2. Opprett øvefiler (MP3 per stemme)
    const audio = note.audio || {};
    for (const [stemme, filename] of Object.entries(audio)) {
      if (!filename) continue;

      const id = generateId('FIL');
      const data = {
        id,
        navn: filename,
        type: 'øvefil',
        stemme,
        verk,
        anledning: ANLEDNING,
        sortering: sortOrder,
      };

      if (DRY_RUN) {
        console.log(`  [DRY] øvefil: ${filename} (stemme: ${stemme}, verk: ${verk})`);
      } else {
        await upsertEntity('Files', buildEntity('file', id, {
          type: 'øvefil', stemme, verk, anledning: ANLEDNING, sortering: sortOrder,
        }, data));
      }
      created++;
    }

    console.log(`  ${verk}: 1 noter + ${Object.keys(audio).length} øvefiler`);
  }

  // 3. Oppdater Practice meta med aktiv anledning
  if (!DRY_RUN) {
    const existingMeta = meta || {};
    await upsertEntity('Practice', buildEntity('program', 'meta', {}, {
      title: existingMeta.title || ANLEDNING,
      anledning: ANLEDNING,
      voice: existingMeta.voice || 'tutti',
    }));
    console.log(`\nSatt aktiv anledning til "${ANLEDNING}"`);
  }

  console.log(`\n=== Ferdig: ${created} filer opprettet ===`);
  if (DRY_RUN) console.log('Kjør uten --dry-run for å utføre.');
}

migrate().catch(err => {
  console.error('Feil:', err);
  process.exit(1);
});
