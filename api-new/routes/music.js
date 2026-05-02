const express = require('express');
const router = express.Router();
const { listEntities, getEntity, upsertEntity, deleteEntity, buildEntity } = require('../lib/db');
const { successResponse, errorResponse, validateRequired, generateId } = require('../lib/helpers');

/**
 * GET /api/musikk/konserter
 *
 * Bygger konsert-lista dynamisk fra Files-tabellen:
 * - Én konsert per anledning som har minst én opplastet opptak-fil
 * - Tittel = anledning-navn (dato/sted kan inkluderes i tittelen)
 * - Bilder = opplastede filer av type 'bilde' med samme anledning
 * - Tracks = opplastede filer av type 'opptak' med samme anledning, sortert
 * - Konsertene sorteres alfabetisk på anledning
 */
router.get('/konserter', async (req, res) => {
  try {
    const allFiles = await listEntities('Files');

    const groups = new Map(); // anledning → { tracks: [], images: [] }
    for (const f of allFiles) {
      if (!f.uploaded || !f.anledning) continue;
      const t = (f.type || '').toLowerCase();
      if (t !== 'opptak' && t !== 'bilde') continue;

      if (!groups.has(f.anledning)) {
        groups.set(f.anledning, { tracks: [], images: [] });
      }
      const group = groups.get(f.anledning);
      if (t === 'opptak') group.tracks.push(f);
      else group.images.push(f);
    }

    const sortFiles = (a, b) => {
      const sa = a.sortering ?? 999;
      const sb = b.sortering ?? 999;
      if (sa !== sb) return sa - sb;
      return (a.navn || '').localeCompare(b.navn || '', 'no');
    };

    const stripExt = (navn) => (navn || '').replace(/\.[^.]+$/, '');

    const concerts = [];
    for (const [anledning, { tracks, images }] of groups) {
      if (tracks.length === 0) continue; // krever minst ett opptak

      tracks.sort(sortFiles);
      images.sort(sortFiles);

      concerts.push({
        id: anledning,
        title: anledning,
        date: '',
        location: '',
        images: images.map(img => ({
          url: img.url,
          caption: img.verk || stripExt(img.navn),
        })),
        tracks: tracks.map((t, i) => ({
          id: i + 1,
          title: t.verk || stripExt(t.navn),
          duration: 0,
          audioUrl: t.url,
        })),
      });
    }

    concerts.sort((a, b) => a.title.localeCompare(b.title, 'no'));
    return res.json(concerts);
  } catch (err) {
    console.error('musikk error:', err);
    return errorResponse(res, 'Kunne ikke hente musikkarkiv.', 500);
  }
});

/**
 * POST /api/musikk/konserter
 * Request: { title, date, location, images: [...], tracks: [...] }
 * Response: { success: true, id }
 */
router.post('/konserter', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['title', 'date']);
    if (err) return errorResponse(res, err);

    const { title, date, location, images, tracks } = req.body;
    const id = generateId('MUS');

    const concert = {
      id, title, date,
      location: location || '',
      images: images || [],
      tracks: tracks || [],
    };

    await upsertEntity('Music', buildEntity('music', id, {
      date,
    }, concert));

    return successResponse(res, { id }, 201);
  } catch (err) {
    console.error('musikk create error:', err);
    return errorResponse(res, 'Kunne ikke opprette musikkonsert.', 500);
  }
});

/**
 * PATCH /api/musikk/konserter/:id
 * Request: { title, date, location, images, tracks }
 */
router.patch('/konserter/:id', async (req, res) => {
  try {
    const entity = await getEntity('Music', 'music', req.params.id);
    if (!entity) return errorResponse(res, 'Musikkonsert ikke funnet.', 404);

    const updated = { ...entity, ...req.body };
    await upsertEntity('Music', buildEntity('music', req.params.id, {
      date: updated.date,
    }, updated));

    return successResponse(res, { message: 'Musikkonsert oppdatert.' });
  } catch (err) {
    console.error('musikk update error:', err);
    return errorResponse(res, 'Kunne ikke oppdatere musikkonsert.', 500);
  }
});

/**
 * DELETE /api/musikk/konserter/:id
 */
router.delete('/konserter/:id', async (req, res) => {
  try {
    await deleteEntity('Music', 'music', req.params.id);
    return successResponse(res, { message: 'Musikkonsert slettet.' });
  } catch (err) {
    console.error('musikk delete error:', err);
    return errorResponse(res, 'Kunne ikke slette musikkonsert.', 500);
  }
});

module.exports = router;
