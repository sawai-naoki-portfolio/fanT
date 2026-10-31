import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import { sharedState } from '../shared-state';

/**
 * `expo-sqlite`'s synchronous API on Node.js's SQLite, in memory. A name opens the
 * same database again, as on the device.
 */
class FakeDatabase {
  private readonly database = new DatabaseSync(':memory:');

  execSync(source: string): void {
    this.database.exec(source);
  }

  runSync(source: string, ...params: SQLInputValue[]): void {
    this.database.prepare(source).run(...params);
  }

  // Generic like expo-sqlite's own: the caller names the row type.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  getFirstSync<T>(source: string, ...params: SQLInputValue[]): T | null {
    return (this.database.prepare(source).get(...params) as T | undefined) ?? null;
  }

  getAllSync<T>(source: string, ...params: SQLInputValue[]): T[] {
    return this.database.prepare(source).all(...params) as T[];
  }

  withTransactionSync(task: () => void): void {
    this.database.exec('BEGIN');
    try {
      task();
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}

export type SQLiteDatabase = FakeDatabase;

const databases = sharedState('sqlite', () => new Map<string, FakeDatabase>());

export function openDatabaseSync(name: string): FakeDatabase {
  let database = databases.get(name);
  if (database === undefined) {
    database = new FakeDatabase();
    databases.set(name, database);
  }
  return database;
}
