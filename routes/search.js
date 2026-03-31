const express = require('express');
const router = express.Router();
const { dbAll } = require('../db');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ tasks: [], ideas: [], principles: [], vision: [], docs: [] });

  const pattern = `%${q}%`;

  const [tasks, ideas, principles, vision, docs] = await Promise.all([
    dbAll(
      'SELECT * FROM tasks WHERE user_id = ? AND (title LIKE ? OR details LIKE ?) ORDER BY date DESC, position ASC LIMIT 20',
      [req.userId, pattern, pattern]
    ),
    dbAll(
      'SELECT * FROM ideas WHERE user_id = ? AND (title LIKE ? OR details LIKE ?) ORDER BY created_at DESC LIMIT 20',
      [req.userId, pattern, pattern]
    ),
    dbAll(
      'SELECT * FROM principles WHERE user_id = ? AND (text LIKE ? OR details LIKE ?) ORDER BY position ASC LIMIT 20',
      [req.userId, pattern, pattern]
    ),
    dbAll(
      'SELECT * FROM vision WHERE user_id = ? AND (title LIKE ? OR details LIKE ?) ORDER BY position ASC LIMIT 20',
      [req.userId, pattern, pattern]
    ),
    dbAll(
      'SELECT * FROM docs WHERE user_id = ? AND (title LIKE ? OR content LIKE ?) ORDER BY date DESC LIMIT 20',
      [req.userId, pattern, pattern]
    )
  ]);

  res.json({ tasks, ideas, principles, vision, docs });
}));

module.exports = router;
