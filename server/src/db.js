import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const defaultDataFile = fileURLToPath(new URL('../data/lucky-draw.sqlite', import.meta.url))

export function createDatabase(filename = process.env.DATA_FILE || defaultDataFile) {
  if (filename !== ':memory:') {
    mkdirSync(dirname(filename), { recursive: true })
  }

  const db = new DatabaseSync(filename)
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
  if (filename !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;')
  }

  migrate(db)
  seedDemoActivity(db)
  return db
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      level TEXT NOT NULL,
      name TEXT NOT NULL,
      image_url TEXT,
      initial_stock INTEGER NOT NULL CHECK (initial_stock >= 0),
      remaining_stock INTEGER NOT NULL CHECK (remaining_stock >= 0),
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS draws (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      openid TEXT NOT NULL,
      prize_id INTEGER NOT NULL,
      drawn_at TEXT NOT NULL,
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
      FOREIGN KEY (prize_id) REFERENCES prizes(id),
      UNIQUE (activity_id, openid)
    );

    CREATE INDEX IF NOT EXISTS idx_prizes_activity ON prizes(activity_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_draws_activity ON draws(activity_id, drawn_at);
  `)
}

function seedDemoActivity(db) {
  db.exec('BEGIN IMMEDIATE')
  try {
    let activity = db.prepare('SELECT id FROM activities WHERE slug = ?').get('demo')

    if (!activity) {
      const created = db.prepare(`
        INSERT INTO activities (slug, name, status, created_at)
        VALUES (?, ?, 'ACTIVE', ?)
      `).run('demo', '幸运现场抽奖', new Date().toISOString())
      activity = { id: Number(created.lastInsertRowid) }
    }

    const prizeCount = db.prepare('SELECT COUNT(*) AS count FROM prizes WHERE activity_id = ?')
      .get(activity.id).count

    if (prizeCount === 0) {
      const insertPrize = db.prepare(`
        INSERT INTO prizes (
          activity_id, level, name, image_url, initial_stock, remaining_stock, sort_order
        ) VALUES (?, ?, ?, NULL, ?, ?, ?)
      `)

      const prizes = [
        ['一等奖', '音响', 20],
        ['二等奖', '咖啡杯', 50],
        ['三等奖', '黄麻手提袋', 80],
        ['幸运奖', '小花盆', 110],
      ]

      prizes.forEach(([level, name, stock], index) => {
        insertPrize.run(activity.id, level, name, stock, stock, index + 1)
      })
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
