const express = require('express');
const router = express.Router();
const { listEntities, getEntity, upsertEntity, deleteEntity, buildEntity } = require('../lib/db');
const { successResponse, errorResponse, validateRequired, generateId, now } = require('../lib/helpers');
const { createTransporter, renderTaskAssigned } = require('../lib/mailer');

// Send tildeling-varsel til ansvarlig (ikke-blokkerende — feiler aldri forespørselen).
async function notifyAssigned(task) {
  if (!task.ansvarligEmail) return;
  try {
    const transporter = createTransporter();
    if (!transporter) return;
    await transporter.sendMail(renderTaskAssigned({ task }));
  } catch (err) {
    console.error(`Oppgave-tildeling: kunne ikke varsle ${task.ansvarligEmail}:`, err.message);
  }
}

// Oppgaver for styret. Hybrid-modellen (Files/Events-mønster): søkbare kolonner
// + jsonData. Statuser: 'åpen' | 'pågår' | 'ferdig'.

const STATUSES = ['åpen', 'pågår', 'ferdig'];

function taskSearchFields(d) {
  return {
    anledning: d.anledning || '',
    status: d.status || 'åpen',
    frist: d.frist || '',
    ansvarligEmail: d.ansvarligEmail || '',
  };
}

function formatTask(t) {
  return {
    id: t.id,
    tittel: t.tittel || '',
    beskrivelse: t.beskrivelse || '',
    anledning: t.anledning || '',
    frist: t.frist || '',
    ansvarligId: t.ansvarligId || '',
    ansvarligNavn: t.ansvarligNavn || '',
    ansvarligEmail: t.ansvarligEmail || '',
    status: t.status || 'åpen',
    createdAt: t.createdAt || '',
    updatedAt: t.updatedAt || '',
    completedAt: t.completedAt || '',
  };
}

// GET /api/oppgaver?anledning=&status=&ansvarligEmail=
router.get('/', async (req, res) => {
  try {
    let items = (await listEntities('Tasks')).map(formatTask);
    const { anledning, status, ansvarligEmail } = req.query;
    if (anledning) items = items.filter(t => t.anledning === anledning);
    if (status) items = items.filter(t => t.status === status);
    if (ansvarligEmail) items = items.filter(t => t.ansvarligEmail === ansvarligEmail);

    // Sorter: uferdige først, deretter etter frist (tomme frister sist)
    items.sort((a, b) => {
      const af = a.status === 'ferdig', bf = b.status === 'ferdig';
      if (af !== bf) return af ? 1 : -1;
      return (a.frist || '9999').localeCompare(b.frist || '9999');
    });
    return res.json({ oppgaver: items });
  } catch (err) {
    console.error('oppgaver list error:', err);
    return errorResponse(res, 'Kunne ikke hente oppgaver.', 500);
  }
});

// POST /api/oppgaver
router.post('/', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['tittel']);
    if (err) return errorResponse(res, err);

    const id = generateId('OPPG');
    const status = STATUSES.includes(req.body.status) ? req.body.status : 'åpen';
    const task = {
      id,
      tittel: req.body.tittel,
      beskrivelse: req.body.beskrivelse || '',
      anledning: req.body.anledning || '',
      frist: req.body.frist || '',
      ansvarligId: req.body.ansvarligId || '',
      ansvarligNavn: req.body.ansvarligNavn || '',
      ansvarligEmail: req.body.ansvarligEmail || '',
      status,
      createdAt: now(),
      updatedAt: now(),
      completedAt: status === 'ferdig' ? now() : '',
    };
    await upsertEntity('Tasks', buildEntity('task', id, taskSearchFields(task), task));
    await notifyAssigned(task);
    return successResponse(res, { id, oppgave: formatTask(task) }, 201);
  } catch (err) {
    console.error('oppgave create error:', err);
    return errorResponse(res, 'Kunne ikke opprette oppgave.', 500);
  }
});

// PATCH /api/oppgaver/:id
router.patch('/:id', async (req, res) => {
  try {
    const entity = await getEntity('Tasks', 'task', req.params.id);
    if (!entity) return errorResponse(res, 'Oppgave ikke funnet.', 404);

    const allowed = ['tittel', 'beskrivelse', 'anledning', 'frist', 'ansvarligId', 'ansvarligNavn', 'ansvarligEmail', 'status'];
    const updated = { ...entity, updatedAt: now() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) updated[key] = req.body[key];
    }
    if (req.body.status !== undefined) {
      if (!STATUSES.includes(updated.status)) updated.status = entity.status;
      // Sett/nullstill fullført-tidspunkt når status endres til/fra ferdig
      if (updated.status === 'ferdig' && entity.status !== 'ferdig') updated.completedAt = now();
      if (updated.status !== 'ferdig') updated.completedAt = '';
    }

    await upsertEntity('Tasks', buildEntity('task', entity.id, taskSearchFields(updated), updated));
    // Varsle ny ansvarlig hvis oppgaven ble tildelt (eller ny person)
    if (req.body.ansvarligEmail && updated.ansvarligEmail && updated.ansvarligEmail !== entity.ansvarligEmail) {
      await notifyAssigned(updated);
    }
    return successResponse(res, { message: 'Oppgave oppdatert.', oppgave: formatTask(updated) });
  } catch (err) {
    console.error('oppgave update error:', err);
    return errorResponse(res, 'Kunne ikke oppdatere oppgave.', 500);
  }
});

// DELETE /api/oppgaver/:id
router.delete('/:id', async (req, res) => {
  try {
    await deleteEntity('Tasks', 'task', req.params.id);
    return successResponse(res, { message: 'Oppgave slettet.' });
  } catch (err) {
    console.error('oppgave delete error:', err);
    return errorResponse(res, 'Kunne ikke slette oppgave.', 500);
  }
});

module.exports = router;
