const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun } = require('../db');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// List docs – optionally filter by date
router.get('/', asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (date) {
    res.json(await dbAll('SELECT * FROM docs WHERE date = ? AND user_id = ? ORDER BY created_at ASC', [date, req.userId]));
  } else {
    res.json(await dbAll('SELECT * FROM docs WHERE user_id = ? ORDER BY date DESC, created_at ASC', [req.userId]));
  }
}));

// Get single doc
router.get('/:id', asyncHandler(async (req, res) => {
  const doc = await dbGet('SELECT * FROM docs WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!doc) return res.status(404).json({ error: 'Doc not found' });
  res.json(doc);
}));

// Create doc
router.post('/', asyncHandler(async (req, res) => {
  const { title, content = '', date } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Valid date is required' });

  const now = new Date().toISOString();
  const result = await dbRun(
    'INSERT INTO docs (title, content, date, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [title.trim(), content, date, req.userId, now, now]
  );

  const doc = await dbGet('SELECT * FROM docs WHERE id = ? AND user_id = ?', [result.lastInsertRowid, req.userId]);
  res.status(201).json(doc);
}));

// Update doc
router.put('/:id', asyncHandler(async (req, res) => {
  const existing = await dbGet('SELECT * FROM docs WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Doc not found' });

  const title = req.body.title !== undefined ? String(req.body.title).trim() : existing.title;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const content = req.body.content !== undefined ? req.body.content : existing.content;
  const date = req.body.date || existing.date;
  const now = new Date().toISOString();

  await dbRun(
    'UPDATE docs SET title = ?, content = ?, date = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    [title, content, date, now, req.params.id, req.userId]
  );

  const doc = await dbGet('SELECT * FROM docs WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  res.json(doc);
}));

// Delete doc
router.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await dbGet('SELECT * FROM docs WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Doc not found' });

  await dbRun('DELETE FROM docs WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  res.json({ success: true });
}));

module.exports = router;
