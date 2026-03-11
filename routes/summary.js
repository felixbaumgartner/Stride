const express = require('express');
const router = express.Router();
const { dbAll, dbGet } = require('../db');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function getISOWeekDates(weekStr) {
  // Parse YYYY-Www format, or default to current week
  let year, week;

  if (weekStr && /^\d{4}-W\d{2}$/.test(weekStr)) {
    year = parseInt(weekStr.split('-W')[0]);
    week = parseInt(weekStr.split('-W')[1]);
  } else {
    const now = new Date();
    year = now.getFullYear();
    // Calculate ISO week number
    const jan4 = new Date(year, 0, 4);
    const dayOfYear = Math.floor((now - new Date(year, 0, 1)) / 86400000) + 1;
    week = Math.ceil((dayOfYear + jan4.getDay() - 1) / 7);
  }

  // Find Monday of the given ISO week
  const jan4 = new Date(year, 0, 4);
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));

  const monday = new Date(mondayOfWeek1);
  monday.setDate(mondayOfWeek1.getDate() + (week - 1) * 7);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = d => d.toISOString().split('T')[0];
  return { from: fmt(monday), to: fmt(sunday), week: `${year}-W${String(week).padStart(2, '0')}` };
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

router.get('/', asyncHandler(async (req, res) => {
  const { from, to, week } = getISOWeekDates(req.query.week);

  const tasks = await dbAll(
    'SELECT * FROM tasks WHERE date >= ? AND date <= ? ORDER BY date ASC, position ASC',
    [from, to]
  );

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Group by day
  const dailyMap = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    dailyMap[dateStr] = { date: dateStr, day: DAYS[d.getDay()], tasks: [], completedCount: 0 };
  }

  for (const task of tasks) {
    if (dailyMap[task.date]) {
      dailyMap[task.date].tasks.push(task);
      if (task.completed) dailyMap[task.date].completedCount++;
    }
  }

  const ideasCreated = (await dbGet(
    'SELECT COUNT(*) as count FROM ideas WHERE created_at >= ? AND created_at < ?',
    [from + 'T00:00:00', to + 'T23:59:59']
  ))?.count || 0;

  const ideasConverted = (await dbGet(
    'SELECT COUNT(*) as count FROM ideas WHERE converted = 1 AND updated_at >= ? AND updated_at < ?',
    [from + 'T00:00:00', to + 'T23:59:59']
  ))?.count || 0;

  res.json({
    week,
    dateRange: { from, to },
    totalTasks,
    completedTasks,
    completionRate,
    dailyBreakdown: Object.values(dailyMap),
    ideasCreated,
    ideasConverted
  });
}));

module.exports = router;
