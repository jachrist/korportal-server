/**
 * Shared mail transport + ticket-email template renderer.
 * createTransporter() returns null if SMTP isn't configured so callers can skip.
 */

const fs = require('fs');
const path = require('path');

const ASSETS_DIR = process.env.FRONTEND_ASSETS_DIR ||
  path.join(__dirname, '..', '..', 'assets');

function createTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  const nodemailer = require('nodemailer');
  const port = parseInt(process.env.SMTP_PORT) || 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port !== 587,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function formatNorskDato(isoDate) {
  if (!isoDate) return '';
  const m = ['januar', 'februar', 'mars', 'april', 'mai', 'juni',
             'juli', 'august', 'september', 'oktober', 'november', 'desember'];
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return `${d.getDate()}. ${m[d.getMonth()]} ${d.getFullYear()}`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let ticketTemplateCache = null;
let logoCache = null;

function loadTicketTemplate() {
  if (ticketTemplateCache) return ticketTemplateCache;
  ticketTemplateCache = fs.readFileSync(
    path.join(ASSETS_DIR, 'email-ticket.html'),
    'utf8'
  );
  return ticketTemplateCache;
}

function loadLogo() {
  if (logoCache) return logoCache;
  logoCache = fs.readFileSync(
    path.join(ASSETS_DIR, 'icons', 'utsikten-logo.png')
  );
  return logoCache;
}

async function renderTicketEmail({ reservation, concert }) {
  const QRCode = require('qrcode');
  const ref = reservation.referenceNumber || reservation.ticketId || reservation.id;
  const qrBuffer = await QRCode.toBuffer(String(ref), {
    width: 360,
    margin: 1,
    errorCorrectionLevel: 'M',
  });

  const title = concert?.title || 'konsert';
  const dato = formatNorskDato(concert?.date);
  const tid = concert?.time || '';
  const sted = concert?.location || '';
  const count = reservation.ticketCount || 1;
  const total = reservation.totalPrice || 0;

  const html = loadTicketTemplate()
    .replace('src="/assets/icons/utsikten-logo.png"', 'src="cid:utsikten-logo"')
    .replace(/{{CONCERT_TITLE}}/g, escapeHtml(title))
    .replace(/{{CONCERT_DATE}}/g, escapeHtml(dato))
    .replace(/{{CONCERT_TIME}}/g, escapeHtml(tid))
    .replace(/{{CONCERT_LOCATION}}/g, escapeHtml(sted))
    .replace(/{{TICKET_HOLDER_NAME}}/g, escapeHtml(reservation.name))
    .replace(/{{TICKET_COUNT}}/g, escapeHtml(count))
    .replace(/{{TOTAL_PRICE}}/g, escapeHtml(total))
    .replace(/{{REFERENCE_NUMBER}}/g, escapeHtml(ref))
    .replace(/{{QR_CODE_URL}}/g, 'cid:ticket-qr');

  const datoTid = [dato, tid].filter(Boolean).join(' kl. ');
  const text =
    `Hei ${reservation.name},\n\n` +
    `Vi har registrert betalingen din. Velkommen til konserten!\n\n` +
    `Konsert: ${title}\n` +
    (datoTid ? `Tid: ${datoTid}\n` : '') +
    (sted ? `Sted: ${sted}\n` : '') +
    `Antall billetter: ${count}\n` +
    `Totalsum: ${total} kr\n` +
    `Referansenummer: ${ref}\n\n` +
    `Vis denne e-posten ved inngangen — QR-koden/referansenummeret gjelder som billett.\n\n` +
    `Vennlig hilsen\nKammerkoret Utsikten`;

  return {
    from: process.env.SMTP_FROM,
    to: reservation.email,
    subject: `Din billett: ${title}`,
    text,
    html,
    attachments: [
      { filename: 'utsikten-logo.png', content: loadLogo(), cid: 'utsikten-logo' },
      { filename: 'billett-qr.png', content: qrBuffer, cid: 'ticket-qr' },
    ],
  };
}

// ---------- iCal (.ics) ----------

function escapeICS(str) {
  return String(str ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Bryt lange linjer til ~75 tegn (RFC 5545), fortsettelse med ledende mellomrom.
function foldICS(line) {
  if (line.length <= 75) return line;
  let out = line.slice(0, 75);
  let rest = line.slice(75);
  while (rest.length > 74) {
    out += '\r\n ' + rest.slice(0, 74);
    rest = rest.slice(74);
  }
  return out + '\r\n ' + rest;
}

function icsStampUTC(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
         `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

// "2026-06-14" + "18:00" → "20260614T180000" (flytende lokal tid)
function icsLocalDateTime(date, time) {
  const d = date.replace(/-/g, '');
  const hhmm = (time || '').replace(/[^\d]/g, '').padEnd(4, '0').slice(0, 4);
  return `${d}T${hhmm}00`;
}

function buildVEvent(ev, dtstampUTC) {
  const dateCompact = ev.date.replace(/-/g, '');
  const lines = [
    'BEGIN:VEVENT',
    `UID:${ev.id || dateCompact}-${dateCompact}@kammerkoretutsikten.no`,
    `DTSTAMP:${dtstampUTC}`,
  ];
  if (ev.startTime) {
    lines.push(`DTSTART:${icsLocalDateTime(ev.date, ev.startTime)}`);
    if (ev.endTime) lines.push(`DTEND:${icsLocalDateTime(ev.date, ev.endTime)}`);
    else lines.push('DURATION:PT1H');
  } else {
    lines.push(`DTSTART;VALUE=DATE:${dateCompact}`); // heldags (1 dag som default)
  }
  lines.push(`SUMMARY:${escapeICS(ev.title)}`);
  if (ev.location) lines.push(`LOCATION:${escapeICS(ev.location)}`);
  if (ev.description) lines.push(`DESCRIPTION:${escapeICS(ev.description)}`);
  lines.push('END:VEVENT');
  return lines;
}

// Bygg en VCALENDAR med alle arrangementene. Returnerer null hvis ingen gyldige.
function buildICS(events) {
  const valid = (events || []).filter(ev => ev && ev.date);
  if (valid.length === 0) return null;
  const dtstamp = icsStampUTC(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kammerkoret Utsikten//Korportal//NO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const ev of valid) lines.push(...buildVEvent(ev, dtstamp));
  lines.push('END:VCALENDAR');
  return lines.map(foldICS).join('\r\n') + '\r\n';
}

/**
 * Bygger en daglig oppsummerings-e-post ("digest") til ett medlem.
 * @param {object} p
 * @param {object} p.member    - medlemsrad (name/navn, email/epost)
 * @param {Array}  p.sections  - [ { label, items: [ { title, isNew, calendar? } ] } ]
 * @returns nodemailer-melding med logo (cid) + evt. arrangementer.ics som vedlegg
 */
function renderMemberDigest({ member, sections }) {
  const siteUrl = (process.env.SITE_URL || 'https://www.kammerkoretutsikten.no').replace(/\/+$/, '');
  const name = member.name || member.navn || '';
  const greeting = name ? `Hei ${name.split(' ')[0]},` : 'Hei,';

  // Arrangementer med gyldig dato → iCal-vedlegg
  const calendarEvents = sections
    .flatMap(s => s.items)
    .map(it => it && it.calendar)
    .filter(ev => ev && ev.date);
  const icsContent = buildICS(calendarEvents);

  // Kort oppsummering til emnefelt: "2 meldinger, 1 innlegg"
  const summary = sections
    .map(s => `${s.items.length} ${s.items.length === 1 ? s.singular : s.label.toLowerCase()}`)
    .join(', ');
  const subject = `Nytt i Korportalen – ${summary}`;

  // --- HTML ---
  const sectionHtml = sections.map(s => {
    const rows = s.items.map(it => {
      const tag = it.isNew ? 'Ny' : 'Oppdatert';
      const tagColor = it.isNew ? '#5dd6ff' : '#ffcf5d';
      const titleHtml = it.url
        ? `<a href="${escapeHtml(it.url)}" style="font-size:15px;font-weight:600;color:#eaf0ff;text-decoration:none;">${escapeHtml(it.title)}</a>`
        : `<span style="font-size:15px;font-weight:600;color:#eaf0ff;">${escapeHtml(it.title)}</span>`;
      const metaBits = [it.meta, it.author ? `av ${it.author}` : '']
        .filter(Boolean).map(escapeHtml).join(' &middot; ');
      const metaHtml = metaBits
        ? `<div style="margin:4px 0 0;font-size:12px;color:rgba(234,240,255,0.55);">${metaBits}</div>` : '';
      const excerptHtml = it.excerpt
        ? `<div style="margin:5px 0 0;font-size:13px;line-height:1.5;color:rgba(234,240,255,0.75);">${escapeHtml(it.excerpt)}</div>` : '';
      return (
        `<tr><td style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">` +
          `<span style="display:inline-block;font-size:10px;font-weight:700;` +
          `text-transform:uppercase;letter-spacing:0.6px;color:${tagColor};padding-right:8px;">${tag}</span>` +
          titleHtml + metaHtml + excerptHtml +
        `</td></tr>`
      );
    }).join('');
    const calHint = s.items.some(it => it.calendar && it.calendar.date)
      ? `<p style="margin:8px 0 0;font-size:12px;color:rgba(234,240,255,0.55);">📅 Arrangementene er lagt ved som kalenderfil (.ics) — åpne vedlegget for å legge dem i kalenderen.</p>`
      : '';
    return (
      `<tr><td style="padding:0 24px 20px;">` +
        `<p style="margin:0 0 8px;font-size:13px;font-weight:600;text-transform:uppercase;` +
        `letter-spacing:0.5px;color:rgba(234,240,255,0.60);">${escapeHtml(s.label)}</p>` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
        `style="background-color:rgba(93,214,255,0.05);border:1px solid rgba(93,214,255,0.15);border-radius:12px;">` +
        rows +
        `</table>` +
        calHint +
      `</td></tr>`
    );
  }).join('');

  const html =
    `<!DOCTYPE html><html lang="no"><head><meta charset="UTF-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1.0"></head>` +
    `<body style="margin:0;padding:0;background-color:#0b1220;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0b1220;"><tr>` +
    `<td align="center" style="padding:24px 16px;">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" ` +
    `style="max-width:600px;width:100%;background-color:#101828;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.10);">` +
    `<tr><td align="center" style="padding:32px 24px 8px;background-color:#0d1422;">` +
    `<img src="cid:utsikten-logo" alt="Kammerkoret Utsikten" width="64" height="64" ` +
    `style="display:block;border:0;width:64px;height:64px;border-radius:12px;"></td></tr>` +
    `<tr><td align="center" style="padding:8px 24px 24px;background-color:#0d1422;">` +
    `<h1 style="margin:0;font-size:22px;font-weight:700;color:#eaf0ff;line-height:1.3;">Nytt siden sist</h1>` +
    `<p style="margin:8px 0 0;font-size:15px;color:rgba(234,240,255,0.60);">${escapeHtml(greeting)} her er oppdateringene fra Korportalen.</p>` +
    `</td></tr>` +
    sectionHtml +
    `<tr><td align="center" style="padding:4px 24px 32px;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td align="center" style="background-color:#5dd6ff;border-radius:10px;">` +
    `<a href="${siteUrl}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#0b1220;text-decoration:none;border-radius:10px;">Gå til Korportalen</a>` +
    `</td></tr></table></td></tr>` +
    `<tr><td style="padding:20px 24px;background-color:#0d1422;border-top:1px solid rgba(255,255,255,0.10);text-align:center;">` +
    `<p style="margin:0;font-size:13px;color:rgba(234,240,255,0.40);line-height:1.5;">Kammerkoret Utsikten<br>` +
    `<a href="https://www.kammerkoretutsikten.no" style="color:#5dd6ff;text-decoration:none;">kammerkoretutsikten.no</a></p>` +
    `<p style="margin:12px 0 0;font-size:12px;color:rgba(234,240,255,0.25);">` +
    `Du mottar denne e-posten fordi du har slått på varsler i Min profil. Du kan skru dem av der.</p>` +
    `</td></tr></table></td></tr></table></body></html>`;

  // --- Ren tekst ---
  const text =
    `${greeting}\n\nNytt siden sist i Korportalen:\n\n` +
    sections.map(s =>
      `${s.label}:\n` + s.items.map(it => {
        const metaBits = [it.meta, it.author ? `av ${it.author}` : ''].filter(Boolean).join(' · ');
        return `  • [${it.isNew ? 'Ny' : 'Oppdatert'}] ${it.title}` +
          (metaBits ? `\n    ${metaBits}` : '') +
          (it.excerpt ? `\n    ${it.excerpt}` : '') +
          (it.url ? `\n    ${it.url}` : '');
      }).join('\n\n')
    ).join('\n\n') +
    (icsContent ? `\n\n📅 Arrangementene er lagt ved som kalenderfil (arrangementer.ics).` : '') +
    `\n\nGå til Korportalen: ${siteUrl}\n\n` +
    `Du mottar denne e-posten fordi du har slått på varsler i Min profil.\n` +
    `Vennlig hilsen\nKammerkoret Utsikten`;

  const attachments = [
    { filename: 'utsikten-logo.png', content: loadLogo(), cid: 'utsikten-logo' },
  ];
  if (icsContent) {
    attachments.push({
      filename: 'arrangementer.ics',
      content: icsContent,
      contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
    });
  }

  return {
    from: process.env.SMTP_FROM,
    to: member.email || member.epost,
    subject,
    text,
    html,
    attachments,
  };
}

