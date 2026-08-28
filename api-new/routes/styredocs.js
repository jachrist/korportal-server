const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { listEntities, getEntity, upsertEntity, deleteEntity, buildEntity } = require('../lib/db');
const { successResponse, errorResponse, validateRequired, generateId, now } = require('../lib/helpers');

// Styre-dokumenter lagres i Files-tabellen med type 'styredokument' (egen tolkning
// av metadataene). Musikk-fillogikken i routes/files.js berøres ikke.

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
const fileBaseUrl = process.env.FILE_BASE_URL || 'http://localhost:3001/uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const DOC_TYPE = 'styredokument';

// Søkbare kolonner (Files): behold type + anledning + sortering; resten i jsonData.
function docSearchFields(d) {
  return { type: DOC_TYPE, stemme: '', verk: '', anledning: d.anledning || '', sortering: d.sortering ?? 999, uploaded: d.uploaded ? 1 : 0 };
}

// Entity → API-objekt. includeContent=false utelater den (potensielt store) markdown-teksten.
function formatDoc(item, includeContent = false) {
  const doc = {
    id: item.id,
    tittel: item.tittel || item.navn || '(uten tittel)',
    dokumenttype: item.dokumenttype || 'annet',
    anledning: item.anledning || '',
    dato: item.dato || '',
    forfatter: item.forfatter || '',
    status: item.status || 'utkast',
    format: item.format || 'markdown',
    navn: item.navn || '',
    url: item.url || '',
    uploaded: !!item.uploaded,
    updatedAt: item.updatedAt || item.createdAt || '',
  };
  if (includeContent) doc.contentMd = item.contentMd || '';
  return doc;
}

async function listDocs() {
  const items = await listEntities('Files');
  return items.filter(i => i.type === DOC_TYPE);
}

function safeFileName(name) {
  return String(name || 'fil').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim();
}

// ==========================================================================
// GET /api/styre/dokumenter?anledning=&dokumenttype=&q=
// ==========================================================================
router.get('/', async (req, res) => {
  try {
    const { anledning, dokumenttype, q } = req.query;
    let docs = (await listDocs()).map(d => formatDoc(d, false));

    if (anledning) docs = docs.filter(d => d.anledning === anledning);
    if (dokumenttype) docs = docs.filter(d => d.dokumenttype === dokumenttype);
    if (q) {
      const needle = q.toLowerCase();
      docs = docs.filter(d =>
        [d.tittel, d.dokumenttype, d.anledning, d.forfatter, d.navn]
          .some(v => (v || '').toLowerCase().includes(needle)));
    }

    docs.sort((a, b) => (b.dato || '').localeCompare(a.dato || '') || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return res.json({ dokumenter: docs });
  } catch (err) {
    console.error('styredok list error:', err);
    return errorResponse(res, 'Kunne ikke hente dokumenter.', 500);
  }
});

// GET /api/styre/dokumenter/:id — ett dokument, inkl. markdown-innhold
router.get('/:id', async (req, res) => {
  try {
    const item = await getEntity('Files', 'file', req.params.id);
    if (!item || item.type !== DOC_TYPE) return errorResponse(res, 'Dokument ikke funnet.', 404);
    return res.json({ dokument: formatDoc(item, true) });
  } catch (err) {
    console.error('styredok get error:', err);
    return errorResponse(res, 'Kunne ikke hente dokument.', 500);
  }
});

// POST /api/styre/dokumenter — opprett Markdown-dokument
router.post('/', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['tittel']);
    if (err) return errorResponse(res, err);

    const id = generateId('SDOK');
    const doc = {
      id,
      navn: safeFileName(req.body.tittel),
      tittel: req.body.tittel,
      dokumenttype: req.body.dokumenttype || 'annet',
      anledning: req.body.anledning || '',
      dato: req.body.dato || '',
      forfatter: req.body.forfatter || '',
      status: req.body.status || 'utkast',
      format: 'markdown',
      contentMd: req.body.contentMd || '',
      url: '',
      uploaded: false,
      createdAt: now(),
      updatedAt: now(),
    };
    await upsertEntity('Files', buildEntity('file', id, docSearchFields(doc), doc));
    return successResponse(res, { id, dokument: formatDoc(doc, true) }, 201);
  } catch (err) {
    console.error('styredok create error:', err);
    return errorResponse(res, 'Kunne ikke opprette dokument.', 500);
  }
});

// PATCH /api/styre/dokumenter/:id — oppdater felt/innhold
router.patch('/:id', async (req, res) => {
  try {
    const item = await getEntity('Files', 'file', req.params.id);
    if (!item || item.type !== DOC_TYPE) return errorResponse(res, 'Dokument ikke funnet.', 404);

    const allowed = ['tittel', 'dokumenttype', 'anledning', 'dato', 'forfatter', 'status', 'contentMd'];
    const updated = { ...item, updatedAt: now() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) updated[key] = req.body[key];
    }
    if (req.body.tittel !== undefined && !updated.uploaded) updated.navn = safeFileName(req.body.tittel);

    await upsertEntity('Files', buildEntity('file', item.id, docSearchFields(updated), updated));
    return successResponse(res, { message: 'Dokument oppdatert.' });
  } catch (err) {
    console.error('styredok update error:', err);
    return errorResponse(res, 'Kunne ikke oppdatere dokument.', 500);
  }
});

// DELETE /api/styre/dokumenter/:id
router.delete('/:id', async (req, res) => {
  try {
    const item = await getEntity('Files', 'file', req.params.id);
    if (!item || item.type !== DOC_TYPE) return errorResponse(res, 'Dokument ikke funnet.', 404);
    if (item.uploaded && item.storedName) {
      try { fs.unlinkSync(path.join(uploadDir, item.storedName)); } catch { /* filen kan allerede være borte */ }
    }
    await deleteEntity('Files', 'file', item.id);
    return successResponse(res, { message: 'Dokument slettet.' });
  } catch (err) {
    console.error('styredok delete error:', err);
    return errorResponse(res, 'Kunne ikke slette dokument.', 500);
  }
});

// POST /api/styre/dokumenter/opplasting — last opp Office/PDF (eller nettleser-generert PDF)
// Body: { navn, innhold(base64), tittel?, dokumenttype?, anledning?, dato?, forfatter?, format? }
router.post('/opplasting', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['navn', 'innhold']);
    if (err) return errorResponse(res, err);

    const id = generateId('SDOK');
    const original = safeFileName(req.body.navn);
    const storedName = `${id}-${original}`;              // unikt på disk (ingen kollisjon)
    fs.writeFileSync(path.join(uploadDir, storedName), Buffer.from(req.body.innhold, 'base64'));

    const ext = path.extname(original).toLowerCase().replace('.', '');
    const format = ext === 'pdf' ? 'pdf' : 'office';

    const doc = {
      id,
      navn: original,
      tittel: req.body.tittel || original,
      dokumenttype: req.body.dokumenttype || 'annet',
      anledning: req.body.anledning || '',
      dato: req.body.dato || '',
      forfatter: req.body.forfatter || '',
      status: req.body.status || 'ferdig',
      format,
      contentMd: '',
      storedName,
      url: `${fileBaseUrl}/${encodeURIComponent(storedName)}`,
      uploaded: true,
      createdAt: now(),
      updatedAt: now(),
    };
    await upsertEntity('Files', buildEntity('file', id, docSearchFields(doc), doc));
    return successResponse(res, { id, dokument: formatDoc(doc, false) }, 201);
  } catch (err) {
    console.error('styredok upload error:', err);
    return errorResponse(res, 'Kunne ikke laste opp dokument.', 500);
  }
});

module.exports = router;
