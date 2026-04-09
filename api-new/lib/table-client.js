const { TableClient, TableServiceClient, odata } = require('@azure/data-tables');

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

/** @type {Map<string, TableClient>} */
const clients = new Map();

/**
 * Get or create a TableClient for the given table name.
 * @param {string} tableName
 * @returns {TableClient}
 */
function getTableClient(tableName) {
  if (!clients.has(tableName)) {
    clients.set(tableName, TableClient.fromConnectionString(connectionString, tableName));
  }
  return clients.get(tableName);
}

/**
 * Get a single entity by partitionKey and rowKey.
 * Returns the parsed jsonData or null if not found.
 */
async function getEntity(tableName, partitionKey, rowKey) {
  try {
    const client = getTableClient(tableName);
    const entity = await client.getEntity(partitionKey, rowKey);
    return parseEntity(entity);
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

/**
 * List entities with optional OData filter.
 * @param {string} tableName
 * @param {object} [options]
 * @param {string} [options.filter] - OData filter string
 * @param {number} [options.top] - Max results
 * @param {string[]} [options.select] - Columns to select
 * @returns {Promise<object[]>} Parsed entities
 */
async function listEntities(tableName, options = {}) {
  const client = getTableClient(tableName);
  const queryOptions = {};
  if (options.select) queryOptions.select = options.select;

  const iteratorOptions = { queryOptions };
  if (options.filter) iteratorOptions.queryOptions.filter = options.filter;

  const entities = [];
  const iter = client.listEntities(iteratorOptions);
  for await (const entity of iter) {
    entities.push(parseEntity(entity));
    if (options.top && entities.length >= options.top) break;
  }
  return entities;
}

/**
 * Insert or update (merge) an entity.
 * @param {string} tableName
 * @param {object} entity - Must include partitionKey and rowKey
 */
async function upsertEntity(tableName, entity) {
  const client = getTableClient(tableName);
  await client.upsertEntity(entity, 'Merge');
}

/**
 * Delete an entity.
 */
async function deleteEntity(tableName, partitionKey, rowKey) {
  const client = getTableClient(tableName);
  await client.deleteEntity(partitionKey, rowKey);
}

/**
 * Parse a raw Table Storage entity into a usable object.
 * Merges top-level searchable columns with parsed jsonData.
 */
function parseEntity(entity) {
  const { partitionKey, rowKey, timestamp, jsonData, ...rest } = entity;
  let parsed = {};
  if (jsonData) {
    try {
      parsed = JSON.parse(jsonData);
    } catch { parsed = {}; }
  }
  // Top-level columns override jsonData for searchable fields
  return { partitionKey, rowKey, ...parsed, ...rest, id: rowKey };
}

/**
 * Build an entity for storage.
 * @param {string} partitionKey
 * @param {string} rowKey
 * @param {object} searchableFields - Top-level indexed columns
 * @param {object} fullData - Complete object stored as jsonData
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
 * Ensure all required tables exist.
 */
async function ensureTables() {
  const tableService = TableServiceClient.fromConnectionString(connectionString);
  const tableNames = [
    'Navigation', 'Articles', 'Contacts', 'QuickLinks',
    'Messages', 'Posts', 'Practice', 'Downloads',
    'Concerts', 'TicketReservations', 'Music', 'Members',
    'Events', 'Files', 'AuthCodes',
  ];
  for (const name of tableNames) {
    try {
      await tableService.createTable(name);
      console.log(`  Table "${name}" created`);
    } catch (err) {
      if (err.statusCode === 409) {
        // Already exists
      } else {
        console.error(`  Failed to create table "${name}":`, err.message);
      }
    }
  }
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
};
