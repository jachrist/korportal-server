const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { listEntities, getEntity, upsertEntity, buildEntity } = require('../lib/db');
const { successResponse, errorResponse, validateRequired, generateId, now } = require('../lib/helpers');

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
const fileBaseUrl = process.env.FILE_BASE_URL || 'http://localhost:3001/uploads';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// --- Kategori ↔ type mapping ---
// Frontend uses "kategori" (Norwegian labels), DB uses "type" (lowercase)
const kategoriToType = { 'Note': 'noter', 'Opptak': 'opptak', 'Øvefil': 'øvefil', 'Sideskift': 'sideskift', 'Dokument': 'dokument' };
const typeToKategori = { 'noter': 'Note', 'opptak': 'Opptak', 'øvefil': 'Øvefil', 'sideskift': 'Sideskift', 'dokument': 'Dokument' };

function toType(kategori) { return kategoriToType[kategori] || kategori || ''; }
function toKategori(type) { return typeToKategori[type] || type || ''; }

/** Build searchable fields for Files table */
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

/** Format a file entity for API response (DB → frontend) */
function formatFile(item) {
  return {
    id: item.id,
    navn: item.navn || '',
    kategori: toKategori(item.type),
    type: item.type || '',
    stemme: item.stemme || '',
    verk: item.verk || '',
    anledning: item.anledning || '',
    sortering: item.sortering ?? 999,
    url: item.url || '',
    uploaded: !!item.uploaded,
  };
}

// ==========================================================================
// GET /api/filer — List files with optional filters
// ==========================================================================
router.get('/filer', async (req, res) => {
  try {
    let items = await listEntities('Files');

    const { anledning, type, verk, uploaded } = req.query;
    if (anledning) items = items.filter(i => i.anledning === anledning);
    if (type) items = items.filter(i => i.type === type);
    if (verk) items = items.filter(i => i.verk === verk);
    if (uploaded !== undefined) items = items.filter(i => !!i.uploaded === (uploaded === 'true'));

    const filer = items.map(formatFile);
    filer.sort((a, b) => (a.sortering ?? 999) - (b.sortering ?? 999));
    return res.json({ filer });
  } catch (err) {
    console.error('filer error:', err);
    return errorResponse(res, 'Kunne ikke hente filer.', 500);
  }
});

// ==========================================================================
// POST /api/filer/oppdater — Update metadata for one or more files
// ==========================================================================
router.post('/filer/oppdater', async (req, res) => {
  try {
    const { id, fileIds, kategori, type, stemme, verk, sortering, anledning } = req.body;
    const ids = fileIds || (id ? [id] : []);

    if (ids.length === 0) {
      return errorResponse(res, 'Ingen fil-IDer angitt.');
    }

    const updates = {};
    if (kategori !== undefined) updates.type = toType(kategori);
    if (type !== undefined) updates.type = type;
    if (stemme !== undefined) updates.stemme = stemme;
    if (verk !== undefined) updates.verk = verk;
    if (sortering !== undefined) updates.sortering = sortering;
    if (anledning !== undefined) updates.anledning = anledning;

    for (const fileId of ids) {
      const entity = await getEntity('Files', 'file', fileId);
      if (entity) {
        const updated = { ...entity, ...updates };
        await upsertEntity('Files', buildEntity('file', fileId,
          fileSearchFields(updated), updated));
      }
    }

    return successResponse(res, { message: `${ids.length} fil(er) oppdatert.` });
  } catch (err) {
    console.error('filer oppdater error:', err);
    return errorResponse(res, 'Kunne ikke oppdatere filer.', 500);
  }
});

// ==========================================================================
// POST /api/filer/ny — Create metadata row without file
// ==========================================================================
router.post('/filer/ny', async (req, res) => {
  try {
    const { navn } = req.body;
    if (!navn) return errorResponse(res, 'Filnavn (navn) er påkrevd.');

    const id = generateId('FIL');
    const data = {
      id,
      navn,
      type: toType(req.body.kategori) || req.body.type || '',
      stemme: req.body.stemme || '',
      verk: req.body.verk || '',
      anledning: req.body.anledning || '',
      sortering: req.body.sortering ?? 999,
      uploaded: false,
      url: '',
      createdAt: now(),
    };

    await upsertEntity('Files', buildEntity('file', id, fileSearchFields(data), data));
    return successResponse(res, { id, message: 'Metadata opprettet.' });
  } catch (err) {
    console.error('filer ny error:', err);
    return errorResponse(res, 'Kunne ikke opprette metadata.', 500);
  }
});

