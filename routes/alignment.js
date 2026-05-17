const express = require('express');
const router = express.Router();
const { dbAll, dbGet } = require('../db');
const { getTodayDate, shiftISODate } = require('../date-utils');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const PERIODS = {
  '7d': 6,
  '30d': 29,
  '90d': 89,
};

function getPeriodRange(period) {
  const key = Object.prototype.hasOwnProperty.call(PERIODS, period) ? period : '30d';
  const to = getTodayDate();
  const from = shiftISODate(to, -PERIODS[key]);
  return { key, from, to };
}

function percent(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

router.get('/', asyncHandler(async (req, res) => {
  const { key, from, to } = getPeriodRange(req.query.period);
  const userId = req.userId;

  const [
    taskStats,
    ideaStats,
    principleRows,
    visionRows,
    unlinkedFocusTasks,
    unlinkedIdeas,
  ] = await Promise.all([
    dbGet(
      `SELECT
        COUNT(*) AS total_tasks,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed_tasks,
        SUM(CASE WHEN focus = 1 THEN 1 ELSE 0 END) AS focus_tasks,
        SUM(CASE WHEN focus = 1 AND completed = 1 THEN 1 ELSE 0 END) AS completed_focus_tasks,
        SUM(CASE WHEN principle_id IS NOT NULL OR vision_id IS NOT NULL THEN 1 ELSE 0 END) AS linked_tasks,
        SUM(CASE WHEN focus = 1 AND (principle_id IS NOT NULL OR vision_id IS NOT NULL) THEN 1 ELSE 0 END) AS linked_focus_tasks
       FROM tasks
       WHERE user_id = ? AND date >= ? AND date <= ?`,
      [userId, from, to]
    ),
    dbGet(
      `SELECT
        COUNT(*) AS total_ideas,
        SUM(CASE WHEN converted = 1 THEN 1 ELSE 0 END) AS converted_ideas,
        SUM(CASE WHEN principle_id IS NOT NULL OR vision_id IS NOT NULL THEN 1 ELSE 0 END) AS linked_ideas,
        SUM(CASE WHEN starred = 1 THEN 1 ELSE 0 END) AS starred_ideas
       FROM ideas
       WHERE user_id = ? AND created_at >= ? AND created_at <= ?`,
      [userId, `${from}T00:00:00`, `${to}T23:59:59`]
    ),
    dbAll(
      `SELECT
        p.id,
        p.text,
        p.details,
        (SELECT COUNT(*) FROM tasks t WHERE t.principle_id = p.id AND t.user_id = p.user_id AND t.date >= ? AND t.date <= ?) AS task_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.principle_id = p.id AND t.user_id = p.user_id AND t.completed = 1 AND t.date >= ? AND t.date <= ?) AS completed_task_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.principle_id = p.id AND t.user_id = p.user_id AND t.focus = 1 AND t.date >= ? AND t.date <= ?) AS focus_task_count,
        (SELECT COUNT(*) FROM ideas i WHERE i.principle_id = p.id AND i.user_id = p.user_id AND i.created_at >= ? AND i.created_at <= ?) AS idea_count,
        (SELECT MAX(t.date) FROM tasks t WHERE t.principle_id = p.id AND t.user_id = p.user_id AND t.date >= ? AND t.date <= ?) AS latest_task_date
       FROM principles p
       WHERE p.user_id = ?
       ORDER BY task_count DESC, idea_count DESC, p.position ASC`,
      [
        from, to,
        from, to,
        from, to,
        `${from}T00:00:00`, `${to}T23:59:59`,
        from, to,
        userId,
      ]
    ),
    dbAll(
      `SELECT
        v.id,
        v.title,
        v.time_horizon,
        v.target_date,
        (SELECT COUNT(*) FROM tasks t WHERE t.vision_id = v.id AND t.user_id = v.user_id AND t.date >= ? AND t.date <= ?) AS task_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.vision_id = v.id AND t.user_id = v.user_id AND t.completed = 1 AND t.date >= ? AND t.date <= ?) AS completed_task_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.vision_id = v.id AND t.user_id = v.user_id AND t.focus = 1 AND t.date >= ? AND t.date <= ?) AS focus_task_count,
        (SELECT COUNT(*) FROM ideas i WHERE i.vision_id = v.id AND i.user_id = v.user_id AND i.created_at >= ? AND i.created_at <= ?) AS idea_count,
        (SELECT MAX(t.date) FROM tasks t WHERE t.vision_id = v.id AND t.user_id = v.user_id AND t.date >= ? AND t.date <= ?) AS latest_task_date
       FROM vision v
       WHERE v.user_id = ?
       ORDER BY task_count DESC, idea_count DESC, v.position ASC`,
      [
        from, to,
        from, to,
        from, to,
        `${from}T00:00:00`, `${to}T23:59:59`,
        from, to,
        userId,
      ]
    ),
    dbAll(
      `SELECT id, title, date, completed
       FROM tasks
       WHERE user_id = ? AND date >= ? AND date <= ? AND focus = 1 AND principle_id IS NULL AND vision_id IS NULL
       ORDER BY date DESC, position ASC
       LIMIT 8`,
      [userId, from, to]
    ),
    dbAll(
      `SELECT id, title, starred, created_at
       FROM ideas
       WHERE user_id = ? AND created_at >= ? AND created_at <= ? AND principle_id IS NULL AND vision_id IS NULL AND converted = 0 AND archived = 0
       ORDER BY starred DESC, created_at DESC
       LIMIT 8`,
      [userId, `${from}T00:00:00`, `${to}T23:59:59`]
    ),
  ]);

  const totalTasks = taskStats?.total_tasks || 0;
  const focusTasks = taskStats?.focus_tasks || 0;
  const totalIdeas = ideaStats?.total_ideas || 0;

  const principles = principleRows.map((row) => ({
    ...row,
    task_count: row.task_count || 0,
    completed_task_count: row.completed_task_count || 0,
    focus_task_count: row.focus_task_count || 0,
    idea_count: row.idea_count || 0,
    action_count: (row.task_count || 0) + (row.idea_count || 0),
  }));

  const vision = visionRows.map((row) => ({
    ...row,
    task_count: row.task_count || 0,
    completed_task_count: row.completed_task_count || 0,
    focus_task_count: row.focus_task_count || 0,
    idea_count: row.idea_count || 0,
    action_count: (row.task_count || 0) + (row.idea_count || 0),
  }));

  res.json({
    period: key,
    range: { from, to },
    metrics: {
      totalTasks,
      completedTasks: taskStats?.completed_tasks || 0,
      focusTasks,
      completedFocusTasks: taskStats?.completed_focus_tasks || 0,
      linkedTasks: taskStats?.linked_tasks || 0,
      linkedFocusTasks: taskStats?.linked_focus_tasks || 0,
      totalIdeas,
      convertedIdeas: ideaStats?.converted_ideas || 0,
      linkedIdeas: ideaStats?.linked_ideas || 0,
      starredIdeas: ideaStats?.starred_ideas || 0,
      taskAlignmentRate: percent(taskStats?.linked_tasks || 0, totalTasks),
      focusAlignmentRate: percent(taskStats?.linked_focus_tasks || 0, focusTasks),
      ideaAlignmentRate: percent(ideaStats?.linked_ideas || 0, totalIdeas),
      completionRate: percent(taskStats?.completed_tasks || 0, totalTasks),
    },
    principles,
    vision,
    attention: {
      quietPrinciples: principles.filter((item) => item.action_count === 0).slice(0, 5),
      quietVision: vision.filter((item) => item.action_count === 0).slice(0, 5),
      unlinkedFocusTasks,
      unlinkedIdeas,
    },
  });
}));

module.exports = router;
