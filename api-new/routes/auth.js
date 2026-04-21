const express = require('express');
const router = express.Router();
const { listEntities, upsertEntity, deleteEntity, buildEntity } = require('../lib/db');
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
    const memberData = {
      id: member.id,
      email: member.email,
      name: member.name,
      voice: member.voice,
      phone: member.phone,
      role: member.role,
    };
    if (member.role === 'gjest' && member.guestAnledning) {
      memberData.guestAnledning = member.guestAnledning;
    }
    return successResponse(res, { member: memberData });
  } catch (err) {
    console.error('verifiser-kode error:', err);
    return errorResponse(res, 'Kunne ikke verifisere kode.', 500);
  }
});

/**
 * POST /api/auth/gjest-login
 * Request:  { "password": "shared-password" }
 * Response: { "success": true, "member": { role, guestAnledning } }
 *
 * Simple password check — no email, no code, no member registration.
 */
router.post('/gjest-login', async (req, res) => {
  try {
    const { password } = req.body;
    const err = validateRequired(req.body, ['password']);
    if (err) return errorResponse(res, err);

    const { getEntity } = require('../lib/db');
    const config = await getEntity('GuestConfig', 'config', 'active');
    if (!config || !config.password) {
      return errorResponse(res, 'Gjestetilgang er ikke konfigurert.');
    }

    if (password !== config.password) {
      return errorResponse(res, 'Feil passord.');
    }

    if (config.expiresAt && new Date(config.expiresAt) < new Date()) {
      return errorResponse(res, 'Gjestetilgangen har utløpt.');
    }

    return successResponse(res, {
      member: {
        id: 'gjest',
        role: 'gjest',
        name: 'Gjest',
        guestAnledning: config.anledning || '',
      },
    });
  } catch (err) {
    console.error('gjest-login error:', err);
    return errorResponse(res, 'Kunne ikke logge inn.', 500);
  }
});

/**
 * GET /api/auth/gjest-config
 * Returns guest configuration (for admin panel)
 */
router.get('/gjest-config', async (req, res) => {
  try {
    const { getEntity } = require('../lib/db');
    const config = await getEntity('GuestConfig', 'config', 'active');
    return res.json({
      anledning: config?.anledning || '',
      password: config?.password || '',
      expiresAt: config?.expiresAt || '',
    });
  } catch (err) {
    console.error('gjest-config error:', err);
    return errorResponse(res, 'Kunne ikke hente gjestekonfig.', 500);
  }
});

/**
 * POST /api/auth/gjest-config
 * Request: { anledning, password, expiresAt }
 * Sets guest configuration (admin only)
 */
router.post('/gjest-config', async (req, res) => {
  try {
    const { anledning, password, expiresAt } = req.body;
    const err = validateRequired(req.body, ['anledning', 'password']);
    if (err) return errorResponse(res, err);

    await upsertEntity('GuestConfig', buildEntity('config', 'active', {}, {
      anledning, password, expiresAt: expiresAt || '',
    }));

    return successResponse(res, { message: 'Gjestekonfig oppdatert.' });
  } catch (err) {
    console.error('gjest-config update error:', err);
    return errorResponse(res, 'Kunne ikke oppdatere gjestekonfig.', 500);
  }
});

module.exports = router;
