const express = require('express');
const router = express.Router();
const { listEntities, getEntity, upsertEntity, deleteEntity, buildEntity } = require('../lib/db');
const { successResponse, errorResponse, validateRequired, generateId, now } = require('../lib/helpers');
const { buildICS } = require('../lib/mailer');

// Styremøter er arrangementer (Events) med synlighet 'styre' — vises kun i
// Styrerommet, filtreres bort fra den medlemsvendte arrangementslista og digesten.
// Knyttes til dokumenter/oppgaver via `anledning` (default = tittel).

const DOC_TYPE = 'styredokument';

function formatMeeting(e, docCount = 0, taskCount = 0) {
  return {
    id: e.id,
    title: e.title || '',
    description: e.description || '',
    date: e.date || '',
    startTime: e.startTime || '',
    endTime: e.endTime || '',
    location: e.location || '',
    anledning: e.anledning || e.title || '',
    createdAt: e.createdAt || '',
    updatedAt: e.updatedAt || '',
    docCount, taskCount,
  };
}

async function relatedCounts() {
  const [files, tasks] = await Promise.all([listEntities('Files'), listEntities('Tasks')]);
  return {
    docs: files.filter(f => f.type === DOC_TYPE),
    tasks,
  };
}

// GET /api/styre/moter — list styre meetings (with related doc/task counts)
router.get('/', async (req, res) => {
  try {
    const events = (await listEntities('Events')).filter(e => e.synlighet === 'styre');
    const { docs, tasks } = await relatedCounts();
    const moter = events.map(e => {
      const anl = e.anledning || e.title || '';
      const docCount = anl ? docs.filter(d => d.anledning === anl).length : 0;
      const taskCount = anl ? tasks.filter(t => t.anledning === anl).length : 0;
      return formatMeeting(e, docCount, taskCount);
    });
    moter.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return res.json({ moter });
  } catch (err) {
    console.error('moter list error:', err);
    return errorResponse(res, 'Kunne ikke hente styremøter.', 500);
  }
});

// GET /api/styre/moter/:id/ics — kalenderfil for møtet
router.get('/:id/ics', async (req, res) => {
  try {
    const e = await getEntity('Events', 'event', req.params.id);
    if (!e || e.synlighet !== 'styre') return errorResponse(res, 'Møte ikke funnet.', 404);
    const ics = buildICS([{
      id: e.id, title: e.title || 'Styremøte', date: e.date || '',
      startTime: e.startTime || '', endTime: e.endTime || '',
      location: e.location || '', description: e.description || '',
    }]);
    if (!ics) return errorResponse(res, 'Møtet mangler dato.', 400);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="styremote.ics"');
    return res.send(ics);
  } catch (err) {
    console.error('mote ics error:', err);
    return errorResponse(res, 'Kunne ikke lage kalenderfil.', 500);
  }
});

// POST /api/styre/moter
router.post('/', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['title', 'date']);
    if (err) return errorResponse(res, err);

    const id = generateId('MOTE');
    const meeting = {
      id,
      title: req.body.title,
      description: req.body.description || '',
      date: req.body.date,
      startTime: req.body.startTime || '',
      endTime: req.body.endTime || '',
      location: req.body.location || '',
      anledning: req.body.anledning || req.body.title,
      authorName: req.body.authorName || '',
      authorEmail: req.body.authorEmail || '',
      attendees: [],
      synlighet: 'styre',
      createdAt: now(),
      updatedAt: now(),
    };
    await upsertEntity('Events', buildEntity('event', id, { date: meeting.date }, meeting));
    return successResponse(res, { id, mote: formatMeeting(meeting) }, 201);
  } catch (err) {
    console.error('mote create error:', err);
    return errorResponse(res, 'Kunne ikke opprette styremøte.', 500);
  }
});

// PATCH /api/styre/moter/:id
router.patch('/:id', async (req, res) => {
  try {
    const e = await getEntity('Events', 'event', req.params.id);
    if (!e || e.synlighet !== 'styre') return errorResponse(res, 'Møte ikke funnet.', 404);

    const allowed = ['title', 'description', 'date', 'startTime', 'endTime', 'location', 'anledning'];
    const updated = { ...e, updatedAt: now(), synlighet: 'styre' };
    for (const key of allowed) if (req.body[key] !== undefined) updated[key] = req.body[key];

    await upsertEntity('Events', buildEntity('event', e.id, { date: updated.date }, updated));
    return successResponse(res, { message: 'Styremøte oppdatert.' });
  } catch (err) {
    console.error('mote update error:', err);
    return errorResponse(res, 'Kunne ikke oppdatere styremøte.', 500);
  }
});

// DELETE /api/styre/moter/:id
router.delete('/:id', async (req, res) => {
  try {
    const e = await getEntity('Events', 'event', req.params.id);
    if (!e || e.synlighet !== 'styre') return errorResponse(res, 'Møte ikke funnet.', 404);
    await deleteEntity('Events', 'event', e.id);
    return successResponse(res, { message: 'Styremøte slettet.' });
  } catch (err) {
    console.error('mote delete error:', err);
    return errorResponse(res, 'Kunne ikke slette styremøte.', 500);
  }
});

module.exports = router;
