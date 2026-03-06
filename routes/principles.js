const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun } = require('../db');

// List all principles
router.get('/', (req, res) => {
  res.json(dbAll('SELECT * FROM principles ORDER BY position ASC, created_at ASC'));
});

// Create principle
router.post('/', (req, res) => {
  const { text, details = '' } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  const now = new Date().toISOString();
  const maxPos = dbGet('SELECT COALESCE(MAX(position), -1) as max FROM principles');
  const position = (maxPos?.max ?? -1) + 1;

  const result = dbRun(
    'INSERT INTO principles (text, details, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [text, details, position, now, now]
  );

  const principle = dbGet('SELECT * FROM principles WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(principle);
});

// Update principle
router.put('/:id', (req, res) => {
  const existing = dbGet('SELECT * FROM principles WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Principle not found' });

  const { text, details } = req.body;
  const now = new Date().toISOString();

  dbRun(
    'UPDATE principles SET text = ?, details = ?, updated_at = ? WHERE id = ?',
    [text ?? existing.text, details ?? existing.details, now, req.params.id]
  );

  const principle = dbGet('SELECT * FROM principles WHERE id = ?', [req.params.id]);
  res.json(principle);
});

// Delete principle
router.delete('/:id', (req, res) => {
  const existing = dbGet('SELECT * FROM principles WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Principle not found' });

  dbRun('DELETE FROM principles WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
