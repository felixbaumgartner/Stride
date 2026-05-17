const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun } = require('../db');
const { getTodayDate, shiftISODate } = require('../date-utils');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

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

function normalizeDate(value, fallback) {
  if (value === undefined) return fallback;
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('A valid date is required');
  }
  return value;
}

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

async function assertFocusCapacity(date, userId, excludeTaskId = null) {
  const sql = excludeTaskId
    ? 'SELECT COUNT(*) AS count FROM tasks WHERE date = ? AND focus = 1 AND user_id = ? AND id != ?'
    : 'SELECT COUNT(*) AS count FROM tasks WHERE date = ? AND focus = 1 AND user_id = ?';
  const params = excludeTaskId ? [date, userId, excludeTaskId] : [date, userId];
  const result = await dbGet(sql, params);

  if ((result?.count || 0) >= 3) {
    throw new Error('Only three focus tasks are allowed per day');
  }
}

async function getNextPosition(date, userId, excludeTaskId = null) {
  const sql = excludeTaskId
    ? 'SELECT COALESCE(MAX(position), -1) AS max FROM tasks WHERE date = ? AND user_id = ? AND id != ?'
    : 'SELECT COALESCE(MAX(position), -1) AS max FROM tasks WHERE date = ? AND user_id = ?';
  const params = excludeTaskId ? [date, userId, excludeTaskId] : [date, userId];
  const result = await dbGet(sql, params);
  return (result?.max ?? -1) + 1;
}

async function getTaskById(id, userId) {
  return dbGet(`${TASK_SELECT} WHERE t.id = ? AND t.user_id = ?`, [id, userId]);
}

// Get unfinished tasks from the last 30 days (covers 1w, 2w, 1m views)
router.get('/unfinished', asyncHandler(async (req, res) => {
  const today = getTodayDate();
  const d = new Date(today + 'T00:00:00');
  d.setDate(d.getDate() - 30);
  const fromDate = d.toISOString().split('T')[0];

  const tasks = await dbAll(
    `${TASK_SELECT} WHERE t.completed = 0 AND t.date >= ? AND t.date <= ? AND t.user_id = ? ORDER BY t.date DESC, t.focus DESC, t.position ASC`,
    [fromDate, today, req.userId]
  );
  res.json(tasks);
}));

// Most recent prior day with unfinished tasks, within a lookback window
router.get('/carryover', asyncHandler(async (req, res) => {
  const { before } = req.query;
  if (!before || !/^\d{4}-\d{2}-\d{2}$/.test(before)) {
    return res.status(400).json({ error: 'A valid "before" date is required' });
  }
  const within = Math.min(Math.max(Number(req.query.within) || 7, 1), 30);
  const lowerBound = shiftISODate(before, -within);

  const recent = await dbGet(
    'SELECT date FROM tasks WHERE user_id = ? AND completed = 0 AND date < ? AND date >= ? ORDER BY date DESC LIMIT 1',
    [req.userId, before, lowerBound]
  );

  if (!recent) {
    return res.json({ sourceDate: null, tasks: [] });
  }

  const tasks = await dbAll(
    `${TASK_SELECT} WHERE t.user_id = ? AND t.date = ? AND t.completed = 0 ORDER BY t.focus DESC, t.position ASC`,
    [req.userId, recent.date]
  );

  res.json({ sourceDate: recent.date, tasks });
}));

// List tasks, optionally filtered by date range
router.get('/', asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  let sql = TASK_SELECT;
  const params = [];

  if (from && to) {
    sql += ' WHERE t.date >= ? AND t.date <= ? AND t.user_id = ?';
    params.push(from, to, req.userId);
  } else if (from) {
    sql += ' WHERE t.date = ? AND t.user_id = ?';
    params.push(from, req.userId);
  } else {
    sql += ' WHERE t.user_id = ?';
    params.push(req.userId);
  }

  sql += ' ORDER BY t.date DESC, t.focus DESC, t.position ASC, t.created_at DESC';
  const tasks = await dbAll(sql, params);
  res.json(tasks);
}));

