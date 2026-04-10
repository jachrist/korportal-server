const express = require('express');
const router = express.Router();
const { listEntities, getEntity, upsertEntity, deleteEntity, buildEntity } = require('../lib/db');
const { successResponse, errorResponse, validateRequired, generateId } = require('../lib/helpers');

/**
 * GET /api/forside/hurtiglenker
 * Response: [ { id, title, url, icon, description, order, openInNewTab } ]
 */
router.get('/hurtiglenker', async (req, res) => {
  try {
    const items = await listEntities('QuickLinks');

    const links = items.map(item => ({
      id: item.id,
      title: item.title,
      url: item.url,
      icon: item.icon,
      description: item.description,
      order: item.order || 0,
      openInNewTab: item.openInNewTab || false,
    }));

    links.sort((a, b) => a.order - b.order);
    return res.json(links);
  } catch (err) {
    console.error('hurtiglenker error:', err);
    return errorResponse(res, 'Kunne ikke hente hurtiglenker.', 500);
  }
});

/**
 * POST /api/forside/hurtiglenker
 * Request: { title, url, icon, description, order, openInNewTab }
 * Response: { success: true, id }
 */
router.post('/hurtiglenker', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['title', 'url']);
    if (err) return errorResponse(res, err);

    const { title, url, icon, description, order, openInNewTab } = req.body;
    const id = generateId('QL');

    const link = {
      id, title, url,
      icon: icon || '',
      description: description || '',
      order: order || 0,
      openInNewTab: openInNewTab !== false,
    };

    await upsertEntity('QuickLinks', buildEntity('quicklink', id, {
      order: link.order,
    }, link));

    return successResponse(res, { id }, 201);
  } catch (err) {
    console.error('hurtiglenke create error:', err);
    return errorResponse(res, 'Kunne ikke opprette hurtiglenke.', 500);
  }
});

/**
 * PATCH /api/forside/hurtiglenker/:id
 * Request: { title, url, icon, description, order, openInNewTab }
 */
router.patch('/hurtiglenker/:id', async (req, res) => {
  try {
    const entity = await getEntity('QuickLinks', 'quicklink', req.params.id);
    if (!entity) return errorResponse(res, 'Hurtiglenke ikke funnet.', 404);

    const updated = { ...entity, ...req.body };
    await upsertEntity('QuickLinks', buildEntity('quicklink', req.params.id, {
      order: updated.order || 0,
    }, updated));

    return successResponse(res, { message: 'Hurtiglenke oppdatert.' });
  } catch (err) {
    console.error('hurtiglenke update error:', err);
    return errorResponse(res, 'Kunne ikke oppdatere hurtiglenke.', 500);
  }
});

/**
 * DELETE /api/forside/hurtiglenker/:id
 */
router.delete('/hurtiglenker/:id', async (req, res) => {
  try {
    await deleteEntity('QuickLinks', 'quicklink', req.params.id);
    return successResponse(res, { message: 'Hurtiglenke slettet.' });
  } catch (err) {
    console.error('hurtiglenke delete error:', err);
    return errorResponse(res, 'Kunne ikke slette hurtiglenke.', 500);
  }
});

module.exports = router;
