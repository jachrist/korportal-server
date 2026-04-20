require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { ensureTables } = require('./lib/db');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(express.json({ limit: '50mb' }));

// CORS - åpen under utvikling
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// --- Power Automate-kompatibel response-wrapper ---
// Wrapper alle JSON-responser i { body: ... } slik at frontenden sin
// unwrap()-logikk i sharepoint-api.js fungerer uten endringer.
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    return originalJson({ body: data });
  };
  next();
});

// --- Static file serving (uploads) ---
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadDir));

// --- Routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/navigation'));
app.use('/api/forside', require('./routes/articles'));
app.use('/api/forside', require('./routes/contacts'));
app.use('/api/forside', require('./routes/quicklinks'));
app.use('/api', require('./routes/messages'));
app.use('/api', require('./routes/posts'));
app.use('/api/ovelse', require('./routes/practice'));
app.use('/api/nedlasting', require('./routes/downloads'));
app.use('/api', require('./routes/concerts'));
app.use('/api/billetter', require('./routes/tickets'));
app.use('/api/billettkontroll', require('./routes/ticket-validate'));
app.use('/api/musikk', require('./routes/music'));
app.use('/api/medlemmer', require('./routes/members'));
app.use('/api', require('./routes/files'));
app.use('/api/blob', require('./routes/blob'));
app.use('/api/styre', require('./routes/styre'));
app.use('/api/profil', require('./routes/profile'));
app.use('/api/admin', require('./routes/admin'));

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Error handler ---
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Intern serverfeil' });
});

// --- Start ---
async function start() {
  try {
    console.log('Oppretter tabeller hvis de ikke finnes...');
    await ensureTables();
    console.log('Tabeller OK.');
  } catch (err) {
    console.error('Kunne ikke opprette tabeller:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`Korportal API kjører på http://localhost:${PORT}`);
  });
}

start();
