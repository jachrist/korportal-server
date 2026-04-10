const express = require('express');
const router = express.Router();
const { listEntities, getEntity, upsertEntity, buildEntity } = require('../lib/db');
const { successResponse, errorResponse, validateRequired, generateId, now, parsePagination, paginate } = require('../lib/helpers');

/**
 * GET /api/innlegg?limit=20&offset=0
 * Response: { success: true, data: [...], total, limit, offset, hasMore }
 *
 * Post shape:
 * { id, title, content, author: { id, name }, createdAt, commentCount, comments: [] }
 */
router.get('/innlegg', async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query, 20);
    const items = await listEntities('Posts');

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const posts = items.map(item => ({
      id: item.id,
      title: item.title,
      content: item.content,
      author: item.author || { id: item.authorId, name: item.authorName },
      createdAt: item.createdAt,
      commentCount: (item.comments || []).length,
      comments: item.comments || [],
    }));

    return res.json(paginate(posts, limit, offset));
  } catch (err) {
    console.error('innlegg error:', err);
    return errorResponse(res, 'Kunne ikke hente innlegg.', 500);
  }
});

/**
 * POST /api/innlegg
 * Request:  { title, content, authorId, authorName, authorEmail, authorVoice }
 * Response: { success: true, id: "new-id" }
 */
router.post('/innlegg', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['title', 'content', 'authorName', 'authorEmail']);
    if (err) return errorResponse(res, err);

    const { title, content, authorId, authorName, authorEmail, authorVoice } = req.body;
    const id = generateId('POST');

    const post = {
      id,
      title,
      content,
      author: { id: authorId, name: authorName },
      authorEmail,
      authorVoice: authorVoice || '',
      createdAt: now(),
      comments: [],
    };

    await upsertEntity('Posts', buildEntity('post', id, {
      createdAt: post.createdAt,
    }, post));

    return successResponse(res, { id }, 201);
  } catch (err) {
    console.error('create post error:', err);
    return errorResponse(res, 'Kunne ikke opprette innlegg.', 500);
  }
});

/**
 * POST /api/innlegg/kommentar
 * Request:  { postId, text, authorName, authorEmail }
 * Response: { success: true }
 */
router.post('/innlegg/kommentar', async (req, res) => {
  try {
    const err = validateRequired(req.body, ['postId', 'text', 'authorName', 'authorEmail']);
    if (err) return errorResponse(res, err);

    const { postId, text, authorName, authorEmail } = req.body;
    const entity = await getEntity('Posts', 'post', postId);
    if (!entity) return errorResponse(res, 'Innlegg ikke funnet.', 404);

    const comments = entity.comments || [];
    comments.push({
      id: generateId('CMT'),
      author: authorName,
      email: authorEmail,
      text,
      createdAt: now(),
    });

    const updated = { ...entity, comments };
    await upsertEntity('Posts', buildEntity('post', postId, {
      createdAt: entity.createdAt,
    }, updated));

    return successResponse(res, { message: 'Kommentar lagt til.' });
  } catch (err) {
    console.error('post comment error:', err);
    return errorResponse(res, 'Kunne ikke legge til kommentar.', 500);
  }
});

module.exports = router;
