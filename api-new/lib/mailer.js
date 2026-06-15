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

module.exports = { createTransporter, formatNorskDato, renderTicketEmail };
