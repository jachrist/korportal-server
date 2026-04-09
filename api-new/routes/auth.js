const express = require('express');
const router = express.Router();
const { listEntities, upsertEntity, deleteEntity, buildEntity } = require('../lib/table-client');
const { successResponse, errorResponse, validateRequired, generateId, now } = require('../lib/helpers');
const crypto = require('crypto');

/**
 * POST /api/auth/send-kode
 * Request:  { "email": "user@example.com" }
 * Response: { "success": true }
 * Error:    { "success": false, "error": "E-postadressen er ikke registrert." }
 */
router.post('/send-kode', async (req, res) => {
  try {
    const { email } = req.body;
    const err = validateRequired(req.body, ['email']);
    if (err) return errorResponse(res, err);

    const normalizedEmail = email.toLowerCase().trim();

    // Check if member exists
    const members = await listEntities('Members', {
      filter: `email eq '${normalizedEmail}'`,
    });
    if (members.length === 0) {
      return errorResponse(res, 'E-postadressen er ikke registrert. Kontakt administrator.');
    }

    // Generate 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Store auth code
    const rowKey = generateId();
    await upsertEntity('AuthCodes', buildEntity('authcode', rowKey, {
      email: normalizedEmail,
      expiresAt,
    }, {
      email: normalizedEmail,
      code,
      expiresAt,
      createdAt: now(),
    }));

    // Send email (nodemailer)
    try {
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
        to: normalizedEmail,
        subject: 'Din innloggingskode for Korportal',
        text: `Din kode er: ${code}\n\nKoden er gyldig i 10 minutter.`,
        html: `<p>Din kode er: <strong>${code}</strong></p><p>Koden er gyldig i 10 minutter.</p>`,
      });
    } catch (mailErr) {
      console.error('Kunne ikke sende e-post:', mailErr.message);
      // Still return success — code is stored, can be verified
    }

    return successResponse(res, { message: 'Kode sendt til e-post.' });
  } catch (err) {
    console.error('send-kode error:', err);
    return errorResponse(res, 'Kunne ikke sende kode.', 500);
  }
});

/**
 * POST /api/auth/verifiser-kode
 * Request:  { "email": "user@example.com", "code": "123456" }
 * Response: { "success": true, "member": { id, name, email, role, voice, phone } }
 * Error:    { "success": false, "error": "Feil kode. Prøv igjen." }
 */
router.post('/verifiser-kode', async (req, res) => {
  try {
    const { email, code } = req.body;
    const err = validateRequired(req.body, ['email', 'code']);
    if (err) return errorResponse(res, err);

    const normalizedEmail = email.toLowerCase().trim();

    // Find valid auth code
    const codes = await listEntities('AuthCodes', {
      filter: `email eq '${normalizedEmail}'`,
    });

    const validCode = codes.find(c =>
      c.code === code && new Date(c.expiresAt) > new Date()
    );

    if (!validCode) {
      return errorResponse(res, 'Feil kode. Prøv igjen.');
    }

    // Delete used code
    await deleteEntity('AuthCodes', 'authcode', validCode.rowKey);

    // Fetch member
    const members = await listEntities('Members', {
      filter: `email eq '${normalizedEmail}'`,
    });

    if (members.length === 0) {
      return errorResponse(res, 'Medlem ikke funnet.');
    }

    const member = members[0];
    return successResponse(res, {
      member: {
        id: member.id,
        email: member.email,
        name: member.name,
        voice: member.voice,
        phone: member.phone,
        role: member.role,
      },
    });
  } catch (err) {
    console.error('verifiser-kode error:', err);
    return errorResponse(res, 'Kunne ikke verifisere kode.', 500);
  }
});

module.exports = router;
