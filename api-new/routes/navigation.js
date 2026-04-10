const express = require('express');
const router = express.Router();
const { listEntities, getEntity, upsertEntity, deleteEntity, buildEntity } = require('../lib/db');
const { successResponse, errorResponse, validateRequired, generateId, now } = require('../lib/helpers');

/**
 * GET /api/navigasjon
 * Response: [ { id, title, url, icon, order, openInNewTab, minRole, hideWhenLoggedIn, isLogout } ]
 */
router.get('/navigasjon', async (req, res) => {
  try {
    const items = await listEntities('Navigation');

    const navItems = items.map(item => ({
      id: item.id,
      title: item.title,
      url: item.url,
      icon: item.icon,
      order: item.order || 0,
      openInNewTab: item.openInNewTab || false,
      minRole: item.role || item.minRole || 'anonym',
      hideWhenLoggedIn: item.hideWhenLoggedIn || false,
      isLogout: item.isLogout || false,
    }));

    navItems.sort((a, b) => a.order - b.order);
    return res.json(navItems);
  } catch (err) {
    console.error('navigasjon error:', err);
    return errorResponse(res, 'Kunne ikke hente navigasjon.', 500);
  }
});

/**
 * POST /api/navigasjon
 * Request: { title, url, icon, order, openInNewTab, minRole, hideWhenLoggedIn, isLogout }
 * Response: { success: true, id }
 */
router.post('/navigasjon', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['title', 'url']);
    if (err) return errorResponse(res, err);

    const { title, url, icon, order, openInNewTab, minRole, hideWhenLoggedIn, isLogout } = req.body;
    const id = generateId('NAV');

    const navItem = {
      id, title, url,
      icon: icon || '',
      order: order || 0,
      openInNewTab: openInNewTab || false,
      minRole: minRole || 'anonym',
      hideWhenLoggedIn: hideWhenLoggedIn || false,
      isLogout: isLogout || false,
    };

    await upsertEntity('Navigation', buildEntity('navigation', id, {
      order: navItem.order,
      role: navItem.minRole,
    }, navItem));

    return successResponse(res, { id }, 201);
  } catch (err) {
    console.error('navigasjon create error:', err);
    return errorResponse(res, 'Kunne ikke opprette navigasjonselement.', 500);
  }
});

/**
 * PATCH /api/navigasjon/:id
 * Request: { title, url, icon, order, ... }
 */
router.patch('/navigasjon/:id', async (req, res) => {
  try {
    const entity = await getEntity('Navigation', 'navigation', req.params.id);
    if (!entity) return errorResponse(res, 'Navigasjonselement ikke funnet.', 404);

    const updated = { ...entity, ...req.body };
    await upsertEntity('Navigation', buildEntity('navigation', req.params.id, {
      order: updated.order || 0,
      role: updated.minRole || updated.role || 'anonym',
    }, updated));

    return successResponse(res, { message: 'Navigasjonselement oppdatert.' });
  } catch (err) {
    console.error('navigasjon update error:', err);
    return errorResponse(res, 'Kunne ikke oppdatere navigasjonselement.', 500);
  }
});

/**
 * DELETE /api/navigasjon/:id
 */
router.delete('/navigasjon/:id', async (req, res) => {
  try {
    await deleteEntity('Navigation', 'navigation', req.params.id);
    return successResponse(res, { message: 'Navigasjonselement slettet.' });
  } catch (err) {
    console.error('navigasjon delete error:', err);
    return errorResponse(res, 'Kunne ikke slette navigasjonselement.', 500);
  }
});

module.exports = router;
