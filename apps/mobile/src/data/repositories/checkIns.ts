import type { CheckInResult } from '@kalo/core';
import { desc } from 'drizzle-orm';

import type { Db } from '../db';
import { checkIns } from '../schema';

export function lastCheckIn(
  db: Db,
): { date: string; accepted: boolean; result: CheckInResult } | undefined {
  const r = db.select().from(checkIns).orderBy(desc(checkIns.date)).limit(1).get();
  return r
    ? { date: r.date, accepted: r.accepted, result: JSON.parse(r.resultJson) as CheckInResult }
    : undefined;
}

/** One check-in per day; repeating it the same day replaces the earlier decision. */
export function saveCheckIn(db: Db, date: string, result: CheckInResult, accepted: boolean): void {
  const values = { date, resultJson: JSON.stringify(result), accepted };
  db.insert(checkIns)
    .values(values)
    .onConflictDoUpdate({ target: checkIns.date, set: values })
    .run();
}
