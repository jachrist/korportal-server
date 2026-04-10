const express = require('express');
const router = express.Router();
const { listEntities, getEntity, upsertEntity, buildEntity } = require('../lib/db');
const { successResponse, errorResponse, validateRequired, generateId, now } = require('../lib/helpers');

/**
 * GET /api/medlemmer/side
 * Response: {
 *   article: { title, text, format, imageUrl, imagePlacement },
 *   events: [ { id, title, description, date, startTime, endTime, location,
 *               attendees: [ { name, email, status } ], totalMembers } ]
 * }
 */
router.get('/side', async (req, res) => {
  try {
    // Get members page article
    const articles = await listEntities('Articles', {
      filter: `page eq 'members'`,
    });
    const article = articles[0] || {};

    // Get upcoming events
    const events = await listEntities('Events');
    const today = new Date().toISOString().split('T')[0];

    // Count total members
    const members = await listEntities('Members');
    const totalMembers = members.length;

    const upcomingEvents = events
      .filter(e => e.date >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(event => ({
        id: event.id,
        title: event.title,
        description: event.description || '',
        date: event.date,
        startTime: event.startTime || '',
        endTime: event.endTime || '',
        location: event.location || '',
        attendees: event.attendees || [],
        totalMembers,
      }));

    return res.json({
      article: {
        title: article.title || '',
        text: article.text || '',
        format: article.format || 'markdown',
        imageUrl: article.imageUrl || '',
        imagePlacement: article.imagePlacement || 'over',
      },
      events: upcomingEvents,
    });
  } catch (err) {
    console.error('medlemmer side error:', err);
    return errorResponse(res, 'Kunne ikke hente medlemsside.', 500);
  }
});

/**
 * POST /api/medlemmer/rsvp
 * Request:  { eventId, action: "attending"|"not_attending", memberName, memberEmail }
 * Response: { success: true }
 */
router.post('/rsvp', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['eventId', 'action', 'memberName', 'memberEmail']);
    if (err) return errorResponse(res, err);

    const { eventId, action, memberName, memberEmail } = req.body;
    const entity = await getEntity('Events', 'event', String(eventId));
    if (!entity) return errorResponse(res, 'Arrangement ikke funnet.', 404);

    const attendees = entity.attendees || [];
    const existingIdx = attendees.findIndex(a => a.email === memberEmail);

    if (existingIdx >= 0) {
      attendees[existingIdx].status = action;
      attendees[existingIdx].name = memberName;
    } else {
      attendees.push({ name: memberName, email: memberEmail, status: action });
    }

    const updated = { ...entity, attendees };
    await upsertEntity('Events', buildEntity('event', String(eventId), {
      date: entity.date,
    }, updated));

    return successResponse(res, { message: 'RSVP registrert.' });
  } catch (err) {
    console.error('rsvp error:', err);
    return errorResponse(res, 'Kunne ikke registrere RSVP.', 500);
  }
});

/**
 * POST /api/medlemmer/arrangement
 * Request:  { title, description, date, startTime, endTime, location, authorName, authorEmail }
 * Response: { success: true, id }
 */
router.post('/arrangement', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['title', 'date']);
    if (err) return errorResponse(res, err);

    const { title, description, date, startTime, endTime, location, authorName, authorEmail } = req.body;
    const id = generateId('EVT');

    const event = {
      id,
      title,
      description: description || '',
      date,
      startTime: startTime || '',
      endTime: endTime || '',
      location: location || '',
      authorName: authorName || '',
      authorEmail: authorEmail || '',
      attendees: [],
      createdAt: now(),
    };

    await upsertEntity('Events', buildEntity('event', id, {
      date,
    }, event));

    return successResponse(res, { id }, 201);
  } catch (err) {
    console.error('create event error:', err);
    return errorResponse(res, 'Kunne ikke opprette arrangement.', 500);
  }
});

/**
 * PATCH /api/medlemmer/arrangement/:id
 */
router.patch('/arrangement/:id', async (req, res) => {
  try {
    const entity = await getEntity('Events', 'event', req.params.id);
    if (!entity) return errorResponse(res, 'Arrangement ikke funnet.', 404);

    const updated = { ...entity, ...req.body };
    await upsertEntity('Events', buildEntity('event', req.params.id, {
      date: updated.date,
    }, updated));

    return successResponse(res, { message: 'Arrangement oppdatert.' });
  } catch (err) {
    console.error('event update error:', err);
    return errorResponse(res, 'Kunne ikke oppdatere arrangement.', 500);
  }
});

/**
 * DELETE /api/medlemmer/arrangement/:id
 */
router.delete('/arrangement/:id', async (req, res) => {
  try {
    const { deleteEntity } = require('../lib/db');
    await deleteEntity('Events', 'event', req.params.id);
    return successResponse(res, { message: 'Arrangement slettet.' });
  } catch (err) {
    console.error('event delete error:', err);
    return errorResponse(res, 'Kunne ikke slette arrangement.', 500);
  }
});

module.exports = router;