// ==========================================================================
// POST /api/filer/last-opp-til-server — Upload files and link to metadata
// ==========================================================================
router.post('/filer/last-opp-til-server', async (req, res) => {
  try {
    const { filer } = req.body;
    if (!filer || !Array.isArray(filer) || filer.length === 0) {
      return errorResponse(res, 'Ingen filer å laste opp.');
    }

    // Get existing files for name matching
    const existingItems = await listEntities('Files');
    const nameMap = new Map();
    for (const item of existingItems) {
      if (item.navn) nameMap.set(item.navn, item);
    }

    let uploadedCount = 0;
    const results = [];

    for (const fil of filer) {
      if (!fil.navn || !fil.innhold) continue;

      // Save file to disk
      const buffer = Buffer.from(fil.innhold, 'base64');
      const filePath = path.join(uploadDir, fil.navn);
      fs.writeFileSync(filePath, buffer);

      const fileUrl = `${fileBaseUrl}/${encodeURIComponent(fil.navn)}`;

      const existing = nameMap.get(fil.navn);
      if (existing) {
        // Match found — update existing row
        const updated = { ...existing, uploaded: true, url: fileUrl };
        await upsertEntity('Files', buildEntity('file', existing.id,
          fileSearchFields(updated), updated));
        results.push({ id: existing.id, navn: fil.navn, matched: true });
      } else {
        // No match — create new row with empty metadata
        const id = generateId('FIL');
        const ext = path.extname(fil.navn).toLowerCase();
        const type = ['.mp3', '.wav', '.ogg'].includes(ext) ? 'øvefil'
          : ['.pdf'].includes(ext) ? 'noter' : '';

        const data = {
          id, navn: fil.navn, url: fileUrl,
          type, stemme: '', verk: '', anledning: '', sortering: 999,
          uploaded: true, uploadedAt: now(),
        };
        await upsertEntity('Files', buildEntity('file', id, fileSearchFields(data), data));
        results.push({ id, navn: fil.navn, matched: false });
      }

      uploadedCount++;
    }

    return successResponse(res, { uploadedCount, results });
  } catch (err) {
    console.error('filer last-opp-til-server error:', err);
    return errorResponse(res, 'Kunne ikke laste opp filer.', 500);
  }
});

