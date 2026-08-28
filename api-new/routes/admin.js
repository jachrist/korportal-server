const express = require('express');
const router = express.Router();
const { db, listEntities, getEntity, upsertEntity, deleteEntity, buildEntity } = require('../lib/db');
const { successResponse, errorResponse } = require('../lib/helpers');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

/**
 * GET /api/admin/tables
 * Returns list of all tables with row counts
 */
router.get('/tables', async (req, res) => {
  try {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all();

    const result = tables.map(t => {
      const count = db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get();
      return { name: t.name, rows: count.count };
    });

    return res.json(result);
  } catch (err) {
    console.error('admin tables error:', err);
    return errorResponse(res, 'Kunne ikke hente tabeller.', 500);
  }
});

/**
 * GET /api/admin/tables/:table
 * Returns all rows from a table (parsed from jsonData)
 */
router.get('/tables/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const count = db.prepare(`SELECT COUNT(*) as count FROM "${table}"`).get();
    const rows = db.prepare(`SELECT * FROM "${table}" LIMIT ? OFFSET ?`).all(limit, offset);

    const parsed = rows.map(row => {
      let data = {};
      if (row.jsonData) {
        try { data = JSON.parse(row.jsonData); } catch { data = {}; }
      }
      return { id: row.id, partitionKey: row.partitionKey, ...data };
    });

    return res.json({ table, total: count.count, limit, offset, rows: parsed });
  } catch (err) {
    console.error('admin table rows error:', err);
    return errorResponse(res, 'Kunne ikke hente rader.', 500);
  }
});

/**
 * GET /api/admin/tables/:table/:id
 * Returns a single row by ID
 */
router.get('/tables/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const row = db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id);
    if (!row) return errorResponse(res, 'Rad ikke funnet.', 404);

    let data = {};
    if (row.jsonData) {
      try { data = JSON.parse(row.jsonData); } catch { data = {}; }
    }

    return res.json({ id: row.id, partitionKey: row.partitionKey, ...data, _raw: row });
  } catch (err) {
    console.error('admin table row error:', err);
    return errorResponse(res, 'Kunne ikke hente rad.', 500);
  }
});

/**
 * POST /api/admin/tables/:table
 * Create or update a row. Body: { id, partitionKey, ...fields }
 */
router.post('/tables/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const { id, partitionKey, ...fields } = req.body;

    if (!id) return errorResponse(res, 'ID er påkrevd.');

    // Use provided partitionKey, or detect from existing rows, or fall back to table name
    let pk = partitionKey;
    if (!pk) {
      const existing = db.prepare(`SELECT partitionKey FROM "${table}" LIMIT 1`).get();
      pk = existing?.partitionKey || table.toLowerCase();
    }
    await upsertEntity(table, buildEntity(pk, id, {}, { id, ...fields }));

    return successResponse(res, { message: 'Rad lagret.', id });
  } catch (err) {
    console.error('admin table upsert error:', err);
    return errorResponse(res, 'Kunne ikke lagre rad.', 500);
  }
});

/**
 * DELETE /api/admin/tables/:table/:id
 * Delete a row by ID
 */
router.delete('/tables/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const row = db.prepare(`SELECT partitionKey FROM "${table}" WHERE id = ?`).get(id);
    if (!row) return errorResponse(res, 'Rad ikke funnet.', 404);

    await deleteEntity(table, row.partitionKey, id);
    return successResponse(res, { message: 'Rad slettet.' });
  } catch (err) {
    console.error('admin table delete error:', err);
    return errorResponse(res, 'Kunne ikke slette rad.', 500);
  }
});

/**
 * GET /api/admin/disk
 * Returns disk usage information
 */
router.get('/disk', async (req, res) => {
  try {
    // Disk usage
    let diskInfo = {};
    try {
      const dfOutput = execSync("df -h / | tail -1").toString().trim();
      const parts = dfOutput.split(/\s+/);
      diskInfo = {
        filesystem: parts[0],
        size: parts[1],
        used: parts[2],
        available: parts[3],
        usePercent: parts[4],
      };
    } catch { diskInfo = { error: 'Kunne ikke hente diskinfo' }; }

    // Upload directory size
    let uploadsSize = '0';
    let uploadsCount = 0;
    try {
      uploadsSize = execSync(`du -sh "${uploadDir}" | cut -f1`).toString().trim();
      uploadsCount = parseInt(execSync(`find "${uploadDir}" -type f | wc -l`).toString().trim()) || 0;
    } catch { /* ignore */ }

    // Database size
    let dbSize = '0';
    try {
      const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'data', 'korportal.db');
      const stat = fs.statSync(dbPath);
      dbSize = (stat.size / (1024 * 1024)).toFixed(1) + ' MB';
    } catch { /* ignore */ }

    return res.json({
      disk: diskInfo,
      uploads: { size: uploadsSize, fileCount: uploadsCount, path: uploadDir },
      database: { size: dbSize },
    });
  } catch (err) {
    console.error('admin disk error:', err);
    return errorResponse(res, 'Kunne ikke hente diskinfo.', 500);
  }
});

