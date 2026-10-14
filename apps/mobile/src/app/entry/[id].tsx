import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { db } from '@/data/client';
import type { DiaryEntry } from '@/data/repositories/diary';
import {
  deleteEntry,
  entryNutrients,
  getEntry,
  moveEntry,
  updateEntryAmount,
  updateEntryDetails,
} from '@/data/repositories/diary';
import { MealPicker } from '@/features/diary/components/MealPicker';
import { keys, useDbMutation } from '@/features/diary/queries';
import { formatInt } from '@/lib/format';
import { Button, Card, EmptyState, NumberField, parseDecimal, SheetScreen, Text } from '@/ui';

export default function EditEntryScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: entry, isLoading } = useQuery({
    queryKey: ['entry', id],
    queryFn: () => getEntry(db, id) ?? null,
  });

  if (isLoading) return <SheetScreen title="">{null}</SheetScreen>;
  if (!entry) {
    return (
      <SheetScreen title={t('entry.title')}>
        <EmptyState icon="help-circle-outline" title={t('entry.notFound')} />
      </SheetScreen>
    );
  }
  return <EditEntryForm entry={entry} />;
}

function EditEntryForm({ entry }: { entry: DiaryEntry }) {
  const { t } = useTranslation();
  const id = entry.id;
  const [amount, setAmount] = useState(
    String(Math.round((entry.grams ?? entry.kcal) * 10) / 10).replace('.', ','),
  );
  const [mealTypeId, setMealTypeId] = useState<number>(entry.mealTypeId);

  const invalidate = () => [keys.day(entry.date), keys.recent, ['entry', id]];
  const save = useDbMutation((d, v: { value: number; meal: number }) => {
    d.transaction(() => {
      if (entry.grams) updateEntryAmount(d, entry.id, v.value);
      else {
        // Quick entries: scale macros with the calorie change so the split stays consistent.
        const n = entryNutrients(entry);
        const f = entry.kcal > 0 ? v.value / entry.kcal : 0;
        updateEntryDetails(d, entry.id, {
          nutrients: {
            ...n,
            kcal: v.value,
            protein: n.protein * f,
            carbs: n.carbs * f,
            fat: n.fat * f,
          },
        });
      }
      if (v.meal !== entry.mealTypeId) moveEntry(d, entry.id, v.meal);
    });
  }, invalidate);
  const remove = useDbMutation((d, _: void) => deleteEntry(d, id), invalidate);

  const value = parseDecimal(amount);
  const valid = value !== undefined && value > 0 && value <= (entry.grams ? 5000 : 10000);
  const factor = valid ? value / (entry.grams ?? entry.kcal) : 1;

  const confirmDelete = () =>
    Alert.alert(t('entry.deleteTitle'), entry.name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => remove.mutate(undefined, { onSuccess: () => router.back() }),
      },
    ]);

  return (
    <SheetScreen
      title={entry.name}
      footer={
        <>
          <Button
            label={t('common.save')}
            disabled={!valid}
            loading={save.isPending}
            onPress={() =>
              save.mutate({ value: value!, meal: mealTypeId }, { onSuccess: () => router.back() })
            }
          />
          <Button variant="ghost" label={t('common.delete')} onPress={confirmDelete} />
        </>
      }
    >
      {entry.brand ? <Text variant="caption">{entry.brand}</Text> : null}
      <NumberField
        label={entry.grams ? t('entry.amount') : t('quick.kcal')}
        unit={entry.grams ? 'g' : 'kcal'}
        value={amount}
        onChangeText={setAmount}
        selectTextOnFocus
        error={amount && !valid ? t('entry.invalidAmount') : undefined}
      />
      <Card className="flex-row justify-between">
        {(
          [
            ['kcal', entry.kcal, 'kcal'],
            ['protein', entry.protein, 'g'],
            ['carbsShort', entry.carbs, 'g'],
            ['fat', entry.fat, 'g'],
          ] as const
        ).map(([k, v, unit]) => (
          <View key={k} className="items-center">
            <Text className="text-lg font-bold text-text">{formatInt(v * factor)}</Text>
            <Text variant="caption">{k === 'kcal' ? unit : `${t(`macros.${k}`)} (${unit})`}</Text>
          </View>
        ))}
      </Card>
      <MealPicker value={mealTypeId} onChange={setMealTypeId} />
    </SheetScreen>
  );
}
