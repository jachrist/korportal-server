/**
 * SQLite database layer for Korportal.
 * Drop-in replacement for table-client.js (Azure Table Storage).
 * Uses better-sqlite3 for synchronous, fast SQLite access.
 *
 * Exports identical function signatures so route files need only
 * change their require() path.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// --- Database initialisation ---

const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'data', 'korportal.db');

// Ensure the directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Table schemas ---
// Each table has: id (PK), partitionKey, jsonData, plus searchable columns.

const TABLE_SCHEMAS = {
  Navigation: 'sortOrder INTEGER, role TEXT',
  Articles: 'page TEXT',
  Contacts: 'kontaktrolle TEXT',
  QuickLinks: 'sortOrder INTEGER',
  Messages: 'publishedAt TEXT, isPinned INTEGER',
  Posts: 'createdAt TEXT',
  Practice: '',
  Downloads: 'category TEXT',
  Concerts: 'date TEXT, isPublic INTEGER',
  TicketReservations: 'concertId TEXT, isPaid INTEGER, referenceNumber TEXT',
  Music: 'date TEXT',
  Members: 'email TEXT, role TEXT, voice TEXT',
  Events: 'date TEXT',
  Files: 'type TEXT, stemme TEXT, verk TEXT, anledning TEXT, sortering INTEGER, uploaded INTEGER DEFAULT 0',
  AuthCodes: 'email TEXT, expiresAt TEXT',
  GuestConfig: '',
};

// Cache of column names per table (populated by ensureTables)
const tableColumns = new Map();

function cacheTableColumns(tableName) {
  const info = db.prepare(`PRAGMA table_info("${tableName}")`).all();
  tableColumns.set(tableName, info.map(col => col.name));
}

// --- Core functions ---

/**
 * Create all tables if they don't exist, add indexes.
 */
function ensureTables() {
  for (const [name, extraCols] of Object.entries(TABLE_SCHEMAS)) {
    const cols = [
      'id TEXT PRIMARY KEY',
      'partitionKey TEXT',
      extraCols,
      'jsonData TEXT',
    ].filter(Boolean).join(', ');

    db.prepare(`CREATE TABLE IF NOT EXISTS "${name}" (${cols})`).run();

    // Add missing columns to existing tables (schema migration)
    if (extraCols) {
      const existing = db.prepare(`PRAGMA table_info("${name}")`).all().map(c => c.name);
      for (const colDef of extraCols.split(',').map(s => s.trim()).filter(Boolean)) {
        const colName = colDef.split(/\s+/)[0];
        if (!existing.includes(colName)) {
          db.prepare(`ALTER TABLE "${name}" ADD COLUMN ${colDef}`).run();
          console.log(`  Added column "${colName}" to "${name}"`);
        }
      }
    }

    cacheTableColumns(name);
    console.log(`  Table "${name}" ready`);
  }

  // Indexes on frequently filtered columns
  const indexes = [
    ['Members', 'email'],
    ['AuthCodes', 'email'],
    ['Articles', 'page'],
    ['TicketReservations', 'referenceNumber'],
    ['Files', 'anledning'],
    ['Files', 'verk'],
  ];
  for (const [table, col] of indexes) {
    db.prepare(`CREATE INDEX IF NOT EXISTS "idx_${table}_${col}" ON "${table}" ("${col}")`).run();
  }
}

/**
 * Parse a raw SQLite row into the same shape as parseEntity from table-client.
 * Merges top-level searchable columns with parsed jsonData.
 */
function parseEntity(row) {
  if (!row) return null;
  const { id, partitionKey, jsonData, ...rest } = row;
  let parsed = {};
  if (jsonData) {
    try {
      parsed = JSON.parse(jsonData);
    } catch { parsed = {}; }
  }
  return { partitionKey, rowKey: id, ...parsed, ...rest, id };
}

/**
 * Build an entity for storage. Identical to table-client version.
 */