// ---------- Oppgave-e-poster (Styrerom) ----------

const STYRE_SITE = () => (process.env.SITE_URL || 'https://www.kammerkoretutsikten.no').replace(/\/+$/, '');

// Frister som heldags kalenderoppføringer (til .ics-vedlegg)
function taskDeadlineEvents(tasks) {
  return (tasks || []).filter(t => t.frist).map(t => ({
    id: `task-${t.id}`,
    title: `Frist: ${t.tittel}`,
    date: t.frist,
    startTime: '', endTime: '',
    location: t.anledning || '',
    description: t.beskrivelse || '',
  }));
}

function taskRow(t, badge) {
  const meta = [
    badge ? `<span style="color:#ffcf5d;font-weight:700">${escapeHtml(badge)}</span>` : '',
    t.frist ? `Frist ${escapeHtml(formatNorskDato(t.frist))}` : '',
    t.anledning ? escapeHtml(t.anledning) : '',
  ].filter(Boolean).join(' &middot; ');
  return `<tr><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">` +
    `<div style="font-size:15px;font-weight:600;color:#eaf0ff;">${escapeHtml(t.tittel)}</div>` +
    (meta ? `<div style="margin:3px 0 0;font-size:12px;color:rgba(234,240,255,0.6);">${meta}</div>` : '') +
    (t.beskrivelse ? `<div style="margin:4px 0 0;font-size:13px;color:rgba(234,240,255,0.75);">${escapeHtml(t.beskrivelse)}</div>` : '') +
    `</td></tr>`;
}

