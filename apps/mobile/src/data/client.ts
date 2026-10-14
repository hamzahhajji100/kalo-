import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import type { Db } from './db';
import * as schema from './schema';

const sqlite = openDatabaseSync('kalo-user.db');
sqlite.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

export const expoDb = drizzle(sqlite, { schema });
/** The app-wide user database. */
export const db: Db = expoDb;
