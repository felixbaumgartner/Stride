require('dotenv').config();
const express = require('express');
const path = require('path');
const { initDb, dbRun } = require('./db');
const { authMiddleware } = require('./middleware/auth');
const tasksRouter = require('./routes/tasks');
const ideasRouter = require('./routes/ideas');
const principlesRouter = require('./routes/principles');
const visionRouter = require('./routes/vision');
const summaryRouter = require('./routes/summary');
const exportRouter = require('./routes/export');
const docsRouter = require('./routes/docs');
const searchRouter = require('./routes/search');
const alignmentRouter = require('./routes/alignment');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbReady = initDb().catch((error) => {
  console.error('Failed to initialize database', error);
});

app.use('/api', async (req, res, next) => {
  await dbReady;
  next();
});

// Public endpoints (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/config', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
});

// Auth middleware for all other API routes
app.use('/api', authMiddleware);

// Claim unclaimed data for first-time users
app.post('/api/auth/claim', async (req, res, next) => {
  try {
    const tables = ['tasks', 'ideas', 'principles', 'vision', 'docs', 'weekly_reviews'];
    for (const table of tables) {
      await dbRun(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL`, [req.userId]);
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.use('/api/tasks', tasksRouter);
app.use('/api/ideas', ideasRouter);
app.use('/api/principles', principlesRouter);
app.use('/api/vision', visionRouter);
app.use('/api/docs', docsRouter);
app.use('/api/summary', summaryRouter);
app.use('/api/export', exportRouter);
app.use('/api/search', searchRouter);
app.use('/api/alignment', alignmentRouter);

app.use((err, req, res, next) => {
  const message = err?.message || 'Unexpected server error';
  console.error(err);
  res.status(500).json({ error: message });
});

if (!process.env.VERCEL) {
  dbReady.then(() => {
    app.listen(PORT, () => {
      console.log(`Stride is running at http://localhost:${PORT}`);
    });
  });
}

module.exports = app;
