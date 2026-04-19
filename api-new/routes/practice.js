const express = require('express');
const router = express.Router();
const { listEntities, getEntity, upsertEntity, buildEntity } = require('../lib/db');
const { successResponse, errorResponse, validateRequired } = require('../lib/helpers');

const fileBaseUrl = process.env.FILE_BASE_URL || 'http://localhost:3001/uploads';

/**
 * GET /api/ovelse/program
 *
 * Builds the practice program dynamically from the Files table:
 * 1. Reads active anledning from Practice meta
 * 2. Fetches all Files matching that anledning
 * 3. Groups by verk, separating noter (PDF) and øvefiler (MP3) per stemme
 *
 * Response: {
 *   title, voice, baseUrls: { pdf, audio },
 *   notes: [ { id, noteTitle, pdfFilename, audio: { stemme: filename }, pageTurns, sortOrder } ]
 * }
 */
router.get('/program', async (req, res) => {
  try {
    // 1. Get practice meta (active anledning, title, etc.)
    const practiceItems = await listEntities('Practice');
    const meta = practiceItems.find(i => i.partitionKey === 'program') || {};
    // Allow overriding anledning via query parameter
    const anledning = req.query.anledning || meta.anledning || '';

    if (!anledning) {
      return res.json({ title: meta.title || '', voice: meta.voice || 'tutti', baseUrls: { pdf: '', audio: '' }, notes: [] });
    }

    // 2. Get all files for this anledning
    const allFiles = await listEntities('Files');
    const files = allFiles.filter(f => f.anledning === anledning && f.uploaded);

    // 3. Group by verk
    const verkMap = new Map();
    for (const file of files) {
      if (!file.verk) continue;
      if (!verkMap.has(file.verk)) {
        verkMap.set(file.verk, { noter: null, øvefiler: [], sortering: file.sortering || 999 });
      }
      const group = verkMap.get(file.verk);

      const t = (file.type || '').toLowerCase();
      if (t === 'noter' || t === 'note') {
        group.noter = file;
        if (file.sortering !== undefined) group.sortering = file.sortering;
      } else if (t === 'øvefil') {
        group.øvefiler.push(file);
      }
    }

    // 4. Also get pageTurns from Practice table (keyed by verk name)
    const pageTurnsMap = new Map();
    for (const item of practiceItems) {
      if (item.partitionKey === 'practice' && item.pageTurns) {
        pageTurnsMap.set(item.id, item.pageTurns);
      }
    }

    // 5. Build notes array in the format the frontend expects
    // If only a single voice exists (e.g. "tenor"), fill both "tenor 1" and "tenor 2"
    const VOICE_PAIRS = [
      ['sopran', 'sopran 1', 'sopran 2'],
      ['alt', 'alt 1', 'alt 2'],
      ['tenor', 'tenor 1', 'tenor 2'],
      ['bass', 'bass 1', 'bass 2'],
    ];

    const notes = [];
    for (const [verk, group] of verkMap) {
      const audio = {};
      for (const øvefil of group.øvefiler) {
        if (øvefil.stemme) {
          audio[øvefil.stemme] = øvefil.navn;
        }
      }

      // Expand single voices to both numbered parts
      for (const [single, part1, part2] of VOICE_PAIRS) {
        if (audio[single] && !audio[part1] && !audio[part2]) {
          audio[part1] = audio[single];
          audio[part2] = audio[single];
        }
      }

      notes.push({
        id: verk,
        noteTitle: verk,
        pdfFilename: group.noter ? group.noter.navn : '',
        audio,
        pageTurns: pageTurnsMap.get(verk) || [],
        sortOrder: group.sortering,
      });
    }

    notes.sort((a, b) => a.sortOrder - b.sortOrder);

    const baseUrl = fileBaseUrl.endsWith('/') ? fileBaseUrl : fileBaseUrl + '/';

    return res.json({
      title: meta.title || '',
      voice: meta.voice || 'tutti',
      baseUrls: { pdf: baseUrl, audio: baseUrl },
      notes,
    });
  } catch (err) {
    console.error('practice program error:', err);
    return errorResponse(res, 'Kunne ikke hente øvelsesprogram.', 500);
  }
});

/**
 * POST /api/ovelse/sideskift
 * Request:  { workId: "Stein på stein", pageTurns: [ { time: 45.2, page: 2 } ] }
 * Response: { success: true }
 *
 * Stores page turn data in the Practice table, keyed by verk name.
 */
router.post('/sideskift', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['workId', 'pageTurns']);
    if (err) return errorResponse(res, err);

    const { workId, pageTurns } = req.body;

    // Get or create practice entry for this work
    let entity = await getEntity('Practice', 'practice', workId);
    const data = entity ? { ...entity, pageTurns } : { id: workId, pageTurns };
    await upsertEntity('Practice', buildEntity('practice', workId, {}, data));

    return successResponse(res, { message: 'Sideskift lagret.' });
  } catch (err) {
    console.error('sideskift error:', err);
    return errorResponse(res, 'Kunne ikke lagre sideskift.', 500);
  }
});

/**
 * GET /api/ovelse/meta
 * Returns practice program metadata (title, anledning, voice).
 */
router.get('/meta', async (req, res) => {
  try {
    const meta = await getEntity('Practice', 'program', 'meta');
    return res.json({
      title: meta?.title || '',
      anledning: meta?.anledning || '',
      voice: meta?.voice || 'tutti',
    });
  } catch (err) {
    console.error('practice meta error:', err);
    return errorResponse(res, 'Kunne ikke hente metadata.', 500);
  }
});

/**
 * POST /api/ovelse/meta
 * Request: { title?, anledning?, voice? }
 * Sets the active practice program (which anledning to display).
 */
router.post('/meta', async (req, res) => {
  try {
    const existing = await getEntity('Practice', 'program', 'meta') || {};
    const updated = {
      title: req.body.title !== undefined ? req.body.title : (existing.title || ''),
      anledning: req.body.anledning !== undefined ? req.body.anledning : (existing.anledning || ''),
      voice: req.body.voice !== undefined ? req.body.voice : (existing.voice || 'tutti'),
    };

    await upsertEntity('Practice', buildEntity('program', 'meta', {}, updated));
    return successResponse(res, { message: 'Metadata oppdatert.', ...updated });
  } catch (err) {
    console.error('practice meta update error:', err);
    return errorResponse(res, 'Kunne ikke oppdatere metadata.', 500);
  }
});

module.exports = router;