// Get single task
router.get('/:id', asyncHandler(async (req, res) => {
  const task = await getTaskById(req.params.id, req.userId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
}));

// Create task
router.post('/', asyncHandler(async (req, res) => {
  const { title, details = '' } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });

  const taskDate = normalizeDate(req.body.date, getTodayDate());
  const principleId = normalizeLinkedId(req.body.principle_id, 'Principle');
  const visionId = normalizeLinkedId(req.body.vision_id, 'Vision');
  const focus = normalizeFlag(req.body.focus, 0);
  const now = new Date().toISOString();

  await assertLinkedRecord('principles', principleId, 'Principle', req.userId);
  await assertLinkedRecord('vision', visionId, 'Vision', req.userId);

  if (focus) {
    await assertFocusCapacity(taskDate, req.userId);
  }

  const position = await getNextPosition(taskDate, req.userId);

  const result = await dbRun(
    'INSERT INTO tasks (title, details, date, principle_id, vision_id, focus, position, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [title.trim(), details, taskDate, principleId ?? null, visionId ?? null, focus, position, req.userId, now, now]
  );

  const task = await getTaskById(result.lastInsertRowid, req.userId);
  res.status(201).json(task);
}));

// Update task
router.put('/:id', asyncHandler(async (req, res) => {
  const existing = await dbGet('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const nextTitle = req.body.title === undefined ? existing.title : String(req.body.title).trim();
  if (!nextTitle) return res.status(400).json({ error: 'Title is required' });

  const nextDate = normalizeDate(req.body.date, existing.date);
  const nextCompleted = normalizeFlag(req.body.completed, existing.completed);
  const nextFocus = normalizeFlag(req.body.focus, existing.focus);
  const nextPrincipleId = normalizeLinkedId(req.body.principle_id, 'Principle');
  const nextVisionId = normalizeLinkedId(req.body.vision_id, 'Vision');
  const resolvedPrincipleId = nextPrincipleId === undefined ? existing.principle_id : nextPrincipleId;
  const resolvedVisionId = nextVisionId === undefined ? existing.vision_id : nextVisionId;
  const nextPosition = nextDate === existing.date ? existing.position : await getNextPosition(nextDate, req.userId, existing.id);
  const now = new Date().toISOString();

  await assertLinkedRecord('principles', resolvedPrincipleId, 'Principle', req.userId);
  await assertLinkedRecord('vision', resolvedVisionId, 'Vision', req.userId);

  const needsFocusCapacity = nextFocus && (!existing.focus || nextDate !== existing.date);
  if (needsFocusCapacity) {
    await assertFocusCapacity(nextDate, req.userId, existing.id);
  }

  await dbRun(
    'UPDATE tasks SET title = ?, details = ?, date = ?, completed = ?, principle_id = ?, vision_id = ?, focus = ?, position = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    [
      nextTitle,
      req.body.details ?? existing.details,
      nextDate,
      nextCompleted,
      resolvedPrincipleId,
      resolvedVisionId,
      nextFocus,
      nextPosition,
      now,
      req.params.id,
      req.userId,
    ]
  );

  const task = await getTaskById(req.params.id, req.userId);
  res.json(task);
}));

// Toggle completion
router.patch('/:id/complete', asyncHandler(async (req, res) => {
  const existing = await dbGet('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const completed = normalizeFlag(req.body.completed, existing.completed ? 0 : 1);
  const now = new Date().toISOString();

  await dbRun('UPDATE tasks SET completed = ?, updated_at = ? WHERE id = ? AND user_id = ?', [completed, now, req.params.id, req.userId]);

  const task = await getTaskById(req.params.id, req.userId);
  res.json(task);
}));

// Update focus
router.patch('/:id/focus', asyncHandler(async (req, res) => {
  const existing = await dbGet('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const focus = normalizeFlag(req.body.focus, existing.focus ? 0 : 1);
  if (focus && !existing.focus) {
    await assertFocusCapacity(existing.date, req.userId, existing.id);
  }

  const now = new Date().toISOString();
  await dbRun('UPDATE tasks SET focus = ?, updated_at = ? WHERE id = ? AND user_id = ?', [focus, now, req.params.id, req.userId]);

  const task = await getTaskById(req.params.id, req.userId);
  res.json(task);
}));

// Reschedule task
router.post('/:id/reschedule', asyncHandler(async (req, res) => {
  const existing = await dbGet('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const targetDate = normalizeDate(req.body.date);
  const targetPosition = targetDate === existing.date ? existing.position : await getNextPosition(targetDate, req.userId, existing.id);

  if (existing.focus && targetDate !== existing.date) {
    await assertFocusCapacity(targetDate, req.userId, existing.id);
  }

  const now = new Date().toISOString();
  await dbRun('UPDATE tasks SET date = ?, position = ?, updated_at = ? WHERE id = ? AND user_id = ?', [targetDate, targetPosition, now, req.params.id, req.userId]);

  const task = await getTaskById(req.params.id, req.userId);
  res.json(task);
}));

// Delete task
router.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await dbGet('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  await dbRun('DELETE FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  res.json({ success: true });
}));

module.exports = router;