function buildEntity(partitionKey, rowKey, searchableFields, fullData) {
  return {
    partitionKey,
    rowKey,
    ...searchableFields,
    jsonData: JSON.stringify(fullData),
  };
}

/**
 * Get a single entity by partitionKey and rowKey.
 * partitionKey is accepted for API compatibility but not used in query.
 */
async function getEntity(tableName, partitionKey, rowKey) {
  const row = db.prepare(`SELECT * FROM "${tableName}" WHERE id = ?`).get(rowKey);
  return parseEntity(row);
}

/**
 * Parse a simple OData-style filter string into SQL WHERE clause.
 * Supports: "column eq 'value'" and "RowKey eq 'value'"
 * Returns { where: string, params: any[] } or null if no filter.
 */
function parseFilter(filter) {
  if (!filter) return null;

  const match = filter.match(/^(\w+)\s+eq\s+'([^']*)'$/);
  if (!match) {
    console.warn('Unsupported filter syntax:', filter);
    return null;
  }

  const [, column, value] = match;
  const sqlColumn = column === 'RowKey' ? 'id' : column;
  return { where: `"${sqlColumn}" = ?`, params: [value] };
}

/**
 * List entities with optional filter.
 * @param {string} tableName
 * @param {object} [options]
 * @param {string} [options.filter] - Simple OData filter: "column eq 'value'"
 * @param {number} [options.top] - Max results
 */
async function listEntities(tableName, options = {}) {
  let sql = `SELECT * FROM "${tableName}"`;
  const params = [];

  const parsed = parseFilter(options.filter);
  if (parsed) {
    sql += ` WHERE ${parsed.where}`;
    params.push(...parsed.params);
  }

  if (options.top) {
    sql += ' LIMIT ?';
    params.push(options.top);
  }

  const rows = db.prepare(sql).all(...params);
  return rows.map(row => parseEntity(row));
}

/**
 * Insert or replace an entity.
 * Dynamically matches entity keys against known table columns.
 */
async function upsertEntity(tableName, entity) {
  const cols = tableColumns.get(tableName);
  if (!cols) {
    throw new Error(`Unknown table: ${tableName}. Run ensureTables() first.`);
  }

  // Map rowKey → id
  const data = { ...entity };
  if (data.rowKey !== undefined) {
    data.id = data.rowKey;
    delete data.rowKey;
  }

  // Only include columns that exist in the table
  const insertCols = [];
  const insertVals = [];
  for (const col of cols) {
    if (data[col] !== undefined) {
      insertCols.push(`"${col}"`);
      // SQLite can't bind booleans — convert to 0/1
      const val = data[col];
      insertVals.push(typeof val === 'boolean' ? (val ? 1 : 0) : val);
    }
  }

  if (insertCols.length === 0) {
    throw new Error(`No matching columns for table ${tableName}`);
  }

  const placeholders = insertCols.map(() => '?').join(', ');
  const sql = `INSERT OR REPLACE INTO "${tableName}" (${insertCols.join(', ')}) VALUES (${placeholders})`;
  db.prepare(sql).run(...insertVals);
}

/**
 * Delete an entity by partitionKey and rowKey.
 * partitionKey is accepted for API compatibility.
 */
async function deleteEntity(tableName, partitionKey, rowKey) {
  db.prepare(`DELETE FROM "${tableName}" WHERE id = ?`).run(rowKey);
}

/**
 * No-op tagged template literal for OData compatibility.
 * Routes import this but it's not actually used in any filter calls.
 */
function odata(strings, ...values) {
  return strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? values[i] : ''), '');
}

/**
 * Stub for API compatibility. Not used by routes.
 */
function getTableClient(tableName) {
  return null;
}

module.exports = {
  getTableClient,
  getEntity,
  listEntities,
  upsertEntity,
  deleteEntity,
  parseEntity,
  buildEntity,
  ensureTables,
  odata,
  db, // Export raw db for advanced use cases
};
