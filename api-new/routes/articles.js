const express = require('express');
const router = express.Router();
const { listEntities, upsertEntity, deleteEntity, buildEntity } = require('../lib/db');
const { successResponse, errorResponse, validateRequired, generateId, now } = require('../lib/helpers');

/**
 * GET /api/forside/artikkel?slug=frontpage
 * Response: { id, title, text, format, imageUrl, imagePlacement, slug, published, author }
 */
router.get('/artikkel', async (req, res) => {
  try {
    const slug = req.query.slug || 'frontpage';
    const items = await listEntities('Articles', {
      filter: `page eq '${slug}'`,
    });

    if (items.length === 0) {
      return errorResponse(res, 'Artikkel ikke funnet.', 404);
    }

    const item = items[0];
    return res.json({
      id: item.id,
      title: item.title,
      text: item.text,
      format: item.format || 'text',
      imageUrl: item.imageUrl || '',
      imagePlacement: item.imagePlacement || 'over',
      slug: item.slug || item.page,
      published: item.published,
      author: item.author || null,
    });
  } catch (err) {
    console.error('artikkel error:', err);
    return errorResponse(res, 'Kunne ikke hente artikkel.', 500);
  }
});

/**
 * POST /api/forside/artikkel
 * Request: { title, text, format, slug, imageUrl, imagePlacement }
 * Response: { success: true, id }
 */
router.post('/artikkel', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['title', 'text']);
    if (err) return errorResponse(res, err);

    const { title, text, format, slug, imageUrl, imagePlacement } = req.body;
    const id = slug || generateId('ART');

    const article = {
      id, title, text,
      format: format || 'markdown',
      imageUrl: imageUrl || '',
      imagePlacement: imagePlacement || 'over',
      slug: id,
      published: now(),
      author: null,
    };

    await upsertEntity('Articles', buildEntity('article', id, {
      page: id,
    }, article));

    return successResponse(res, { id }, 201);
  } catch (err) {
    console.error('artikkel create error:', err);
    return errorResponse(res, 'Kunne ikke opprette artikkel.', 500);
  }
});

/**
 * PATCH /api/forside/artikkel/:id
 * Request: { title, text, format }
 */
router.patch('/artikkel/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const items = await listEntities('Articles', {
      filter: `RowKey eq '${id}'`,
    });
    if (items.length === 0) return errorResponse(res, 'Artikkel ikke funnet.', 404);

    const existing = items[0];
    const updated = { ...existing, ...req.body };
    await upsertEntity('Articles', buildEntity('article', id, {
      page: updated.slug || updated.page,
    }, updated));

    return successResponse(res, { message: 'Artikkel oppdatert.' });
  } catch (err) {
    console.error('artikkel update error:', err);
    return errorResponse(res, 'Kunne ikke oppdatere artikkel.', 500);
  }
});

/**
 * DELETE /api/forside/artikkel/:id
 */
router.delete('/artikkel/:id', async (req, res) => {
  try {
    await deleteEntity('Articles', 'article', req.params.id);
    return successResponse(res, { message: 'Artikkel slettet.' });
  } catch (err) {
    console.error('artikkel delete error:', err);
    return errorResponse(res, 'Kunne ikke slette artikkel.', 500);
  }
});

module.exports = router;