/**
 * POST /api/admin/import-events
 * Import events from CSV data
 * CSV columns: title, date, startTime, endTime, location, description
 * Multiple dates can be separated with semicolons in the date field
 */
router.post('/import-events', async (req, res) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return errorResponse(res, 'Ingen rader å importere.');
    }

    let created = 0;
    for (const row of rows) {
      if (!row.title || !row.date) continue;

      const dates = row.date.split(';').map(d => d.trim()).filter(Boolean);
      for (const date of dates) {
        const id = require('../lib/helpers').generateId('EVT');
        const event = {
          id,
          title: row.title,
          date,
          startTime: row.startTime || '',
          endTime: row.endTime || '',
          location: row.location || '',
          description: row.description || '',
          attendees: [],
          createdAt: new Date().toISOString(),
        };

        await upsertEntity('Events', buildEntity('event', id, { date }, event));
        created++;
      }
    }

    return successResponse(res, { message: `${created} arrangement importert.`, created });
  } catch (err) {
    console.error('import events error:', err);
    return errorResponse(res, 'Kunne ikke importere arrangementer.', 500);
  }
});

/**
 * POST /api/admin/smtp-test
 * Diagnostiserer e-postoppsettet: verifiserer SMTP-tilkoblingen og (valgfritt)
 * sender en test-e-post. Returnerer den faktiske SMTP-feilen ved problemer.
 * Body: { to?: "din@epost.no" }
 */
router.post('/smtp-test', async (req, res) => {
  const { createTransporter } = require('../lib/mailer');
  const transporter = createTransporter();
  if (!transporter) {
    return res.json({ ok: false, stage: 'config', message: 'SMTP er ikke konfigurert (mangler SMTP_HOST/SMTP_USER).' });
  }

  try {
    await transporter.verify();
  } catch (err) {
    return res.json({ ok: false, stage: 'verify', code: err.code, responseCode: err.responseCode, message: err.message });
  }

  const to = req.body && req.body.to;
  if (!to) {
    return res.json({ ok: true, stage: 'verify', message: 'SMTP-tilkobling OK. Send { "to": "din@epost" } for å teste faktisk utsending.' });
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject: 'Korportal SMTP-test',
      text: 'Dette er en test-e-post fra Korportal. Kommer denne frem, fungerer e-postoppsettet.',
    });
    return res.json({ ok: true, stage: 'send', to, message: 'Test-e-post sendt.' });
  } catch (err) {
    return res.json({ ok: false, stage: 'send', code: err.code, responseCode: err.responseCode, message: err.message });
  }
});

/**
 * POST /api/admin/send-varsler
 * Kjør den daglige medlemsvarslingen manuelt (f.eks. for testing).
 * Query/body: force=true  → bruk 24t-vindu og ikke oppdater «siste kjøring».
 * Response: { success: true, result: { ... } }
 */
router.post('/send-varsler', async (req, res) => {
  try {
    const { runDailyDigest } = require('../lib/notifications');
    const force = req.query.force === 'true' || req.body?.force === true;
    const result = await runDailyDigest({ force });
    return successResponse(res, { result });
  } catch (err) {
    console.error('send-varsler error:', err);
    return errorResponse(res, 'Kunne ikke sende varsler.', 500);
  }
});

/**
 * POST /api/admin/send-oppgavevarsler
 * Kjør frist-påminnelser for oppgaver manuelt. `?dry-run=true` viser hvem som
 * ville fått påminnelse uten å sende (og uten å sette «påminnet»-flagg).
 */
router.post('/send-oppgavevarsler', async (req, res) => {
  try {
    const { runTaskReminders } = require('../lib/notifications');
    const dryRun = req.query['dry-run'] === 'true' || req.body?.dryRun === true;
    const result = await runTaskReminders({ dryRun });
    return successResponse(res, { result });
  } catch (err) {
    console.error('send-oppgavevarsler error:', err);
    return errorResponse(res, 'Kunne ikke sende oppgavevarsler.', 500);
  }
});

module.exports = router;
