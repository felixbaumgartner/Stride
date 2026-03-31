const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun, dbTransaction } = require('../db');
const { getTodayDate } = require('../date-utils');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const IDEA_SELECT = `
  SELECT
    i.*,
    p.text AS principle_text,
    v.title AS vision_title,
    v.time_horizon AS vision_time_horizon
  FROM ideas i
  LEFT JOIN principles p ON p.id = i.principle_id
  LEFT JOIN vision v ON v.id = i.vision_id
`;

const TASK_SELECT = `
  SELECT
    t.*,
    p.text AS principle_text,
    v.title AS vision_title,
    v.time_horizon AS vision_time_horizon
  FROM tasks t
  LEFT JOIN principles p ON p.id = t.principle_id
  LEFT JOIN vision v ON v.id = t.vision_id
`;

function normalizeLinkedId(value, fieldName) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new Error(`${fieldName} must be a valid selection`);
  }

  return id;
}

function normalizeFlag(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value === 'string') {
    return value === 'true' || value === '1' ? 1 : 0;
  }
  return value ? 1 : 0;
}

async function assertLinkedRecord(tableName, id, fieldName, userId) {
  if (!id) return;

  const record = await dbGet(`SELECT id FROM ${tableName} WHERE id = ? AND user_id = ?`, [id, userId]);
  if (!record) {
    throw new Error(`${fieldName} was not found`);
  }
}

async function getIdeaById(id, userId) {
  return dbGet(`${IDEA_SELECT} WHERE i.id = ? AND i.user_id = ?`, [id, userId]);
}

async function getTaskById(id, userId) {
  return dbGet(`${TASK_SELECT} WHERE t.id = ? AND t.user_id = ?`, [id, userId]);
}

// List ideas (active by default)
router.get('/', asyncHandler(async (req, res) => {
  const includeConverted = req.query.include_converted === '1' || req.query.all === '1';
  const includeArchived = req.query.include_archived === '1' || req.query.all === '1';
  const conditions = ['i.user_id = ?'];

  if (!includeConverted) conditions.push('i.converted = 0');
  if (!includeArchived) conditions.push('i.archived = 0');

  const sql = `${IDEA_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY i.archived ASC, i.converted ASC, i.starred DESC, i.created_at DESC`;
  res.json(await dbAll(sql, [req.userId]));
}));

// Get single idea
router.get('/:id', asyncHandler(async (req, res) => {
  const idea = await getIdeaById(req.params.id, req.userId);
  if (!idea) return res.status(404).json({ error: 'Idea not found' });
  res.json(idea);
}));

// Create idea
router.post('/', asyncHandler(async (req, res) => {
  const { title, details = '' } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });

  const principleId = normalizeLinkedId(req.body.principle_id, 'Principle');
  const visionId = normalizeLinkedId(req.body.vision_id, 'Vision');
  const now = new Date().toISOString();

  await assertLinkedRecord('principles', principleId, 'Principle', req.userId);
  await assertLinkedRecord('vision', visionId, 'Vision', req.userId);

  const result = await dbRun(
    'INSERT INTO ideas (title, details, principle_id, vision_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [title.trim(), details, principleId ?? null, visionId ?? null, req.userId, now, now]
  );

  const idea = await getIdeaById(result.lastInsertRowid, req.userId);
  res.status(201).json(idea);
}));

