const express = require('express');
const router = express.Router();
const { listEntities, getEntity, upsertEntity, deleteEntity, buildEntity } = require('../lib/table-client');
const { successResponse, errorResponse, validateRequired, generateId } = require('../lib/helpers');

/**
 * GET /api/musikk/konserter
 * Response: [ { id, title, date, location, images: [ { url, caption } ],
 *               tracks: [ { id, title, duration, audioUrl } ] } ]
 */
router.get('/konserter', async (req, res) => {
  try {
    const items = await listEntities('Music');

    const concerts = items.map(item => ({
      id: item.id,
      title: item.title,
      date: item.date,
      location: item.location || '',
      images: item.images || [],
      tracks: (item.tracks || []).map(t => ({
        id: t.id,
        title: t.title,
        duration: t.duration || 0,
        audioUrl: t.audioUrl || '',
      })),
    }));

    concerts.sort((a, b) => new Date(b.date) - new Date(a.date));
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
