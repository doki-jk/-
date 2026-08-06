import type Database from '@tauri-apps/plugin-sql';
import { getDatabase } from './client';

type Migration = {
  version: number;
  name: string;
  statements: string[];
};

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_nutrition_schema',
    statements: [
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS foods (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        base_amount REAL NOT NULL DEFAULT 100 CHECK(base_amount > 0),
        base_unit TEXT NOT NULL DEFAULT 'g',
        calories REAL NOT NULL CHECK(calories >= 0),
        protein REAL NOT NULL CHECK(protein >= 0),
        carbs REAL NOT NULL CHECK(carbs >= 0),
        fat REAL NOT NULL CHECK(fat >= 0),
        is_favorite INTEGER NOT NULL DEFAULT 0 CHECK(is_favorite IN (0, 1)),
        is_custom INTEGER NOT NULL DEFAULT 0 CHECK(is_custom IN (0, 1)),
        usage_count INTEGER NOT NULL DEFAULT 0 CHECK(usage_count >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS meal_entries (
        id TEXT PRIMARY KEY,
        food_id TEXT,
        food_name TEXT NOT NULL,
        meal_type TEXT NOT NULL CHECK(meal_type IN ('早餐','午餐','晚餐','加餐')),
        consumed_at TEXT NOT NULL,
        amount REAL NOT NULL CHECK(amount > 0),
        unit TEXT NOT NULL,
        calories REAL NOT NULL CHECK(calories >= 0),
        protein REAL NOT NULL CHECK(protein >= 0),
        carbs REAL NOT NULL CHECK(carbs >= 0),
        fat REAL NOT NULL CHECK(fat >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(food_id) REFERENCES foods(id) ON DELETE SET NULL
      )`,
      `CREATE TABLE IF NOT EXISTS nutrition_goals (
        id TEXT PRIMARY KEY,
        goal_type TEXT NOT NULL,
        day_type TEXT NOT NULL CHECK(day_type IN ('training','rest')),
        calories REAL NOT NULL CHECK(calories > 0),
        protein REAL NOT NULL CHECK(protein >= 0),
        carbs REAL NOT NULL CHECK(carbs >= 0),
        fat REAL NOT NULL CHECK(fat >= 0),
        effective_from TEXT NOT NULL,
        effective_to TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS body_records (
        id TEXT PRIMARY KEY,
        recorded_date TEXT NOT NULL UNIQUE,
        weight REAL NOT NULL CHECK(weight > 0),
        body_fat REAL CHECK(body_fat >= 0 AND body_fat <= 100),
        muscle_mass REAL CHECK(muscle_mass >= 0),
        waist REAL CHECK(waist >= 0),
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name)`,
      `CREATE INDEX IF NOT EXISTS idx_foods_usage ON foods(is_favorite DESC, usage_count DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_meal_entries_date ON meal_entries(consumed_at)`,
      `CREATE INDEX IF NOT EXISTS idx_meal_entries_type ON meal_entries(meal_type)`
    ]
  },
  {
    version: 2,
    name: 'daily_plan_snapshots',
    statements: [
      `CREATE TABLE IF NOT EXISTS daily_plans (
        date TEXT PRIMARY KEY,
        day_type TEXT NOT NULL CHECK(day_type IN ('training','rest')),
        calories REAL NOT NULL CHECK(calories > 0),
        protein REAL NOT NULL CHECK(protein >= 0),
        carbs REAL NOT NULL CHECK(carbs >= 0),
        fat REAL NOT NULL CHECK(fat >= 0),
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_daily_plans_type ON daily_plans(day_type)`
    ]
  }
];

async function applyMigration(db: Database, migration: Migration): Promise<void> {
  await db.execute('BEGIN IMMEDIATE');
  try {
    for (const statement of migration.statements) {
      await db.execute(statement);
    }
    await db.execute(
      'INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)',
      [migration.version, migration.name, new Date().toISOString()]
    );
    await db.execute('COMMIT');
  } catch (error) {
    await db.execute('ROLLBACK');
    throw error;
  }
}

export async function initializeDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);

  const applied = await db.select<Array<{ version: number }>>(
    'SELECT version FROM schema_migrations ORDER BY version'
  );
  const appliedVersions = new Set(applied.map((item) => item.version));

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      await applyMigration(db, migration);
    }
  }
}
