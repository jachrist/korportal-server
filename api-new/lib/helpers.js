const crypto = require('crypto');

/**
 * Standard success response.
 */
function successResponse(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, ...data });
}

/**
 * Standard error response.
 */
function errorResponse(res, message, statusCode = 400) {
  return res.status(statusCode).json({ success: false, error: message });
}

/**
 * Generate a unique ID string.
 * @param {string} [prefix] - Optional prefix (e.g. "MSG", "BIL")
 */
function generateId(prefix) {
  const id = crypto.randomUUID().replace(/-/g, '').substring(0, 12);
  return prefix ? `${prefix}-${id}` : id;
}

/**
 * Generate a human-readable reference number.
 * @param {string} prefix - e.g. "UTK"
 */
function generateReferenceNumber(prefix = 'UTK') {
  const year = new Date().getFullYear();
  const seq = crypto.randomInt(1, 9999).toString().padStart(4, '0');
  return `${prefix}-${year}-${seq}`;
}

/**
 * Parse pagination params from query string.
 * @param {object} query - req.query
 * @param {number} [defaultLimit=50]
 * @returns {{ limit: number, offset: number }}
 */
function parsePagination(query, defaultLimit = 50) {
  const limit = Math.min(parseInt(query.limit) || defaultLimit, 200);
  const offset = Math.max(parseInt(query.offset) || 0, 0);
  return { limit, offset };
}

/**
 * Apply pagination to an array.
 */
function paginate(items, limit, offset) {
  return {
    data: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
    hasMore: offset + limit < items.length,
  };
}

/**
 * Validate that required fields exist in an object.
 * @param {object} obj
 * @param {string[]} fields
 * @returns {string|null} Error message or null
 */
function validateRequired(obj, fields) {
  const missing = fields.filter(f => obj[f] === undefined || obj[f] === null || obj[f] === '');
  if (missing.length > 0) {
    return `Mangler påkrevde felt: ${missing.join(', ')}`;
  }
  return null;
}

/**
 * Get current ISO timestamp.
 */
function now() {
  return new Date().toISOString();
}

module.exports = {
  successResponse,
  errorResponse,
  generateId,
  generateReferenceNumber,
  parsePagination,
  paginate,
  validateRequired,
  now,
};
