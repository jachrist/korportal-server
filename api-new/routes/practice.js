const express = require('express');
const router = express.Router();
const { listEntities, getEntity, upsertEntity, buildEntity } = require('../lib/table-client');
const { successResponse, errorResponse, validateRequired } = require('../lib/helpers');

/**
 * GET /api/ovelse/program
 * Response: {
 *   title, voice, baseUrls: { pdf, audio },
 *   notes: [ { id, noteTitle, pdfFilename, audio: { voice: filename }, pageTurns: [], sortOrder } ]
 * }
 */
router.get('/program', async (req, res) => {
  try {
    const items = await listEntities('Practice');

    if (items.length === 0) {
      return res.json({ title: '', voice: 'tutti', baseUrls: { pdf: '', audio: '' }, notes: [] });
    }

    // Practice table stores one entity with the full program, or one entity per note
    // Check if there's a "program" meta-entry
    const meta = items.find(i => i.partitionKey === 'program') || items[0];

    const notes = items
      .filter(i => i.partitionKey === 'practice' || i.noteTitle)
      .map(item => ({
        id: item.id,
        noteTitle: item.noteTitle,
        pdfFilename: item.pdfFilename,
        audio: item.audio || {},
        pageTurns: item.pageTurns || [],
        sortOrder: item.sortOrder || 0,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return res.json({
      title: meta.title || '',
      voice: meta.voice || 'tutti',
      baseUrls: meta.baseUrls || { pdf: '', audio: '' },
      notes,
    });
  } catch (err) {
    console.error('practice program error:', err);
    return errorResponse(res, 'Kunne ikke hente øvelsesprogram.', 500);
  }
});

/**
 * POST /api/ovelse/sideskift
 * Request:  { workId: "Sanctus", pageTurns: [ { time: 45.2, page: 2 } ] }
 * Response: { success: true }
 */
router.post('/sideskift', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['workId', 'pageTurns']);
    if (err) return errorResponse(res, err);

    const { workId, pageTurns } = req.body;
    const entity = await getEntity('Practice', 'practice', workId);
    if (!entity) return errorResponse(res, 'Verk ikke funnet.', 404);

    const updated = { ...entity, pageTurns };
    await upsertEntity('Practice', buildEntity('practice', workId, {}, updated));

    return successResponse(res, { message: 'Sideskift lagret.' });
  } catch (err) {
    console.error('sideskift error:', err);
    return errorResponse(res, 'Kunne ikke lagre sideskift.', 500);
  }
});

module.exports = router;
