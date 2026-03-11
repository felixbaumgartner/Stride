const { createClient } = require('@libsql/client');

let client;

async function initDb() {
  client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
    intMode: 'number',
  });

  await client.execute(`
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

  await client.execute(`
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

  await client.execute(`
    CREATE TABLE IF NOT EXISTS principles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      details TEXT DEFAULT '',
      position INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await client.execute(`
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

  await client.execute('CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_ideas_converted ON ideas(converted)');
}

async function dbAll(sql, params = []) {
  const result = await client.execute({ sql, args: params });
  return result.rows;
}

async function dbGet(sql, params = []) {
  const rows = await dbAll(sql, params);
  return rows[0] || null;
}

async function dbRun(sql, params = []) {
  const result = await client.execute({ sql, args: params });
  return { lastInsertRowid: result.lastInsertRowid };
}

async function dbTransaction(fn) {
  return await client.transaction(async (tx) => {
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
    return await fn({ dbAll: txAll, dbGet: txGet, dbRun: txRun });
  });
}

module.exports = { initDb, dbAll, dbGet, dbRun, dbTransaction };
