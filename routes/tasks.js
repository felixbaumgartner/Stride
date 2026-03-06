const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun } = require('../db');

// List tasks, optionally filtered by date range
router.get('/', (req, res) => {
  const { from, to } = req.query;
  let sql = 'SELECT * FROM tasks';
  const params = [];

  if (from && to) {
    sql += ' WHERE date >= ? AND date <= ?';
    params.push(from, to);
  } else if (from) {
    sql += ' WHERE date = ?';
    params.push(from);
  }

  sql += ' ORDER BY date DESC, position ASC, created_at DESC';
  const tasks = dbAll(sql, params);
  res.json(tasks);
});

// Get single task
router.get('/:id', (req, res) => {
  const task = dbGet('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// Create task
router.post('/', (req, res) => {
  const { title, details = '', date } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const taskDate = date || new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  const maxPos = dbGet('SELECT COALESCE(MAX(position), -1) as max FROM tasks WHERE date = ?', [taskDate]);
  const position = (maxPos?.max ?? -1) + 1;

  const result = dbRun(
    'INSERT INTO tasks (title, details, date, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [title, details, taskDate, position, now, now]
  );

  const task = dbGet('SELECT * FROM tasks WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(task);
});

// Update task
router.put('/:id', (req, res) => {
  const existing = dbGet('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const { title, details, date, completed } = req.body;
  const now = new Date().toISOString();

  dbRun(
    'UPDATE tasks SET title = ?, details = ?, date = ?, completed = ?, updated_at = ? WHERE id = ?',
    [
      title ?? existing.title,
      details ?? existing.details,
      date ?? existing.date,
      completed ?? existing.completed,
      now,
      req.params.id
    ]
  );

  const task = dbGet('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  res.json(task);
});

// Toggle completion
router.patch('/:id/complete', (req, res) => {
  const existing = dbGet('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const completed = req.body.completed ?? (existing.completed ? 0 : 1);
  const now = new Date().toISOString();

  dbRun('UPDATE tasks SET completed = ?, updated_at = ? WHERE id = ?', [completed, now, req.params.id]);

  const task = dbGet('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  res.json(task);
});

// Delete task
router.delete('/:id', (req, res) => {
  const existing = dbGet('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  dbRun('DELETE FROM tasks WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
