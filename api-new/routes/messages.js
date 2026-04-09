const express = require('express');
const router = express.Router();
const { listEntities, getEntity, upsertEntity, deleteEntity, buildEntity } = require('../lib/table-client');
const { successResponse, errorResponse, validateRequired, generateId, now, parsePagination, paginate } = require('../lib/helpers');

/**
 * GET /api/meldinger?limit=20&offset=0
 * Response: { success: true, data: [...], total, limit, offset, hasMore }
 *
 * Message shape:
 * { id, title, content, format, author, publishedAt, imageUrl, isImportant, isPinned, commentCount, comments: [] }
 */
router.get('/meldinger', async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query, 20);
    const items = await listEntities('Messages');

    // Sort: pinned first, then by publishedAt desc
    items.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    });

    const messages = items.map(item => ({
      id: item.id,
      title: item.title,
      content: item.content,
      format: item.format || 'markdown',
      author: item.author,
      publishedAt: item.publishedAt,
      imageUrl: item.imageUrl || '',
      isImportant: item.isImportant || false,
      isPinned: item.isPinned || false,
      commentCount: (item.comments || []).length,
      comments: item.comments || [],
    }));

    return res.json(paginate(messages, limit, offset));
  } catch (err) {
    console.error('meldinger error:', err);
    return errorResponse(res, 'Kunne ikke hente meldinger.', 500);
  }
});

/**
 * POST /api/meldinger
 * Request:  { title, content, authorName, authorEmail }
 * Response: { success: true, id: "new-id" }
 */
router.post('/meldinger', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['title', 'content', 'authorName', 'authorEmail']);
    if (err) return errorResponse(res, err);

    const { title, content, authorName, authorEmail } = req.body;
    const id = generateId('MSG');

    const message = {
      id,
      title,
      content,
      format: 'markdown',
      author: authorName,
      authorEmail,
      publishedAt: now(),
      imageUrl: '',
      isImportant: false,
      isPinned: false,
      comments: [],
    };

    await upsertEntity('Messages', buildEntity('message', id, {
      publishedAt: message.publishedAt,
      isPinned: false,
    }, message));

    return successResponse(res, { id }, 201);
  } catch (err) {
    console.error('create message error:', err);
    return errorResponse(res, 'Kunne ikke opprette melding.', 500);
  }
});

/**
 * POST /api/meldinger/kommentar
 * Request:  { messageId, text, authorName, authorEmail }
 * Response: { success: true }
 */
router.post('/meldinger/kommentar', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['messageId', 'text', 'authorName', 'authorEmail']);
    if (err) return errorResponse(res, err);

    const { messageId, text, authorName, authorEmail } = req.body;
    const entity = await getEntity('Messages', 'message', messageId);
    if (!entity) return errorResponse(res, 'Melding ikke funnet.', 404);

    const comments = entity.comments || [];
    comments.push({
      id: generateId('CMT'),
      author: authorName,
      email: authorEmail,
      text,
      createdAt: now(),
    });

    const updated = { ...entity, comments };
    await upsertEntity('Messages', buildEntity('message', messageId, {
      publishedAt: entity.publishedAt,
      isPinned: entity.isPinned || false,
    }, updated));

    return successResponse(res, { message: 'Kommentar lagt til.' });
  } catch (err) {
    console.error('message comment error:', err);
    return errorResponse(res, 'Kunne ikke legge til kommentar.', 500);
  }
});

/**
 * PATCH /api/meldinger/:id
 * Request: { title, content, ... }
 */
router.patch('/meldinger/:id', async (req, res) => {
  try {
    const entity = await getEntity('Messages', 'message', req.params.id);
    if (!entity) return errorResponse(res, 'Melding ikke funnet.', 404);

    const updated = { ...entity, ...req.body };
    await upsertEntity('Messages', buildEntity('message', req.params.id, {
      publishedAt: updated.publishedAt,
      isPinned: updated.isPinned || false,
    }, updated));

    return successResponse(res, { message: 'Melding oppdatert.' });
  } catch (err) {
    console.error('message update error:', err);
    return errorResponse(res, 'Kunne ikke oppdatere melding.', 500);
  }
});

/**
 * DELETE /api/meldinger/:id
 */
router.delete('/meldinger/:id', async (req, res) => {
  try {
    await deleteEntity('Messages', 'message', req.params.id);
    return successResponse(res, { message: 'Melding slettet.' });
  } catch (err) {
    console.error('message delete error:', err);
    return errorResponse(res, 'Kunne ikke slette melding.', 500);
  }
});

module.exports = router;
