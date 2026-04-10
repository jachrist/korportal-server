const express = require('express');
const router = express.Router();
const { listEntities, upsertEntity, deleteEntity, buildEntity } = require('../lib/db');
const { successResponse, errorResponse, validateRequired, generateId, generateReferenceNumber, now } = require('../lib/helpers');

/**
 * GET /api/konserter?upcoming=true&$top=10
 * Response: [ { id, title, date, time, location, address, description, imageUrl,
 *               ticketPrice, ticketsAvailable, ticketUrl, isPublic, status, category } ]
 */
router.get('/konserter', async (req, res) => {
  try {
    let items = await listEntities('Concerts');

    items = items.map(item => ({
      id: item.id,
      title: item.title,
      date: item.date,
      time: item.time,
      location: item.location,
      address: item.address || '',
      description: item.description || '',
      imageUrl: item.imageUrl || null,
      ticketPrice: item.ticketPrice || 0,
      ticketsAvailable: item.ticketsAvailable || 0,
      ticketUrl: item.ticketUrl || null,
      isPublic: item.isPublic !== false,
      status: item.status || 'available',
      category: item.category || null,
    }));

    if (req.query.upcoming === 'true') {
      const today = new Date().toISOString().split('T')[0];
      items = items.filter(c => c.date >= today);
    }

    items.sort((a, b) => new Date(a.date) - new Date(b.date));

    const top = parseInt(req.query.$top);
    if (top > 0) items = items.slice(0, top);

    return res.json(items);
  } catch (err) {
    console.error('konserter error:', err);
    return errorResponse(res, 'Kunne ikke hente konserter.', 500);
  }
});

/**
 * POST /api/konserter
 * Request: { title, date, time, location, address, description, imageUrl, ticketPrice, ticketsAvailable, ticketUrl, isPublic, category }
 * Response: { success: true, id }
 */
router.post('/konserter', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['title', 'date']);
    if (err) return errorResponse(res, err);

    const { title, date, time, location, address, description, imageUrl, ticketPrice, ticketsAvailable, ticketUrl, isPublic, category } = req.body;
    const id = generateId('CON');

    const concert = {
      id, title, date,
      time: time || '',
      location: location || '',
      address: address || '',
      description: description || '',
      imageUrl: imageUrl || null,
      ticketPrice: ticketPrice || 0,
      ticketsAvailable: ticketsAvailable || 0,
      ticketUrl: ticketUrl || null,
      isPublic: isPublic !== false,
      status: 'available',
      category: category || null,
    };

    await upsertEntity('Concerts', buildEntity('concert', id, {
      date,
      isPublic: concert.isPublic,
    }, concert));

    return successResponse(res, { id }, 201);
  } catch (err) {
    console.error('concert create error:', err);
    return errorResponse(res, 'Kunne ikke opprette konsert.', 500);
  }
});

/**
 * POST /api/konserter/billett
 * Request:  { concertId, name, email, phone, ticketCount, message, totalPrice, reservationDate }
 * Response: { success: true, referenceNumber, bookingReference, totalPrice }
 */
router.post('/konserter/billett', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['concertId', 'name', 'email', 'ticketCount']);
    if (err) return errorResponse(res, err);

    const { concertId, name, email, phone, ticketCount, message, totalPrice, reservationDate } = req.body;
    const refNumber = generateReferenceNumber('UTK');
    const id = generateId('BIL');

    const reservation = {
      id,
      ticketId: refNumber,
      bookingReference: refNumber,
      referenceNumber: refNumber,
      concertId,
      name,
      email,
      phone: phone || '',
      ticketCount,
      message: message || '',
      totalPrice: totalPrice || 0,
      reservationDate: reservationDate || now(),
      isPaid: false,
      isCheckedIn: false,
    };

    await upsertEntity('TicketReservations', buildEntity('reservation', id, {
      concertId: String(concertId),
      isPaid: false,
      referenceNumber: refNumber,
    }, reservation));

    return successResponse(res, {
      referenceNumber: refNumber,
      bookingReference: refNumber,
      totalPrice: reservation.totalPrice,
      message: 'Bestilling mottatt!',
    }, 201);
  } catch (err) {
    console.error('billett error:', err);
    return errorResponse(res, 'Kunne ikke bestille billetter.', 500);
  }
});

/**
 * PATCH /api/konserter/:id
 */
router.patch('/konserter/:id', async (req, res) => {
  try {
    const items = await listEntities('Concerts', {
      filter: `RowKey eq '${req.params.id}'`,
    });
    if (items.length === 0) return errorResponse(res, 'Konsert ikke funnet.', 404);

    const updated = { ...items[0], ...req.body };
    await upsertEntity('Concerts', buildEntity('concert', req.params.id, {
      date: updated.date,
      isPublic: updated.isPublic !== false,
    }, updated));

    return successResponse(res, { message: 'Konsert oppdatert.' });
  } catch (err) {
    console.error('concert update error:', err);
    return errorResponse(res, 'Kunne ikke oppdatere konsert.', 500);
  }
});

/**
 * DELETE /api/konserter/:id
 */
router.delete('/konserter/:id', async (req, res) => {
  try {
    await deleteEntity('Concerts', 'concert', req.params.id);
    return successResponse(res, { message: 'Konsert slettet.' });
  } catch (err) {
    console.error('concert delete error:', err);
    return errorResponse(res, 'Kunne ikke slette konsert.', 500);
  }
});

module.exports = router;
