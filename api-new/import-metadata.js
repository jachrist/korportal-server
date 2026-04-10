/**
 * Engangsskript: Importerer filmetadata til Files-tabellen.
 *
 * Oppretter Files-rader med uploaded=false (bare metadata, ingen filer).
 * Hvis filen finnes i UPLOAD_DIR, settes uploaded=true automatisk.
 * Eksisterende rader med samme filnavn oppdateres (metadata merge).
 *
 * Input:  data/arkiv-metadata.json (eller annen fil via --file=)
 * Format: Array av objekter:
 *   [
 *     { "navn": "Stein på stein.pdf", "type": "noter", "verk": "Stein på stein",
 *       "stemme": "", "anledning": "Vårkonsert 2026", "sortering": 1 },
 *     ...
 *   ]
 *
 * Bruk:
 *   node import-metadata.js [--dry-run] [--file=data/custom.json]
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { listEntities, upsertEntity, buildEntity, ensureTables } = require('./lib/db');
const { generateId } = require('./lib/helpers');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const fileArg = args.find(a => a.startsWith('--file='));
const inputFile = fileArg
  ? fileArg.split('=').slice(1).join('=')
  : path.join(__dirname, 'data', 'arkiv-metadata.json');

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const fileBaseUrl = process.env.FILE_BASE_URL || 'http://localhost:3001/uploads';

function fileSearchFields(data) {
  return {
    type: data.type || '',
    stemme: data.stemme || '',
    verk: data.verk || '',
    anledning: data.anledning || '',
    sortering: data.sortering ?? 999,
    uploaded: data.uploaded ? 1 : 0,
  };
}

async function importMetadata() {
  console.log('=== Metadata-import → Files-tabellen ===');
  console.log(`Input:  ${inputFile}`);
  console.log(`Modus:  ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  if (!fs.existsSync(inputFile)) {
    console.error(`Filen "${inputFile}" finnes ikke.`);
    console.error('');
    console.error('Forventet format (JSON-array):');
    console.error('  [');
    console.error('    { "navn": "filnavn.pdf", "type": "noter", "verk": "Verknavn",');
    console.error('      "stemme": "", "anledning": "Konsert", "sortering": 1 },');
    console.error('    ...');
    console.error('  ]');
    process.exit(1);
  }

  ensureTables();

  const raw = fs.readFileSync(inputFile, 'utf-8');
  let items = JSON.parse(raw);
  if (!Array.isArray(items)) items = [items];

  console.log(`Leste ${items.length} oppføringer fra input-fil`);

  // Get existing files for name matching
  const existing = await listEntities('Files');
  const nameMap = new Map();
  for (const item of existing) {
    if (item.navn) nameMap.set(item.navn, item);
  }

  // Check which files exist on disk
  const uploadedFiles = new Set();
  if (fs.existsSync(uploadDir)) {
    for (const entry of fs.readdirSync(uploadDir)) {
      uploadedFiles.add(entry);
    }
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    if (!item.navn) {
      console.log('  HOPPET OVER: mangler "navn"');
      skipped++;
      continue;
    }

    const fileOnDisk = uploadedFiles.has(item.navn);
    const url = fileOnDisk ? `${fileBaseUrl}/${encodeURIComponent(item.navn)}` : '';

    const existingRow = nameMap.get(item.navn);

    if (existingRow) {
      // Merge metadata into existing row
      const merged = {
        ...existingRow,
        type: item.type || existingRow.type || '',
        stemme: item.stemme || existingRow.stemme || '',
        verk: item.verk || existingRow.verk || '',
        anledning: item.anledning || existingRow.anledning || '',
        sortering: item.sortering ?? existingRow.sortering ?? 999,
        uploaded: fileOnDisk,
        url: fileOnDisk ? url : existingRow.url || '',
      };

      if (DRY_RUN) {
        console.log(`  [UPD] ${item.navn} (uploaded: ${fileOnDisk})`);
      } else {
        await upsertEntity('Files', buildEntity('file', existingRow.id,
          fileSearchFields(merged), merged));
      }
      updated++;
    } else {
      // Create new row
      const id = generateId('FIL');
      const data = {
        id,
        navn: item.navn,
        type: item.type || '',
        stemme: item.stemme || '',
        verk: item.verk || '',
        anledning: item.anledning || '',
        sortering: item.sortering ?? 999,
        uploaded: fileOnDisk,
        url,
      };

      if (DRY_RUN) {
        console.log(`  [NY]  ${item.navn} (uploaded: ${fileOnDisk})`);
      } else {
        await upsertEntity('Files', buildEntity('file', id, fileSearchFields(data), data));
      }
      created++;
    }
  }

  console.log('');
  console.log(`=== Ferdig ===`);
  console.log(`Nye: ${created} | Oppdatert: ${updated} | Hoppet over: ${skipped}`);
  if (DRY_RUN) console.log('\nKjør uten --dry-run for å utføre.');
}

importMetadata().catch(err => {
  console.error('Feil:', err);
  process.exit(1);
});
