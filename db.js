const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'stride.db');
let db;
let inTransaction = false;

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      details TEXT DEFAULT '',
      date TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      source TEXT DEFAULT 'manual',
      source_idea_id INTEGER,
      position INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      details TEXT DEFAULT '',
      converted INTEGER DEFAULT 0,
      converted_task_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS principles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      details TEXT DEFAULT '',
      position INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS vision (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      details TEXT DEFAULT '',
      time_horizon TEXT DEFAULT '',
      position INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_ideas_converted ON ideas(converted)');

  saveDb();
}

function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function dbGet(sql, params = []) {
  const results = dbAll(sql, params);
  return results[0] || null;
}

function dbRun(sql, params = []) {
  db.run(sql, params);
  if (!inTransaction) saveDb();
  const row = db.exec('SELECT last_insert_rowid() as id');
  const lastInsertRowid = row.length ? row[0].values[0][0] : 0;
  return { lastInsertRowid };
}

function dbTransaction(fn) {
  inTransaction = true;
  db.run('BEGIN TRANSACTION');
  try {
    const result = fn();
    db.run('COMMIT');
    inTransaction = false;
    saveDb();
    return result;
  } catch (err) {
    db.run('ROLLBACK');
    inTransaction = false;
    throw err;
  }
}

module.exports = { initDb, dbAll, dbGet, dbRun, dbTransaction };
