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

/**
 * Bygger en daglig oppsummerings-e-post ("digest") til ett medlem.
 * @param {object} p
 * @param {object} p.member    - medlemsrad (name/navn, email/epost)
 * @param {Array}  p.sections  - [ { label, items: [ { title, isNew } ] } ]
 * @returns nodemailer-melding med logo som inline vedlegg (cid)
 */
function renderMemberDigest({ member, sections }) {
  const siteUrl = (process.env.SITE_URL || 'https://www.kammerkoretutsikten.no').replace(/\/+$/, '');
  const name = member.name || member.navn || '';
  const greeting = name ? `Hei ${name.split(' ')[0]},` : 'Hei,';

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
    return (
      `<tr><td style="padding:0 24px 20px;">` +
        `<p style="margin:0 0 8px;font-size:13px;font-weight:600;text-transform:uppercase;` +
        `letter-spacing:0.5px;color:rgba(234,240,255,0.60);">${escapeHtml(s.label)}</p>` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
        `style="background-color:rgba(93,214,255,0.05);border:1px solid rgba(93,214,255,0.15);border-radius:12px;">` +
        rows +
        `</table>` +
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
    `\n\nGå til Korportalen: ${siteUrl}\n\n` +
    `Du mottar denne e-posten fordi du har slått på varsler i Min profil.\n` +
    `Vennlig hilsen\nKammerkoret Utsikten`;

  return {
    from: process.env.SMTP_FROM,
    to: member.email || member.epost,
    subject,
    text,
    html,
    attachments: [
      { filename: 'utsikten-logo.png', content: loadLogo(), cid: 'utsikten-logo' },
    ],
  };
}

module.exports = { createTransporter, formatNorskDato, renderTicketEmail, renderMemberDigest };
