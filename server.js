require('dotenv').config();
const express = require('express');
const path = require('path');
const { initDb } = require('./db');
const tasksRouter = require('./routes/tasks');
const ideasRouter = require('./routes/ideas');
const principlesRouter = require('./routes/principles');
const visionRouter = require('./routes/vision');
const summaryRouter = require('./routes/summary');
const exportRouter = require('./routes/export');
const searchRouter = require('./routes/search');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/tasks', tasksRouter);
app.use('/api/ideas', ideasRouter);
app.use('/api/principles', principlesRouter);
app.use('/api/vision', visionRouter);
app.use('/api/summary', summaryRouter);
app.use('/api/export', exportRouter);
app.use('/api/search', searchRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use((err, req, res, next) => {
  const message = err?.message || 'Unexpected server error';
  console.error(err);
  res.status(500).json({ error: message });
});

const dbReady = initDb().catch((error) => {
  console.error('Failed to initialize database', error);
});

if (!process.env.VERCEL) {
  dbReady.then(() => {
    app.listen(PORT, () => {
      console.log(`Stride is running at http://localhost:${PORT}`);
    });
  });
}

module.exports = app;
