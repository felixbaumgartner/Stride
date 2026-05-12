const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun } = require('../db');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// List all vision entries
router.get('/', asyncHandler(async (req, res) => {
  res.json(await dbAll('SELECT * FROM vision WHERE user_id = ? ORDER BY position ASC, created_at ASC', [req.userId]));
}));

// Create vision entry
router.post('/', asyncHandler(async (req, res) => {
  const { title, details = '', time_horizon = '', target_date = '' } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const now = new Date().toISOString();
  const maxPos = await dbGet('SELECT COALESCE(MAX(position), -1) as max FROM vision WHERE user_id = ?', [req.userId]);
  const position = (maxPos?.max ?? -1) + 1;

  const result = await dbRun(
    'INSERT INTO vision (title, details, time_horizon, target_date, position, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [title, details, time_horizon, target_date, position, req.userId, now, now]
  );

  const entry = await dbGet('SELECT * FROM vision WHERE id = ? AND user_id = ?', [result.lastInsertRowid, req.userId]);
  res.status(201).json(entry);
}));

// Update vision entry
router.put('/:id', asyncHandler(async (req, res) => {
  const existing = await dbGet('SELECT * FROM vision WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Vision entry not found' });

  const { title, details, time_horizon, target_date } = req.body;
  const now = new Date().toISOString();

  await dbRun(
    'UPDATE vision SET title = ?, details = ?, time_horizon = ?, target_date = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    [
      title ?? existing.title,
      details ?? existing.details,
      time_horizon ?? existing.time_horizon,
      target_date ?? existing.target_date,
      now,
      req.params.id,
      req.userId,
    ]
  );

  const entry = await dbGet('SELECT * FROM vision WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  res.json(entry);
}));

// Delete vision entry
router.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await dbGet('SELECT * FROM vision WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Vision entry not found' });

  await dbRun('DELETE FROM vision WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  res.json({ success: true });
}));

module.exports = router;