function taskEmailHtml({ heading, intro, rowsHtml }) {
  const siteUrl = STYRE_SITE();
  return `<!DOCTYPE html><html lang="no"><head><meta charset="UTF-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1.0"></head>` +
    `<body style="margin:0;padding:0;background-color:#0b1220;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0b1220;"><tr>` +
    `<td align="center" style="padding:24px 16px;">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#101828;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.10);">` +
    `<tr><td align="center" style="padding:32px 24px 8px;background-color:#0d1422;">` +
    `<img src="cid:utsikten-logo" alt="Kammerkoret Utsikten" width="64" height="64" style="display:block;border:0;width:64px;height:64px;border-radius:12px;"></td></tr>` +
    `<tr><td align="center" style="padding:8px 24px 20px;background-color:#0d1422;">` +
    `<h1 style="margin:0;font-size:22px;font-weight:700;color:#eaf0ff;">${escapeHtml(heading)}</h1>` +
    `<p style="margin:8px 0 0;font-size:15px;color:rgba(234,240,255,0.6);">${escapeHtml(intro)}</p></td></tr>` +
    `<tr><td style="padding:0 24px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
    `style="background-color:rgba(93,214,255,0.05);border:1px solid rgba(93,214,255,0.15);border-radius:12px;">${rowsHtml}</table></td></tr>` +
    `<tr><td align="center" style="padding:4px 24px 32px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td align="center" style="background-color:#5dd6ff;border-radius:10px;">` +
    `<a href="${siteUrl}/oppgaver.html" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#0b1220;text-decoration:none;border-radius:10px;">Åpne oppgaver</a>` +
    `</td></tr></table></td></tr>` +
    `<tr><td style="padding:20px 24px;background-color:#0d1422;border-top:1px solid rgba(255,255,255,0.10);text-align:center;">` +
    `<p style="margin:0;font-size:13px;color:rgba(234,240,255,0.4);">Kammerkoret Utsikten – Styrerom</p></td></tr>` +
    `</table></td></tr></table></body></html>`;
}