// ==========================================================================
// POST /api/filer/fjern-fra-server — Remove file but keep metadata
// ==========================================================================
router.post('/filer/fjern-fra-server', async (req, res) => {
  try {
    const { id, fileIds } = req.body;
    const ids = fileIds || (id ? [id] : []);

    if (ids.length === 0) {
      return errorResponse(res, 'Ingen fil-IDer angitt.');
    }

    let removedCount = 0;
    for (const fileId of ids) {
      const entity = await getEntity('Files', 'file', fileId);
      if (!entity) continue;

      // Delete physical file
      if (entity.navn) {
        const filePath = path.join(uploadDir, entity.navn);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Mark as not uploaded (keep metadata)
      const updated = { ...entity, uploaded: false, url: '' };
      await upsertEntity('Files', buildEntity('file', fileId,
        fileSearchFields(updated), updated));
      removedCount++;
    }

    return successResponse(res, { removedCount, message: `${removedCount} fil(er) fjernet fra server.` });
  } catch (err) {
    console.error('filer fjern-fra-server error:', err);
    return errorResponse(res, 'Kunne ikke fjerne filer.', 500);
  }
});

// ==========================================================================
// GET /api/filer/synk — Scan upload dir and create entries for new files
// ==========================================================================
router.get('/filer/synk', async (req, res) => {
  try {
    const existingItems = await listEntities('Files');
    const existingNames = new Set(existingItems.map(item => item.navn));

    const entries = fs.readdirSync(uploadDir);
    let synced = 0;
    let skipped = 0;

    for (const entry of entries) {
      const fullPath = path.join(uploadDir, entry);
      if (!fs.statSync(fullPath).isFile()) continue;

      if (existingNames.has(entry)) {
        // File exists in DB — make sure it's marked as uploaded
        const existing = existingItems.find(i => i.navn === entry);
        if (existing && !existing.uploaded) {
          const updated = { ...existing, uploaded: true, url: `${fileBaseUrl}/${encodeURIComponent(entry)}` };
          await upsertEntity('Files', buildEntity('file', existing.id,
            fileSearchFields(updated), updated));
          synced++;
        } else {
          skipped++;
        }
        continue;
      }

      const id = generateId('FIL');
      const fileUrl = `${fileBaseUrl}/${encodeURIComponent(entry)}`;
      const ext = path.extname(entry).toLowerCase();
      const type = ['.mp3', '.wav', '.ogg'].includes(ext) ? 'øvefil'
        : ['.pdf'].includes(ext) ? 'noter' : '';

      const data = {
        id, navn: entry, url: fileUrl, type,
        stemme: '', verk: '', anledning: '', sortering: 999,
        uploaded: true, syncedAt: now(),
      };

      await upsertEntity('Files', buildEntity('file', id, fileSearchFields(data), data));
      synced++;
    }

    return successResponse(res, { synced, skipped });
  } catch (err) {
    console.error('filer synk error:', err);
    return errorResponse(res, 'Kunne ikke synkronisere filer.', 500);
  }
});

// ==========================================================================
// GET /api/filer/anledninger — List unique anledninger from noter/øvefil
// ==========================================================================
router.get('/filer/anledninger', async (req, res) => {
  try {
    const items = await listEntities('Files');
    const anledninger = new Set();
    for (const item of items) {
      const t = (item.type || '').toLowerCase();
      if (item.anledning && (t === 'noter' || t === 'øvefil' || t === 'note')) {
        anledninger.add(item.anledning);
      }
    }
    const sorted = [...anledninger].sort((a, b) => a.localeCompare(b, 'no'));
    return res.json({ anledninger: sorted });
  } catch (err) {
    console.error('filer anledninger error:', err);
    return errorResponse(res, 'Kunne ikke hente anledninger.', 500);
  }
});

// ==========================================================================
// POST /api/filer/importer-metadata — Fetch metadata from external URL
// ==========================================================================
// Accepts a URL (e.g. Power Automate flow) that returns a JSON array of file
// metadata. Each item should have at least "navn". Optional fields:
// type/kategori, stemme, verk, anledning, sortering.
//
// Existing rows with matching "navn" get their metadata updated (merged).
// New rows are created with uploaded=false.
router.post('/filer/importer-metadata', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return errorResponse(res, 'URL er påkrevd.');

    // Fetch metadata from external source
    const response = await fetch(url);
    if (!response.ok) {
      return errorResponse(res, `Kunne ikke hente data fra URL: HTTP ${response.status}`, 502);
    }

    let items = await response.json();

    // Unwrap common envelopes
    if (items.body) items = items.body;
    if (items.data) items = items.data;
    if (items.value) items = items.value;
    if (items.filer) items = items.filer;
    if (!Array.isArray(items)) items = [items];

    // Get existing files for name matching
    const existing = await listEntities('Files');
    const nameMap = new Map();
    for (const item of existing) {
      if (item.navn) nameMap.set(item.navn, item);
    }

    // Check which files are on disk
    const onDisk = new Set(fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : []);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of items) {
      if (!item.navn) { skipped++; continue; }

      const fileOnDisk = onDisk.has(item.navn);
      const url = fileOnDisk ? `${fileBaseUrl}/${encodeURIComponent(item.navn)}` : '';
      const type = toType(item.kategori) || item.type || '';

      const existingRow = nameMap.get(item.navn);

      if (existingRow) {
        const merged = {
          ...existingRow,
          type: type || existingRow.type || '',
          stemme: item.stemme ?? existingRow.stemme ?? '',
          verk: item.verk ?? existingRow.verk ?? '',
          anledning: item.anledning ?? existingRow.anledning ?? '',
          sortering: item.sortering ?? existingRow.sortering ?? 999,
          uploaded: fileOnDisk,
          url: fileOnDisk ? url : existingRow.url || '',
        };
        await upsertEntity('Files', buildEntity('file', existingRow.id,
          fileSearchFields(merged), merged));
        updated++;
      } else {
        const id = generateId('FIL');
        const data = {
          id, navn: item.navn, type, url,
          stemme: item.stemme || '', verk: item.verk || '',
          anledning: item.anledning || '', sortering: item.sortering ?? 999,
          uploaded: fileOnDisk,
        };
        await upsertEntity('Files', buildEntity('file', id, fileSearchFields(data), data));
        nameMap.set(item.navn, data); // avoid duplicates within same import
        created++;
      }
    }

    return successResponse(res, {
      created, updated, skipped,
      total: items.length,
      message: `${created} nye, ${updated} oppdatert, ${skipped} hoppet over.`,
    });
  } catch (err) {
    console.error('filer importer-metadata error:', err);
    return errorResponse(res, 'Kunne ikke importere metadata.', 500);
  }
});

module.exports = router;
