import type Database from '@tauri-apps/plugin-sql';
import { getDatabase } from './client';

type Migration = {
  version: number;
  name: string;
  statements: string[];
};

type TableColumn = {
  name: string;
};

type RepairableTable = 'foods' | 'meal_entries' | 'nutrition_goals' | 'daily_plans';

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
  },
  {
    version: 3,
    name: 'goal_recommendation_profile',
    statements: [
      `CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        sex TEXT NOT NULL CHECK(sex IN ('male','female')),
        age INTEGER NOT NULL CHECK(age >= 14 AND age <= 100),
        height_cm REAL NOT NULL CHECK(height_cm >= 120 AND height_cm <= 230),
        weight_kg REAL NOT NULL CHECK(weight_kg >= 30 AND weight_kg <= 300),
        activity_level TEXT NOT NULL CHECK(activity_level IN ('sedentary','light','moderate','high')),
        objective TEXT NOT NULL CHECK(objective IN ('cut','maintain','gain')),
        updated_at TEXT NOT NULL
      )`
    ]
  }
];

async function applyMigration(db: Database, migration: Migration): Promise<void> {
  // Do not emulate a transaction with separate BEGIN/COMMIT plugin calls.
  // Tauri SQL executes each call through a pool, so those calls are not
  // guaranteed to use the same connection and can leave SQLite locked.
  // These DDL statements are idempotent; the version marker is written only
  // after every statement succeeds, so an interrupted migration is retried.
  for (const statement of migration.statements) {
    await db.execute(statement);
  }
  await db.execute(
    'INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)',
    [migration.version, migration.name, new Date().toISOString()]
  );
}

async function ensureColumn(
  db: Database,
  table: RepairableTable,
  column: string,
  definition: string,
): Promise<void> {
  const columns = await db.select<TableColumn[]>(`PRAGMA table_info(${table})`);
  if (columns.some((item) => item.name === column)) return;
  await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

async function repairLegacySchema(db: Database): Promise<void> {
  await db.execute(`CREATE TABLE IF NOT EXISTS nutrition_goals (
    id TEXT PRIMARY KEY,
    goal_type TEXT NOT NULL,
    day_type TEXT NOT NULL,
    calories REAL NOT NULL,
    protein REAL NOT NULL,
    carbs REAL NOT NULL,
    fat REAL NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    created_at TEXT NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS daily_plans (
    date TEXT PRIMARY KEY,
    day_type TEXT NOT NULL,
    calories REAL NOT NULL,
    protein REAL NOT NULL,
    carbs REAL NOT NULL,
    fat REAL NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  await ensureColumn(db, 'foods', 'base_amount', 'REAL NOT NULL DEFAULT 100');
  await ensureColumn(db, 'foods', 'base_unit', "TEXT NOT NULL DEFAULT 'g'");
  await ensureColumn(db, 'foods', 'is_favorite', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'foods', 'is_custom', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'foods', 'usage_count', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'foods', 'updated_at', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'meal_entries', 'food_id', 'TEXT');
  await ensureColumn(db, 'meal_entries', 'updated_at', "TEXT NOT NULL DEFAULT ''");

  await ensureColumn(db, 'nutrition_goals', 'id', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'nutrition_goals', 'goal_type', "TEXT NOT NULL DEFAULT 'daily_macro'");
  await ensureColumn(db, 'nutrition_goals', 'day_type', "TEXT NOT NULL DEFAULT 'training'");
  await ensureColumn(db, 'nutrition_goals', 'calories', 'REAL NOT NULL DEFAULT 2000');
  await ensureColumn(db, 'nutrition_goals', 'protein', 'REAL NOT NULL DEFAULT 0');
  await ensureColumn(db, 'nutrition_goals', 'carbs', 'REAL NOT NULL DEFAULT 0');
  await ensureColumn(db, 'nutrition_goals', 'fat', 'REAL NOT NULL DEFAULT 0');
  await ensureColumn(db, 'nutrition_goals', 'effective_from', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'nutrition_goals', 'effective_to', 'TEXT');
  await ensureColumn(db, 'nutrition_goals', 'created_at', "TEXT NOT NULL DEFAULT ''");

  await ensureColumn(db, 'daily_plans', 'date', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'daily_plans', 'day_type', "TEXT NOT NULL DEFAULT 'training'");
  await ensureColumn(db, 'daily_plans', 'calories', 'REAL NOT NULL DEFAULT 2000');
  await ensureColumn(db, 'daily_plans', 'protein', 'REAL NOT NULL DEFAULT 0');
  await ensureColumn(db, 'daily_plans', 'carbs', 'REAL NOT NULL DEFAULT 0');
  await ensureColumn(db, 'daily_plans', 'fat', 'REAL NOT NULL DEFAULT 0');
  await ensureColumn(db, 'daily_plans', 'updated_at', "TEXT NOT NULL DEFAULT ''");

  const now = new Date().toISOString();
  await db.execute(
    `UPDATE foods
     SET updated_at = CASE
       WHEN updated_at IS NULL OR updated_at = '' THEN COALESCE(created_at, ?)
       ELSE updated_at
     END`,
    [now],
  );
  await db.execute(
    `UPDATE meal_entries
     SET updated_at = CASE
       WHEN updated_at IS NULL OR updated_at = '' THEN COALESCE(created_at, ?)
       ELSE updated_at
     END`,
    [now],
  );
  await db.execute(
    `UPDATE nutrition_goals
     SET goal_type = CASE WHEN goal_type IS NULL OR goal_type = '' THEN 'daily_macro' ELSE goal_type END,
         effective_from = CASE WHEN effective_from IS NULL OR effective_from = '' THEN ? ELSE effective_from END,
         created_at = CASE WHEN created_at IS NULL OR created_at = '' THEN ? ELSE created_at END`,
    [now, now],
  );
  await db.execute(
    `UPDATE daily_plans
     SET updated_at = CASE WHEN updated_at IS NULL OR updated_at = '' THEN ? ELSE updated_at END`,
    [now],
  );

  await db.execute('CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_foods_usage ON foods(is_favorite DESC, usage_count DESC)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_meal_entries_date ON meal_entries(consumed_at)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_meal_entries_type ON meal_entries(meal_type)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_nutrition_goals_active ON nutrition_goals(day_type, effective_to, effective_from)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_daily_plans_type ON daily_plans(day_type)');
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

  await repairLegacySchema(db);
}
