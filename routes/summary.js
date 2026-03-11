const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun } = require('../db');
const { getISOWeekInfoFromDate, getISOWeekInfoFromWeek } = require('../date-utils');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getSummaryRange(query) {
  if (query.week) return getISOWeekInfoFromWeek(query.week);
  if (query.date) return getISOWeekInfoFromDate(query.date);
  return getISOWeekInfoFromDate();
}

router.get('/', asyncHandler(async (req, res) => {
  const { from, to, week } = getSummaryRange(req.query);

  const tasks = await dbAll(
    `SELECT
      t.*,
      p.text AS principle_text,
      v.title AS vision_title
     FROM tasks t
     LEFT JOIN principles p ON p.id = t.principle_id
     LEFT JOIN vision v ON v.id = t.vision_id
     WHERE t.date >= ? AND t.date <= ?
     ORDER BY t.date ASC, t.focus DESC, t.position ASC`,
    [from, to]
  );

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.completed).length;
  const focusedTasks = tasks.filter((task) => task.focus).length;
  const focusedCompletedTasks = tasks.filter((task) => task.focus && task.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const dailyMap = {};
  const startDate = new Date(`${from}T12:00:00`);
  for (let i = 0; i < 7; i += 1) {
    const dayDate = new Date(startDate);
    dayDate.setDate(startDate.getDate() + i);
    const dateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
    dailyMap[dateStr] = {
      date: dateStr,
      day: DAYS[dayDate.getDay()],
      tasks: [],
      completedCount: 0,
      focusCount: 0,
    };
  }

  for (const task of tasks) {
    if (!dailyMap[task.date]) continue;

    dailyMap[task.date].tasks.push(task);
    if (task.completed) dailyMap[task.date].completedCount += 1;
    if (task.focus) dailyMap[task.date].focusCount += 1;
  }

  const ideasCreated = (await dbGet(
    'SELECT COUNT(*) AS count FROM ideas WHERE created_at >= ? AND created_at <= ?',
    [`${from}T00:00:00`, `${to}T23:59:59`]
  ))?.count || 0;

  const ideasConverted = (await dbGet(
    'SELECT COUNT(*) AS count FROM ideas WHERE converted = 1 AND updated_at >= ? AND updated_at <= ?',
    [`${from}T00:00:00`, `${to}T23:59:59`]
  ))?.count || 0;

  const review = await dbGet('SELECT * FROM weekly_reviews WHERE week = ?', [week]);

  res.json({
    week,
    dateRange: { from, to },
    totalTasks,
    completedTasks,
    focusedTasks,
    focusedCompletedTasks,
    completionRate,
    dailyBreakdown: Object.values(dailyMap),
    ideasCreated,
    ideasConverted,
    review: {
      wins: review?.wins || '',
      blockers: review?.blockers || '',
      changesSummary: review?.changes_summary || '',
      nextFocus: review?.next_focus || '',
    },
  });
}));

router.put('/review', asyncHandler(async (req, res) => {
  const { week, wins = '', blockers = '', changesSummary = '', nextFocus = '' } = req.body;
  const summaryWeek = week && /^\d{4}-W\d{2}$/.test(week) ? week : getISOWeekInfoFromDate(req.body.date).week;
  const now = new Date().toISOString();
  const existing = await dbGet('SELECT id FROM weekly_reviews WHERE week = ?', [summaryWeek]);

  if (existing) {
    await dbRun(
      'UPDATE weekly_reviews SET wins = ?, blockers = ?, changes_summary = ?, next_focus = ?, updated_at = ? WHERE week = ?',
      [wins, blockers, changesSummary, nextFocus, now, summaryWeek]
    );
  } else {
    await dbRun(
      'INSERT INTO weekly_reviews (week, wins, blockers, changes_summary, next_focus, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [summaryWeek, wins, blockers, changesSummary, nextFocus, now, now]
    );
  }

  const review = await dbGet('SELECT * FROM weekly_reviews WHERE week = ?', [summaryWeek]);
  res.json({
    week: summaryWeek,
    review: {
      wins: review?.wins || '',
      blockers: review?.blockers || '',
      changesSummary: review?.changes_summary || '',
      nextFocus: review?.next_focus || '',
    },
  });
}));

module.exports = router;
