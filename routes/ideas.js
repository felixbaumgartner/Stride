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

async function assertLinkedRecord(tableName, id, fieldName) {
  if (!id) return;

  const record = await dbGet(`SELECT id FROM ${tableName} WHERE id = ?`, [id]);
  if (!record) {
    throw new Error(`${fieldName} was not found`);
  }
}

async function getIdeaById(id) {
  return dbGet(`${IDEA_SELECT} WHERE i.id = ?`, [id]);
}

async function getTaskById(id) {
  return dbGet(`${TASK_SELECT} WHERE t.id = ?`, [id]);
}

// List ideas (active by default)
router.get('/', asyncHandler(async (req, res) => {
  const includeConverted = req.query.include_converted === '1' || req.query.all === '1';
  const includeArchived = req.query.include_archived === '1' || req.query.all === '1';
  const conditions = [];

  if (!includeConverted) conditions.push('i.converted = 0');
  if (!includeArchived) conditions.push('i.archived = 0');

  let sql = IDEA_SELECT;
  if (conditions.length) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  sql += ' ORDER BY i.archived ASC, i.converted ASC, i.created_at DESC';
  res.json(await dbAll(sql));
}));

// Get single idea
router.get('/:id', asyncHandler(async (req, res) => {
  const idea = await getIdeaById(req.params.id);
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

  await assertLinkedRecord('principles', principleId, 'Principle');
  await assertLinkedRecord('vision', visionId, 'Vision');

  const result = await dbRun(
    'INSERT INTO ideas (title, details, principle_id, vision_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [title.trim(), details, principleId ?? null, visionId ?? null, now, now]
  );

  const idea = await getIdeaById(result.lastInsertRowid);
  res.status(201).json(idea);
}));

// Update idea
router.put('/:id', asyncHandler(async (req, res) => {
  const existing = await dbGet('SELECT * FROM ideas WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Idea not found' });

  const nextTitle = req.body.title === undefined ? existing.title : String(req.body.title).trim();
  if (!nextTitle) return res.status(400).json({ error: 'Title is required' });

  const nextPrincipleId = normalizeLinkedId(req.body.principle_id, 'Principle');
  const nextVisionId = normalizeLinkedId(req.body.vision_id, 'Vision');
  const resolvedPrincipleId = nextPrincipleId === undefined ? existing.principle_id : nextPrincipleId;
  const resolvedVisionId = nextVisionId === undefined ? existing.vision_id : nextVisionId;
  const now = new Date().toISOString();

  await assertLinkedRecord('principles', resolvedPrincipleId, 'Principle');
  await assertLinkedRecord('vision', resolvedVisionId, 'Vision');

  await dbRun(
    'UPDATE ideas SET title = ?, details = ?, principle_id = ?, vision_id = ?, updated_at = ? WHERE id = ?',
    [nextTitle, req.body.details ?? existing.details, resolvedPrincipleId, resolvedVisionId, now, req.params.id]
  );

  const idea = await getIdeaById(req.params.id);
  res.json(idea);
}));

// Archive or restore idea
router.patch('/:id/archive', asyncHandler(async (req, res) => {
  const existing = await dbGet('SELECT * FROM ideas WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Idea not found' });

  const archived = normalizeFlag(req.body.archived, existing.archived ? 0 : 1);
  const now = new Date().toISOString();

  await dbRun('UPDATE ideas SET archived = ?, updated_at = ? WHERE id = ?', [archived, now, req.params.id]);

  const idea = await getIdeaById(req.params.id);
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

  const date = req.body.date && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date) ? req.body.date : getTodayDate();
  const now = new Date().toISOString();

  const task = await dbTransaction(async ({ dbGet, dbRun }) => {
    if (idea.principle_id) {
      const principle = await dbGet('SELECT id FROM principles WHERE id = ?', [idea.principle_id]);
      if (!principle) throw new Error('Linked principle was not found');
    }

    if (idea.vision_id) {
      const vision = await dbGet('SELECT id FROM vision WHERE id = ?', [idea.vision_id]);
      if (!vision) throw new Error('Linked vision was not found');
    }

    const maxPos = await dbGet('SELECT COALESCE(MAX(position), -1) AS max FROM tasks WHERE date = ?', [date]);
    const position = (maxPos?.max ?? -1) + 1;

    const taskResult = await dbRun(
      'INSERT INTO tasks (title, details, date, source, source_idea_id, principle_id, vision_id, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [idea.title, idea.details, date, 'idea', idea.id, idea.principle_id, idea.vision_id, position, now, now]
    );

    await dbRun(
      'UPDATE ideas SET converted = 1, converted_task_id = ?, updated_at = ? WHERE id = ?',
      [taskResult.lastInsertRowid, now, idea.id]
    );

    return await dbGet(`${TASK_SELECT} WHERE t.id = ?`, [taskResult.lastInsertRowid]);
  });

  res.status(201).json(task);
}));

module.exports = router;

