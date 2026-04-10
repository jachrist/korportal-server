const express = require('express');
const router = express.Router();
const { listEntities, getEntity, upsertEntity, deleteEntity, buildEntity } = require('../lib/db');
const { successResponse, errorResponse, validateRequired, generateId, now } = require('../lib/helpers');

/**
 * GET /api/styre/medlemmer
 * Response: [ { id, name, email, phone, voice, role, kontingentBetalt, joinedAt } ]
 */
router.get('/medlemmer', async (req, res) => {
  try {
    const items = await listEntities('Members');

    const members = items.map(item => ({
      id: item.id,
      name: item.name,
      email: item.email,
      phone: item.phone || '',
      voice: item.voice || '',
      role: item.role || 'medlem',
      kontingentBetalt: item.kontingentBetalt || false,
      joinedAt: item.joinedAt || '',
    }));

    members.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return res.json(members);
  } catch (err) {
    console.error('styre medlemmer error:', err);
    return errorResponse(res, 'Kunne ikke hente medlemmer.', 500);
  }
});

/**
 * POST /api/styre/registrer
 * Request: { name, email, phone, voice, role, kontingentBetalt }
 * Response: { success: true, id }
 */
router.post('/registrer', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['name', 'email']);
    if (err) return errorResponse(res, err);

    const { name, email, phone, voice, role, kontingentBetalt } = req.body;
    const id = generateId('MBR');
    const normalizedEmail = email.toLowerCase().trim();

    const member = {
      id,
      name,
      email: normalizedEmail,
      phone: phone || '',
      voice: voice || '',
      role: role || 'medlem',
      kontingentBetalt: kontingentBetalt || false,
      joinedAt: now(),
    };

    await upsertEntity('Members', buildEntity('member', id, {
      email: normalizedEmail,
      role: member.role,
      voice: member.voice,
    }, member));

    return successResponse(res, { id }, 201);
  } catch (err) {
    console.error('styre registrer error:', err);
    return errorResponse(res, 'Kunne ikke registrere medlem.', 500);
  }
});

/**
 * POST /api/styre/oppdater
 * Request: { memberId, name, email, phone, voice, role, kontingentBetalt }
 * Response: { success: true }
 */
router.post('/oppdater', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['memberId']);
    if (err) return errorResponse(res, err);

    const { memberId, ...fields } = req.body;
    const entity = await getEntity('Members', 'member', memberId);
    if (!entity) return errorResponse(res, 'Medlem ikke funnet.', 404);

    const updated = { ...entity, ...fields };
    if (fields.email) updated.email = fields.email.toLowerCase().trim();

    await upsertEntity('Members', buildEntity('member', memberId, {
      email: updated.email,
      role: updated.role,
      voice: updated.voice,
    }, updated));

    return successResponse(res, { message: 'Medlem oppdatert.' });
  } catch (err) {
    console.error('styre oppdater error:', err);
    return errorResponse(res, 'Kunne ikke oppdatere medlem.', 500);
  }
});

/**
 * POST /api/styre/slett
 * Request: { memberId }
 * Response: { success: true }
 */
router.post('/slett', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['memberId']);
    if (err) return errorResponse(res, err);

    await deleteEntity('Members', 'member', req.body.memberId);
    return successResponse(res, { message: 'Medlem slettet.' });
  } catch (err) {
    console.error('styre slett error:', err);
    return errorResponse(res, 'Kunne ikke slette medlem.', 500);
  }
});

/**
 * POST /api/styre/send-epost
 * Request: { recipients: ["email1", "email2"], subject, message }
 * Response: { success: true }
 */
router.post('/send-epost', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['recipients', 'subject', 'message']);
    if (err) return errorResponse(res, err);

    const { recipients, subject, message } = req.body;

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: recipients.join(', '),
      subject,
      text: message,
      html: message.replace(/\n/g, '<br>'),
    });

    return successResponse(res, { message: 'E-post sendt.' });
  } catch (err) {
    console.error('send-epost error:', err);
    return errorResponse(res, 'Kunne ikke sende e-post.', 500);
  }
});

module.exports = router;
