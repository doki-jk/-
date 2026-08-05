import Database from '@tauri-apps/plugin-sql';

let database: Database | null = null;

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function getDatabase(): Promise<Database> {
  if (!isTauriRuntime()) {
    throw new Error('SQLite 仅在 FuelLog 桌面应用中可用');
  }

  if (!database) {
    database = await Database.load('sqlite:fuellog.db');
    await database.execute('PRAGMA foreign_keys = ON');
  }

  return database;
}
