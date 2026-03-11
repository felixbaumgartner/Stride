const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun, dbTransaction } = require('../db');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// List ideas (active by default, ?all=1 for all)
router.get('/', asyncHandler(async (req, res) => {
  const showAll = req.query.all === '1';
  const sql = showAll
    ? 'SELECT * FROM ideas ORDER BY created_at DESC'
    : 'SELECT * FROM ideas WHERE converted = 0 ORDER BY created_at DESC';
  res.json(await dbAll(sql));
}));

// Get single idea
router.get('/:id', asyncHandler(async (req, res) => {
  const idea = await dbGet('SELECT * FROM ideas WHERE id = ?', [req.params.id]);
  if (!idea) return res.status(404).json({ error: 'Idea not found' });
  res.json(idea);
}));

// Create idea
router.post('/', asyncHandler(async (req, res) => {
  const { title, details = '' } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const now = new Date().toISOString();
  const result = await dbRun(
    'INSERT INTO ideas (title, details, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [title, details, now, now]
  );

  const idea = await dbGet('SELECT * FROM ideas WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(idea);
}));

// Update idea
router.put('/:id', asyncHandler(async (req, res) => {
  const existing = await dbGet('SELECT * FROM ideas WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Idea not found' });

  const { title, details } = req.body;
  const now = new Date().toISOString();

  await dbRun(
    'UPDATE ideas SET title = ?, details = ?, updated_at = ? WHERE id = ?',
    [title ?? existing.title, details ?? existing.details, now, req.params.id]
  );

  const idea = await dbGet('SELECT * FROM ideas WHERE id = ?', [req.params.id]);
  res.json(idea);
}));

// Delete idea
router.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await dbGet('SELECT * FROM ideas WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Idea not found' });

  await dbRun('DELETE FROM ideas WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

// Convert idea to task
router.post('/:id/convert', asyncHandler(async (req, res) => {
  const idea = await dbGet('SELECT * FROM ideas WHERE id = ?', [req.params.id]);
  if (!idea) return res.status(404).json({ error: 'Idea not found' });
  if (idea.converted) return res.status(400).json({ error: 'Idea already converted' });

  const date = req.body.date || new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  const task = await dbTransaction(async ({ dbGet, dbRun }) => {
    const maxPos = await dbGet('SELECT COALESCE(MAX(position), -1) as max FROM tasks WHERE date = ?', [date]);
    const position = (maxPos?.max ?? -1) + 1;

    const taskResult = await dbRun(
      'INSERT INTO tasks (title, details, date, source, source_idea_id, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [idea.title, idea.details, date, 'idea', idea.id, position, now, now]
    );

    await dbRun(
      'UPDATE ideas SET converted = 1, converted_task_id = ?, updated_at = ? WHERE id = ?',
      [taskResult.lastInsertRowid, now, idea.id]
    );

    return await dbGet('SELECT * FROM tasks WHERE id = ?', [taskResult.lastInsertRowid]);
  });
  res.status(201).json(task);
}));

module.exports = router;
