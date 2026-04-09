const express = require('express');
const router = express.Router();
const { listEntities, getEntity, upsertEntity, deleteEntity, buildEntity } = require('../lib/table-client');
const { successResponse, errorResponse, validateRequired } = require('../lib/helpers');

/**
 * GET /api/billetter/ubetalte
 * Response: [ { id, ticketId, concertId, concertTitle, concertDate, name, email, phone,
 *               ticketCount, totalPrice, reservationDate, isPaid } ]
 */
router.get('/ubetalte', async (req, res) => {
  try {
    const items = await listEntities('TicketReservations');

    // Fetch concert titles for enrichment
    const concerts = await listEntities('Concerts');
    const concertMap = new Map(concerts.map(c => [String(c.id), c]));

    const reservations = items.map(item => {
      const concert = concertMap.get(String(item.concertId));
      return {
        id: item.id,
        ticketId: item.ticketId || item.bookingReference || item.referenceNumber,
        concertId: item.concertId,
        concertTitle: item.concertTitle || concert?.title || '',
        concertDate: item.concertDate || concert?.date || '',
        name: item.name,
        email: item.email,
        phone: item.phone || '',
        ticketCount: item.ticketCount,
        totalPrice: item.totalPrice || 0,
        reservationDate: item.reservationDate,
        isPaid: item.isPaid || false,
      };
    });

    return res.json(reservations);
  } catch (err) {
    console.error('ubetalte error:', err);
    return errorResponse(res, 'Kunne ikke hente billetter.', 500);
  }
});

/**
 * POST /api/billetter/marker-betalt
 * Request:  { reservationIds: ["id1", "id2"] }
 * Response: { success: true, updatedIds: [...] }
 */
router.post('/marker-betalt', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['reservationIds']);
    if (err) return errorResponse(res, err);

    const { reservationIds } = req.body;
    const updatedIds = [];

    for (const id of reservationIds) {
      const entity = await getEntity('TicketReservations', 'reservation', id);
      if (entity) {
        const updated = { ...entity, isPaid: true };
        await upsertEntity('TicketReservations', buildEntity('reservation', id, {
          concertId: String(entity.concertId),
          isPaid: true,
          referenceNumber: entity.referenceNumber || entity.ticketId,
        }, updated));
        updatedIds.push(id);
      }
    }

    return successResponse(res, { updatedIds, message: `${updatedIds.length} reservasjoner markert som betalt.` });
  } catch (err) {
    console.error('marker-betalt error:', err);
    return errorResponse(res, 'Kunne ikke oppdatere betalingsstatus.', 500);
  }
});

/**
 * POST /api/billetter/slett
 * Request:  { reservationIds: ["id1"] }
 * Response: { success: true }
 */
router.post('/slett', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['reservationIds']);
    if (err) return errorResponse(res, err);

    const { reservationIds } = req.body;
    for (const id of reservationIds) {
      try {
        await deleteEntity('TicketReservations', 'reservation', id);
      } catch (delErr) {
        if (delErr.statusCode !== 404) throw delErr;
      }
    }

    return successResponse(res, { message: `${reservationIds.length} reservasjoner slettet.` });
  } catch (err) {
    console.error('slett billetter error:', err);
    return errorResponse(res, 'Kunne ikke slette reservasjoner.', 500);
  }
});

module.exports = router;
