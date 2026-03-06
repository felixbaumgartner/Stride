const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun } = require('../db');

// List all vision entries
router.get('/', (req, res) => {
  res.json(dbAll('SELECT * FROM vision ORDER BY position ASC, created_at ASC'));
});

// Create vision entry
router.post('/', (req, res) => {
  const { title, details = '', time_horizon = '' } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const now = new Date().toISOString();
  const maxPos = dbGet('SELECT COALESCE(MAX(position), -1) as max FROM vision');
  const position = (maxPos?.max ?? -1) + 1;

  const result = dbRun(
    'INSERT INTO vision (title, details, time_horizon, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [title, details, time_horizon, position, now, now]
  );

  const entry = dbGet('SELECT * FROM vision WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(entry);
});

// Update vision entry
router.put('/:id', (req, res) => {
  const existing = dbGet('SELECT * FROM vision WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Vision entry not found' });

  const { title, details, time_horizon } = req.body;
  const now = new Date().toISOString();

  dbRun(
    'UPDATE vision SET title = ?, details = ?, time_horizon = ?, updated_at = ? WHERE id = ?',
    [title ?? existing.title, details ?? existing.details, time_horizon ?? existing.time_horizon, now, req.params.id]
  );

  const entry = dbGet('SELECT * FROM vision WHERE id = ?', [req.params.id]);
  res.json(entry);
});

// Delete vision entry
router.delete('/:id', (req, res) => {
  const existing = dbGet('SELECT * FROM vision WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Vision entry not found' });

  dbRun('DELETE FROM vision WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
