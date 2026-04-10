const express = require('express');
const router = express.Router();
const { listEntities, upsertEntity, buildEntity } = require('../lib/db');
const { errorResponse, validateRequired } = require('../lib/helpers');

/**
 * POST /api/billettkontroll/valider
 * Request:  { referenceNumber: "UTK-2026-0042" }
 * Response: { status: "valid"|"already_checked_in"|"not_paid"|"not_found", message: "..." }
 */
router.post('/valider', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['referenceNumber']);
    if (err) return errorResponse(res, err);

    const { referenceNumber } = req.body;

    const items = await listEntities('TicketReservations', {
      filter: `referenceNumber eq '${referenceNumber}'`,
    });

    if (items.length === 0) {
      return res.json({ status: 'not_found', message: 'Ukjent billett' });
    }

    const reservation = items[0];

    if (!reservation.isPaid) {
      return res.json({ status: 'not_paid', message: 'Ikke betalt' });
    }

    if (reservation.isCheckedIn) {
      return res.json({ status: 'already_checked_in', message: 'Allerede sjekket inn' });
    }

    // Mark as checked in
    const updated = { ...reservation, isCheckedIn: true };
    await upsertEntity('TicketReservations', buildEntity('reservation', reservation.rowKey, {
      concertId: String(reservation.concertId),
      isPaid: true,
      referenceNumber,
    }, updated));

    return res.json({ status: 'valid', message: 'Gyldig billett — sjekket inn' });
  } catch (err) {
    console.error('valider error:', err);
    return errorResponse(res, 'Kunne ikke validere billett.', 500);
  }
});

module.exports = router;
