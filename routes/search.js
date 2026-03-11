const express = require('express');
const router = express.Router();
const { dbAll } = require('../db');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ tasks: [], ideas: [], principles: [], vision: [] });

  const pattern = `%${q}%`;

  const [tasks, ideas, principles, vision] = await Promise.all([
    dbAll(
      'SELECT * FROM tasks WHERE title LIKE ? OR details LIKE ? ORDER BY date DESC, position ASC LIMIT 20',
      [pattern, pattern]
    ),
    dbAll(
      'SELECT * FROM ideas WHERE title LIKE ? OR details LIKE ? ORDER BY created_at DESC LIMIT 20',
      [pattern, pattern]
    ),
    dbAll(
      'SELECT * FROM principles WHERE text LIKE ? OR details LIKE ? ORDER BY position ASC LIMIT 20',
      [pattern, pattern]
    ),
    dbAll(
      'SELECT * FROM vision WHERE title LIKE ? OR details LIKE ? ORDER BY position ASC LIMIT 20',
      [pattern, pattern]
    )
  ]);

  res.json({ tasks, ideas, principles, vision });
}));

module.exports = router;
