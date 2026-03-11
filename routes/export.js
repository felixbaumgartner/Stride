const express = require('express');
const router = express.Router();
const { dbAll } = require('../db');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', asyncHandler(async (req, res) => {
  const [tasks, ideas, principles, vision] = await Promise.all([
    dbAll('SELECT * FROM tasks ORDER BY date DESC, position ASC'),
    dbAll('SELECT * FROM ideas ORDER BY created_at DESC'),
    dbAll('SELECT * FROM principles ORDER BY position ASC'),
    dbAll('SELECT * FROM vision ORDER BY position ASC')
  ]);

  let md = `# Stride Export\nGenerated: ${new Date().toISOString().split('T')[0]}\n\n`;

  // Tasks grouped by date
  md += '## Tasks\n\n';
  const tasksByDate = {};
  for (const t of tasks) {
    if (!tasksByDate[t.date]) tasksByDate[t.date] = [];
    tasksByDate[t.date].push(t);
  }
  for (const [date, dateTasks] of Object.entries(tasksByDate)) {
    for (const t of dateTasks) {
      md += `### [${date}] ${t.title}\n`;
      md += `- Status: ${t.completed ? 'Completed' : 'Pending'}\n`;
      if (t.details) md += `- Details: ${t.details}\n`;
      md += '\n';
    }
  }

  // Ideas
  md += '## Ideas\n\n';
  for (const idea of ideas) {
    md += `### ${idea.title}\n`;
    md += `- Status: ${idea.converted ? 'Converted' : 'Active'}\n`;
    if (idea.details) md += `- Details: ${idea.details}\n`;
    md += '\n';
  }

  // Principles (numbered)
  md += '## Principles\n\n';
  principles.forEach((p, i) => {
    md += `${i + 1}. ${p.text}\n`;
    if (p.details) md += `   - Details: ${p.details}\n`;
  });
  if (principles.length) md += '\n';

  // Vision
  md += '## Vision\n\n';
  for (const v of vision) {
    md += `### ${v.title}\n`;
    if (v.time_horizon) md += `- Horizon: ${v.time_horizon}\n`;
    if (v.details) md += `- Details: ${v.details}\n`;
    md += '\n';
  }

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="stride-export.md"');
  res.send(md);
}));

module.exports = router;