function taskAttachments(tasks) {
  const att = [{ filename: 'utsikten-logo.png', content: loadLogo(), cid: 'utsikten-logo' }];
  const ics = buildICS(taskDeadlineEvents(tasks));
  if (ics) att.push({ filename: 'frister.ics', content: ics, contentType: 'text/calendar; charset=utf-8; method=PUBLISH' });
  return att;
}

/** E-post når en oppgave tildeles et medlem. */
function renderTaskAssigned({ task }) {
  const navn = (task.ansvarligNavn || '').split(' ')[0];
  const greeting = navn ? `Hei ${navn}, du har fått en oppgave.` : 'Du har fått en oppgave.';
  const text =
    `${greeting}\n\n${task.tittel}\n` +
    (task.frist ? `Frist: ${formatNorskDato(task.frist)}\n` : '') +
    (task.anledning ? `Møte/anledning: ${task.anledning}\n` : '') +
    (task.beskrivelse ? `\n${task.beskrivelse}\n` : '') +
    `\nÅpne oppgaver: ${STYRE_SITE()}/oppgaver.html\n\nKammerkoret Utsikten – Styrerom`;
  return {
    from: process.env.SMTP_FROM,
    to: task.ansvarligEmail,
    subject: `Ny oppgave: ${task.tittel}`,
    text,
    html: taskEmailHtml({ heading: 'Ny oppgave', intro: greeting, rowsHtml: taskRow(task, null) }),
    attachments: taskAttachments([task]),
  };
}

