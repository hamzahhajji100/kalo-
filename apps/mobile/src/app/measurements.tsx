import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { upsertMeasurement } from '@/data/repositories/body';
import { useDbMutation } from '@/features/diary/queries';
import { progressKey } from '@/features/progress/queries';
import { localIsoDate } from '@/lib/date';
import { parseDecimal } from '@/lib/number';
import { Button, NumberField, SheetScreen, Text } from '@/ui';

const FIELDS = ['waistCm', 'hipCm', 'chestCm', 'armCm', 'thighCm'] as const;

export default function MeasurementsScreen() {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<(typeof FIELDS)[number], string>>({
    waistCm: '',
    hipCm: '',
    chestCm: '',
    armCm: '',
    thighCm: '',
  });
  const parsed = Object.fromEntries(
    FIELDS.map((k) => [k, parseDecimal(values[k]) ?? null]),
  ) as Record<(typeof FIELDS)[number], number | null>;
  const invalid = FIELDS.filter((k) => parsed[k] !== null && (parsed[k]! < 10 || parsed[k]! > 250));
  const any = FIELDS.some((k) => parsed[k] !== null);
  const save = useDbMutation(
    (db, _: void) => upsertMeasurement(db, { date: localIsoDate(), ...parsed }),
    () => [progressKey],
  );

  return (
    <SheetScreen
      title={t('progress.addMeasurement')}
      footer={
        <Button
          label={t('common.save')}
          disabled={!any || invalid.length > 0}
          loading={save.isPending}
          onPress={() => save.mutate(undefined, { onSuccess: () => router.back() })}
        />
      }
    >
      <Text variant="caption">{t('measurements.hint')}</Text>
      {FIELDS.map((k) => (
        <NumberField
          key={k}
          label={t(`measurements.${k}`)}
          unit="cm"
          placeholder={t('onboarding.optional')}
          value={values[k]}
          onChangeText={(v) => setValues((s) => ({ ...s, [k]: v }))}
          error={invalid.includes(k) ? t('measurements.invalid') : undefined}
        />
      ))}
    </SheetScreen>
  );
}
