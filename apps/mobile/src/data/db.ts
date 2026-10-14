import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * Database type used by all repositories. Both the app driver (expo-sqlite) and the test driver
 * (better-sqlite3) are synchronous drizzle drivers, so repositories run unchanged in tests.
 */
export type Db = BaseSQLiteDatabase<'sync', unknown, typeof schema>;
