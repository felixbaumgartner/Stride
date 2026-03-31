const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun } = require('../db');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// List all principles
router.get('/', asyncHandler(async (req, res) => {
  res.json(await dbAll('SELECT * FROM principles WHERE user_id = ? ORDER BY position ASC, created_at ASC', [req.userId]));
}));

// Create principle
router.post('/', asyncHandler(async (req, res) => {
  const { text, details = '' } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  const now = new Date().toISOString();
  const maxPos = await dbGet('SELECT COALESCE(MAX(position), -1) as max FROM principles WHERE user_id = ?', [req.userId]);
  const position = (maxPos?.max ?? -1) + 1;

  const result = await dbRun(
    'INSERT INTO principles (text, details, position, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [text, details, position, req.userId, now, now]
  );

  const principle = await dbGet('SELECT * FROM principles WHERE id = ? AND user_id = ?', [result.lastInsertRowid, req.userId]);
  res.status(201).json(principle);
}));

// Update principle
router.put('/:id', asyncHandler(async (req, res) => {
  const existing = await dbGet('SELECT * FROM principles WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Principle not found' });

  const { text, details } = req.body;
  const now = new Date().toISOString();

  await dbRun(
    'UPDATE principles SET text = ?, details = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    [text ?? existing.text, details ?? existing.details, now, req.params.id, req.userId]
  );

  const principle = await dbGet('SELECT * FROM principles WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  res.json(principle);
}));

// Delete principle
router.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await dbGet('SELECT * FROM principles WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Principle not found' });

  await dbRun('DELETE FROM principles WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  res.json({ success: true });
}));

module.exports = router;
