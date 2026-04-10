const express = require('express');
const router = express.Router();
const { listEntities, getEntity, upsertEntity, deleteEntity, buildEntity } = require('../lib/db');
const { successResponse, errorResponse, validateRequired, generateId } = require('../lib/helpers');

/**
 * GET /api/forside/kontaktpersoner
 * Response: [ { id, name, email, phone, kontaktrolle, image, order } ]
 */
router.get('/kontaktpersoner', async (req, res) => {
  try {
    const items = await listEntities('Contacts');

    const contacts = items.map(item => ({
      id: item.id,
      name: item.name,
      email: item.email,
      phone: item.phone,
      kontaktrolle: item.kontaktrolle,
      image: item.image || null,
      order: item.order || 0,
    }));

    contacts.sort((a, b) => a.order - b.order);
    return res.json(contacts);
  } catch (err) {
    console.error('kontaktpersoner error:', err);
    return errorResponse(res, 'Kunne ikke hente kontaktpersoner.', 500);
  }
});

/**
 * POST /api/forside/kontaktpersoner
 * Request: { name, email, phone, kontaktrolle, image, order }
 * Response: { success: true, id }
 */
router.post('/kontaktpersoner', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['name', 'kontaktrolle']);
    if (err) return errorResponse(res, err);

    const { name, email, phone, kontaktrolle, image, order } = req.body;
    const id = generateId('KON');

    const contact = {
      id, name,
      email: email || '',
      phone: phone || '',
      kontaktrolle,
      image: image || null,
      order: order || 0,
    };

    await upsertEntity('Contacts', buildEntity('contact', id, {
      kontaktrolle,
    }, contact));

    return successResponse(res, { id }, 201);
  } catch (err) {
    console.error('kontaktperson create error:', err);
    return errorResponse(res, 'Kunne ikke opprette kontaktperson.', 500);
  }
});

/**
 * PATCH /api/forside/kontaktpersoner/:id
 * Request: { name, email, phone, kontaktrolle, image, order }
 */
router.patch('/kontaktpersoner/:id', async (req, res) => {
  try {
    const entity = await getEntity('Contacts', 'contact', req.params.id);
    if (!entity) return errorResponse(res, 'Kontaktperson ikke funnet.', 404);

    const updated = { ...entity, ...req.body };
    await upsertEntity('Contacts', buildEntity('contact', req.params.id, {
      kontaktrolle: updated.kontaktrolle || '',
    }, updated));

    return successResponse(res, { message: 'Kontaktperson oppdatert.' });
  } catch (err) {
    console.error('kontaktperson update error:', err);
    return errorResponse(res, 'Kunne ikke oppdatere kontaktperson.', 500);
  }
});

/**
 * DELETE /api/forside/kontaktpersoner/:id
 */
router.delete('/kontaktpersoner/:id', async (req, res) => {
  try {
    await deleteEntity('Contacts', 'contact', req.params.id);
    return successResponse(res, { message: 'Kontaktperson slettet.' });
  } catch (err) {
    console.error('kontaktperson delete error:', err);
    return errorResponse(res, 'Kunne ikke slette kontaktperson.', 500);
  }
});

module.exports = router;
