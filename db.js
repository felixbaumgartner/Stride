const { createClient } = require('@libsql/client');

let client;
let initialized = false;

function getClient() {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
      intMode: 'number',
    });
  }
  return client;
}

async function ensureColumn(tableName, columnName, definition) {
  const db = getClient();
  const result = await db.execute(`PRAGMA table_info(${tableName})`);
  const hasColumn = result.rows.some((row) => row.name === columnName);

  if (!hasColumn) {
    await db.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function initDb() {
  if (initialized) return;
  const db = getClient();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      details TEXT DEFAULT '',
      date TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      source TEXT DEFAULT 'manual',
      source_idea_id INTEGER,
      principle_id INTEGER,
      vision_id INTEGER,
      focus INTEGER DEFAULT 0,
      position INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      details TEXT DEFAULT '',
      converted INTEGER DEFAULT 0,
      archived INTEGER DEFAULT 0,
      principle_id INTEGER,
      vision_id INTEGER,
      converted_task_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS principles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      details TEXT DEFAULT '',
      position INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await db.execute(`
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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS docs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS weekly_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week TEXT NOT NULL UNIQUE,
      wins TEXT DEFAULT '',
      blockers TEXT DEFAULT '',
      changes_summary TEXT DEFAULT '',
      next_focus TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await ensureColumn('tasks', 'principle_id', 'INTEGER');
  await ensureColumn('tasks', 'vision_id', 'INTEGER');
  await ensureColumn('tasks', 'focus', 'INTEGER DEFAULT 0');
  await ensureColumn('ideas', 'archived', 'INTEGER DEFAULT 0');
  await ensureColumn('ideas', 'principle_id', 'INTEGER');
  await ensureColumn('ideas', 'vision_id', 'INTEGER');
  await ensureColumn('ideas', 'starred', 'INTEGER DEFAULT 0');

  // User isolation
  await ensureColumn('tasks', 'user_id', 'TEXT');
  await ensureColumn('ideas', 'user_id', 'TEXT');
  await ensureColumn('principles', 'user_id', 'TEXT');
  await ensureColumn('vision', 'user_id', 'TEXT');
  await ensureColumn('docs', 'user_id', 'TEXT');
  await ensureColumn('weekly_reviews', 'user_id', 'TEXT');

  await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_focus_date ON tasks(date, focus)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_ideas_converted ON ideas(converted)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_ideas_archived ON ideas(archived)');
  await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_reviews_week ON weekly_reviews(week)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_docs_date ON docs(date)');

  initialized = true;
}

async function dbAll(sql, params = []) {
  await initDb();
  const result = await getClient().execute({ sql, args: params });
  return result.rows;
}

async function dbGet(sql, params = []) {
  const rows = await dbAll(sql, params);
  return rows[0] || null;
}

async function dbRun(sql, params = []) {
  await initDb();
  const result = await getClient().execute({ sql, args: params });
  return { lastInsertRowid: result.lastInsertRowid };
}

async function dbTransaction(fn) {
  await initDb();
  const tx = await getClient().transaction('write');
  try {
    const txAll = async (sql, params = []) => {
      const result = await tx.execute({ sql, args: params });
      return result.rows;
    };
    const txGet = async (sql, params = []) => {
      const rows = await txAll(sql, params);
      return rows[0] || null;
    };
    const txRun = async (sql, params = []) => {
      const result = await tx.execute({ sql, args: params });
      return { lastInsertRowid: result.lastInsertRowid };
    };
    const result = await fn({ dbAll: txAll, dbGet: txGet, dbRun: txRun });
    await tx.commit();
    return result;
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

module.exports = { initDb, dbAll, dbGet, dbRun, dbTransaction };
