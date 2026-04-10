const express = require('express');
const router = express.Router();
const { listEntities, getEntity, upsertEntity, deleteEntity, buildEntity } = require('../lib/db');
const { successResponse, errorResponse, validateRequired, generateId } = require('../lib/helpers');

/**
 * GET /api/nedlasting/filer
 * Response: [ { id, title, fileUrl, filename, category, fileSize, uploadedAt, sortOrder } ]
 */
router.get('/filer', async (req, res) => {
  try {
    const items = await listEntities('Downloads');

    const downloads = items.map(item => ({
      id: item.id,
      title: item.title,
      fileUrl: item.fileUrl,
      filename: item.filename,
      category: item.category || '',
      fileSize: item.fileSize || null,
      uploadedAt: item.uploadedAt || null,
      sortOrder: item.sortOrder || 999,
    }));

    downloads.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return (a.title || '').localeCompare(b.title || '');
    });

    return res.json(downloads);
  } catch (err) {
    console.error('downloads error:', err);
    return errorResponse(res, 'Kunne ikke hente nedlastinger.', 500);
  }
});

/**
 * POST /api/nedlasting/filer
 * Request: { title, fileUrl, filename, category, fileSize, sortOrder }
 * Response: { success: true, id }
 */
router.post('/filer', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['title', 'fileUrl']);
    if (err) return errorResponse(res, err);

    const { title, fileUrl, filename, category, fileSize, sortOrder } = req.body;
    const id = generateId('DL');

    const download = {
      id, title, fileUrl,
      filename: filename || title,
      category: category || '',
      fileSize: fileSize || null,
      uploadedAt: new Date().toISOString(),
      sortOrder: sortOrder || 999,
    };

    await upsertEntity('Downloads', buildEntity('download', id, {
      category: download.category,
    }, download));

    return successResponse(res, { id }, 201);
  } catch (err) {
    console.error('download create error:', err);
    return errorResponse(res, 'Kunne ikke opprette nedlasting.', 500);
  }
});

/**
 * PATCH /api/nedlasting/filer/:id
 * Request: { title, fileUrl, filename, category, fileSize, sortOrder }
 */
router.patch('/filer/:id', async (req, res) => {
  try {
    const entity = await getEntity('Downloads', 'download', req.params.id);
    if (!entity) return errorResponse(res, 'Nedlasting ikke funnet.', 404);

    const updated = { ...entity, ...req.body };
    await upsertEntity('Downloads', buildEntity('download', req.params.id, {
      category: updated.category || '',
    }, updated));

    return successResponse(res, { message: 'Nedlasting oppdatert.' });
  } catch (err) {
    console.error('download update error:', err);
    return errorResponse(res, 'Kunne ikke oppdatere nedlasting.', 500);
  }
});

/**
 * DELETE /api/nedlasting/filer/:id
 */
router.delete('/filer/:id', async (req, res) => {
  try {
    await deleteEntity('Downloads', 'download', req.params.id);
    return successResponse(res, { message: 'Nedlasting slettet.' });
  } catch (err) {
    console.error('download delete error:', err);
    return errorResponse(res, 'Kunne ikke slette nedlasting.', 500);
  }
});

module.exports = router;
