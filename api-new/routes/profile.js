const express = require('express');
const router = express.Router();
const { listEntities, upsertEntity, buildEntity } = require('../lib/db');
const { successResponse, errorResponse, validateRequired } = require('../lib/helpers');

/**
 * POST /api/profil/hent
 * Request:  { epost: "user@example.com" }
 * Response: { navn, epost, telefon, stemme, varsler: { innlegg, arrangementer, meldinger }, preferanser: { tema } }
 */
router.post('/hent', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['epost']);
    if (err) return errorResponse(res, err);

    const email = req.body.epost.toLowerCase().trim();
    const members = await listEntities('Members', {
      filter: `email eq '${email}'`,
    });

    if (members.length === 0) {
      return errorResponse(res, 'Profil ikke funnet.', 404);
    }

    const member = members[0];
    return res.json({
      navn: member.name || member.navn || '',
      epost: member.email || member.epost || '',
      telefon: member.phone || member.telefon || '',
      stemme: member.voice || member.stemme || '',
      varsler: member.varsler || { innlegg: true, arrangementer: true, meldinger: true },
      preferanser: member.preferanser || { tema: 'light' },
    });
  } catch (err) {
    console.error('profil hent error:', err);
    return errorResponse(res, 'Kunne ikke hente profil.', 500);
  }
});

/**
 * POST /api/profil/oppdater
 * Request:  { epost, navn, telefon, stemme, varsler: {...}, preferanser: {...} }
 * Response: { success: true }
 */
router.post('/oppdater', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['epost']);
    if (err) return errorResponse(res, err);

    const email = req.body.epost.toLowerCase().trim();
    const members = await listEntities('Members', {
      filter: `email eq '${email}'`,
    });

    if (members.length === 0) {
      return errorResponse(res, 'Profil ikke funnet.', 404);
    }

    const member = members[0];
    const updated = {
      ...member,
      name: req.body.navn || member.name,
      navn: req.body.navn || member.navn,
      email,
      epost: email,
      phone: req.body.telefon || member.phone,
      telefon: req.body.telefon || member.telefon,
      voice: req.body.stemme || member.voice,
      stemme: req.body.stemme || member.stemme,
      varsler: req.body.varsler || member.varsler,
      preferanser: req.body.preferanser || member.preferanser,
    };

    await upsertEntity('Members', buildEntity('member', member.rowKey, {
      email,
      role: member.role,
      voice: updated.voice,
    }, updated));

    return successResponse(res, { message: 'Profil oppdatert.' });
  } catch (err) {
    console.error('profil oppdater error:', err);
    return errorResponse(res, 'Kunne ikke oppdatere profil.', 500);
  }
});

module.exports = router;
