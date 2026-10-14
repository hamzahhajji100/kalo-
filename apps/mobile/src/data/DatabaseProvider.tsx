import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { EmptyState } from '@/ui';
import migrations from '../../drizzle/migrations';
import { db, expoDb } from './client';
import { ensureDefaultMealTypes } from './repositories/mealTypes';

let seeded = false;
/** Idempotent first-run seeding; runs once per app process after migrations succeed. */
function seedOnce(): true {
  if (!seeded) {
    ensureDefaultMealTypes(db);
    seeded = true;
  }
  return true;
}

/** Runs migrations and seeds defaults before any screen touches the database. */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { success, error } = useMigrations(expoDb, migrations);

  if (error) {
    return (
      <View className="flex-1 justify-center bg-bg">
        <EmptyState
          icon="alert-circle-outline"
          title={t('errors.dbTitle')}
          message={error.message}
        />
      </View>
    );
  }
  if (!success || !seedOnce()) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator />
      </View>
    );
  }
  return <>{children}</>;
}