// Update idea
router.put('/:id', asyncHandler(async (req, res) => {
  const existing = await dbGet('SELECT * FROM ideas WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Idea not found' });

  const nextTitle = req.body.title === undefined ? existing.title : String(req.body.title).trim();
  if (!nextTitle) return res.status(400).json({ error: 'Title is required' });

  const nextPrincipleId = normalizeLinkedId(req.body.principle_id, 'Principle');
  const nextVisionId = normalizeLinkedId(req.body.vision_id, 'Vision');
  const resolvedPrincipleId = nextPrincipleId === undefined ? existing.principle_id : nextPrincipleId;
  const resolvedVisionId = nextVisionId === undefined ? existing.vision_id : nextVisionId;
  const now = new Date().toISOString();

  await assertLinkedRecord('principles', resolvedPrincipleId, 'Principle', req.userId);
  await assertLinkedRecord('vision', resolvedVisionId, 'Vision', req.userId);

  await dbRun(
    'UPDATE ideas SET title = ?, details = ?, principle_id = ?, vision_id = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    [nextTitle, req.body.details ?? existing.details, resolvedPrincipleId, resolvedVisionId, now, req.params.id, req.userId]
  );

  const idea = await getIdeaById(req.params.id, req.userId);
  res.json(idea);
}));

// Archive or restore idea
router.patch('/:id/archive', asyncHandler(async (req, res) => {
  const existing = await dbGet('SELECT * FROM ideas WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Idea not found' });

  const archived = normalizeFlag(req.body.archived, existing.archived ? 0 : 1);
  const now = new Date().toISOString();

  await dbRun('UPDATE ideas SET archived = ?, updated_at = ? WHERE id = ? AND user_id = ?', [archived, now, req.params.id, req.userId]);

  const idea = await getIdeaById(req.params.id, req.userId);
  res.json(idea);
}));

// Star or unstar idea
router.patch('/:id/star', asyncHandler(async (req, res) => {
  const existing = await dbGet('SELECT * FROM ideas WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Idea not found' });

  const starred = normalizeFlag(req.body.starred, existing.starred ? 0 : 1);
  const now = new Date().toISOString();

  await dbRun('UPDATE ideas SET starred = ?, updated_at = ? WHERE id = ? AND user_id = ?', [starred, now, req.params.id, req.userId]);

  const idea = await getIdeaById(req.params.id, req.userId);
  res.json(idea);
}));

// Delete idea
router.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await dbGet('SELECT * FROM ideas WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Idea not found' });

  await dbRun('DELETE FROM ideas WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  res.json({ success: true });
}));

// Convert idea to task
router.post('/:id/convert', asyncHandler(async (req, res) => {
  const idea = await dbGet('SELECT * FROM ideas WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!idea) return res.status(404).json({ error: 'Idea not found' });
  if (idea.converted) return res.status(400).json({ error: 'Idea already converted' });

  const date = req.body.date && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date) ? req.body.date : getTodayDate();
  const now = new Date().toISOString();
  const userId = req.userId;

  const task = await dbTransaction(async ({ dbGet, dbRun }) => {
    if (idea.principle_id) {
      const principle = await dbGet('SELECT id FROM principles WHERE id = ? AND user_id = ?', [idea.principle_id, userId]);
      if (!principle) throw new Error('Linked principle was not found');
    }

    if (idea.vision_id) {
      const vision = await dbGet('SELECT id FROM vision WHERE id = ? AND user_id = ?', [idea.vision_id, userId]);
      if (!vision) throw new Error('Linked vision was not found');
    }

    const maxPos = await dbGet('SELECT COALESCE(MAX(position), -1) AS max FROM tasks WHERE date = ? AND user_id = ?', [date, userId]);
    const position = (maxPos?.max ?? -1) + 1;

    const taskResult = await dbRun(
      'INSERT INTO tasks (title, details, date, source, source_idea_id, principle_id, vision_id, position, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [idea.title, idea.details, date, 'idea', idea.id, idea.principle_id, idea.vision_id, position, userId, now, now]
    );

    await dbRun(
      'UPDATE ideas SET converted = 1, converted_task_id = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [taskResult.lastInsertRowid, now, idea.id, userId]
    );

    return await dbGet(`${TASK_SELECT} WHERE t.id = ? AND t.user_id = ?`, [taskResult.lastInsertRowid, userId]);
  });

  res.status(201).json(task);
}));

module.exports = router;
