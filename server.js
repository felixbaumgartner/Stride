const express = require('express');
const path = require('path');
const { initDb } = require('./db');
const tasksRouter = require('./routes/tasks');
const ideasRouter = require('./routes/ideas');
const principlesRouter = require('./routes/principles');
const visionRouter = require('./routes/vision');
const summaryRouter = require('./routes/summary');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/tasks', tasksRouter);
app.use('/api/ideas', ideasRouter);
app.use('/api/principles', principlesRouter);
app.use('/api/vision', visionRouter);
app.use('/api/summary', summaryRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Stride is running at http://localhost:${PORT}`);
  });
});