/** Daglig påminnelse til ett medlem om oppgaver med frist. items: [{ task, kind }] */
function renderTaskReminder({ recipient, items }) {
  const navn = (recipient.navn || '').split(' ')[0];
  const greeting = navn ? `Hei ${navn}, du har oppgaver med frist.` : 'Du har oppgaver med frist.';
  const rowsHtml = items.map(({ task, kind }) => taskRow(task, kind)).join('');
  const text =
    `${greeting}\n\n` +
    items.map(({ task, kind }) => `• [${kind}] ${task.tittel}` + (task.frist ? ` (frist ${formatNorskDato(task.frist)})` : '')).join('\n') +
    `\n\nÅpne oppgaver: ${STYRE_SITE()}/oppgaver.html\n\nKammerkoret Utsikten – Styrerom`;
  return {
    from: process.env.SMTP_FROM,
    to: recipient.email,
    subject: `Påminnelse: ${items.length} oppgave${items.length === 1 ? '' : 'r'} med frist`,
    text,
    html: taskEmailHtml({ heading: 'Frist nærmer seg', intro: greeting, rowsHtml }),
    attachments: taskAttachments(items.map(i => i.task)),
  };
}

module.exports = { createTransporter, formatNorskDato, buildICS, renderTicketEmail, renderMemberDigest, renderTaskAssigned, renderTaskReminder };
