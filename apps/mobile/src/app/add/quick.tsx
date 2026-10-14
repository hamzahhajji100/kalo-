import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { addEntry } from '@/data/repositories/diary';
import { MealPicker } from '@/features/diary/components/MealPicker';
import { keys, useDbMutation } from '@/features/diary/queries';
import { useAddTarget } from '@/features/diary/useAddTarget';
import { Button, NumberField, parseDecimal, SheetScreen, TextField } from '@/ui';

/** Log calories (and optionally macros) without a food, e.g. for restaurant meals. */
export default function QuickAddScreen() {
  const { t } = useTranslation();
  const target = useAddTarget();
  const [mealTypeId, setMealTypeId] = useState<number | undefined>();
  const [name, setName] = useState('');
  const [values, setValues] = useState({ kcal: '', protein: '', carbs: '', fat: '' });
  const [submitted, setSubmitted] = useState(false);

  const kcal = parseDecimal(values.kcal);
  const kcalError =
    kcal === undefined || kcal <= 0 || kcal > 10000 ? t('quick.kcalError') : undefined;
  const meal = mealTypeId ?? target.mealTypeId;

  const save = useDbMutation(
    (db, _: void) =>
      addEntry(db, {
        date: target.date,
        mealTypeId: meal!,
        name: name.trim() || t('quick.defaultName'),
        nutrients: {
          kcal: kcal!,
          protein: parseDecimal(values.protein) ?? 0,
          carbs: parseDecimal(values.carbs) ?? 0,
          fat: parseDecimal(values.fat) ?? 0,
        },
        source: 'quick',
      }),
    () => [keys.day(target.date)],
  );

  const onSave = () => {
    setSubmitted(true);
    if (kcalError || meal === undefined) return;
    save.mutate(undefined, { onSuccess: () => router.dismissAll() });
  };

  const field = (key: keyof typeof values) => ({
    value: values[key],
    onChangeText: (v: string) => setValues((s) => ({ ...s, [key]: v })),
  });

  return (
    <SheetScreen
      title={t('add.quick')}
      footer={<Button label={t('common.save')} onPress={onSave} loading={save.isPending} />}
    >
      <NumberField
        label={t('quick.kcal')}
        unit="kcal"
        autoFocus
        placeholder="0"
        error={submitted ? kcalError : undefined}
        {...field('kcal')}
      />
      <TextField
        label={t('quick.name')}
        placeholder={t('quick.defaultName')}
        value={name}
        onChangeText={setName}
      />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <NumberField label={t('macros.protein')} unit="g" placeholder="–" {...field('protein')} />
        </View>
        <View className="flex-1">
          <NumberField
            label={t('macros.carbsShort')}
            unit="g"
            placeholder="–"
            {...field('carbs')}
          />
        </View>
        <View className="flex-1">
          <NumberField label={t('macros.fat')} unit="g" placeholder="–" {...field('fat')} />
        </View>
      </View>
      <MealPicker value={meal} onChange={setMealTypeId} />
    </SheetScreen>
  );
}
