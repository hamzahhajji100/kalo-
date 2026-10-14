import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { upsertWeight } from '@/data/repositories/body';
import { keys, useDbMutation, useLatestWeight } from '@/features/diary/queries';
import { localIsoDate } from '@/lib/date';
import { useWeightUnit } from '@/lib/units';
import { Button, NumberField, parseDecimal, SheetScreen, Text } from '@/ui';

export default function LogWeightScreen() {
  const { t } = useTranslation();
  const { data: latest } = useLatestWeight();
  const units = useWeightUnit();
  const [value, setValue] = useState('');
  const input = parseDecimal(value);
  const kg = input === undefined ? undefined : units.toKg(input);
  const valid = kg !== undefined && kg >= 30 && kg <= 350;
  const today = localIsoDate();

  const save = useDbMutation(
    (db, v: number) => upsertWeight(db, today, v),
    () => [keys.body, ['progress'], ['coach']],
  );

  return (
    <SheetScreen
      title={t('home.logWeight')}
      footer={
        <Button
          label={t('common.save')}
          disabled={!valid}
          loading={save.isPending}
          onPress={() => save.mutate(kg!, { onSuccess: () => router.back() })}
        />
      }
    >
      <NumberField
        label={t('weight.today')}
        unit={units.unit}
        autoFocus
        placeholder={
          latest
            ? String(Math.round(units.toDisplay(latest.kg) * 10) / 10).replace('.', ',')
            : '70,0'
        }
        value={value}
        onChangeText={setValue}
        error={value && !valid ? t('weight.invalid') : undefined}
      />
      <Text variant="caption">{t('weight.hint')}</Text>
    </SheetScreen>
  );
}
