const express = require('express');
const router = express.Router();
const { dbAll } = require('../db');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', asyncHandler(async (req, res) => {
  const [tasks, ideas, principles, vision, reviews, docs] = await Promise.all([
    dbAll(`SELECT t.*, p.text AS principle_text, v.title AS vision_title
           FROM tasks t
           LEFT JOIN principles p ON p.id = t.principle_id
           LEFT JOIN vision v ON v.id = t.vision_id
           WHERE t.user_id = ?
           ORDER BY date DESC, focus DESC, position ASC`, [req.userId]),
    dbAll(`SELECT i.*, p.text AS principle_text, v.title AS vision_title
           FROM ideas i
           LEFT JOIN principles p ON p.id = i.principle_id
           LEFT JOIN vision v ON v.id = i.vision_id
           WHERE i.user_id = ?
           ORDER BY created_at DESC`, [req.userId]),
    dbAll('SELECT * FROM principles WHERE user_id = ? ORDER BY position ASC', [req.userId]),
    dbAll('SELECT * FROM vision WHERE user_id = ? ORDER BY position ASC', [req.userId]),
    dbAll('SELECT * FROM weekly_reviews WHERE user_id = ? ORDER BY week DESC', [req.userId]),
    dbAll('SELECT * FROM docs WHERE user_id = ? ORDER BY date DESC, created_at ASC', [req.userId]),
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
      md += `### [${date}] ${t.title}`;
      if (t.focus) md += ' ⭐';
      md += '\n';
      md += `- Status: ${t.completed ? 'Completed' : 'Pending'}\n`;
      if (t.details) md += `- Details: ${t.details}\n`;
      if (t.principle_text) md += `- Principle: ${t.principle_text}\n`;
      if (t.vision_title) md += `- Vision: ${t.vision_title}\n`;
      md += '\n';
    }
  }

  // Ideas
  md += '## Ideas\n\n';
  for (const idea of ideas) {
    md += `### ${idea.title}\n`;
    const statuses = [];
    if (idea.converted) statuses.push('Converted');
    if (idea.archived) statuses.push('Archived');
    md += `- Status: ${statuses.length ? statuses.join(', ') : 'Active'}\n`;
    if (idea.details) md += `- Details: ${idea.details}\n`;
    if (idea.principle_text) md += `- Principle: ${idea.principle_text}\n`;
    if (idea.vision_title) md += `- Vision: ${idea.vision_title}\n`;
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

  // Docs
  if (docs.length) {
    md += '## Docs\n\n';
    for (const doc of docs) {
      const docLabel = doc.title === doc.date ? doc.date : `[${doc.date}] ${doc.title}`;
      md += `### ${docLabel}\n`;
      if (doc.content) md += `${doc.content}\n`;
      md += '\n';
    }
  }

  // Weekly Reviews
  if (reviews.length) {
    md += '## Weekly Reviews\n\n';
    for (const r of reviews) {
      md += `### ${r.week}\n`;
      if (r.wins) md += `- **Wins:** ${r.wins}\n`;
      if (r.blockers) md += `- **Blockers:** ${r.blockers}\n`;
      if (r.changes_summary) md += `- **What changed:** ${r.changes_summary}\n`;
      if (r.next_focus) md += `- **Next focus:** ${r.next_focus}\n`;
      md += '\n';
    }
  }

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="stride-export.md"');
  res.send(md);
}));

module.exports = router;
