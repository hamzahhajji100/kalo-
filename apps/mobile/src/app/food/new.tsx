import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { upsertFood } from '@/data/repositories/foods';
import { useDbMutation } from '@/features/diary/queries';
import {
  buildCustomFood,
  emptyCustomFood,
  type CustomFoodForm,
  type CustomFoodErrors,
} from '@/features/foods/customFood';
import { openFood } from '@/features/foods/navigation';
import { newId } from '@/lib/id';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, NumberField, SheetScreen, Text, TextField } from '@/ui';

/** Create a product, e.g. after scanning an unknown barcode. Values are entered per 100 g/ml as on EU labels. */
export default function NewFoodScreen() {
  const { t } = useTranslation();
  const { color } = useTheme();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ barcode?: string; date?: string; meal?: string }>();
  const [form, setForm] = useState<CustomFoodForm>(() => emptyCustomFood(params.barcode ?? ''));
  const [errors, setErrors] = useState<CustomFoodErrors>({});
  const id = useMemo(() => newId(), []);

  const save = useDbMutation(
    (db, food: Parameters<typeof upsertFood>[1]) => upsertFood(db, food),
    () => [['recentScans']],
  );

  const set = (key: keyof CustomFoodForm) => (v: string) => setForm((f) => ({ ...f, [key]: v }));
  const field = (key: keyof CustomFoodForm, label: string, unit = 'g') => (
    <NumberField
      label={label}
      unit={unit}
      value={form[key] as string}
      onChangeText={set(key)}
      error={errors[key]}
      placeholder={unit === 'kcal' ? '0' : '0,0'}
    />
  );
  const unit = form.isLiquid ? '100 ml' : '100 g';

  const onSave = () => {
    const r = buildCustomFood(form, id, t);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    save.mutate(r.food, {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ['recentScans'] });
        router.back();
        openFood(r.food, {
          ...(params.date && { date: params.date }),
          ...(params.meal && { meal: params.meal }),
          via: 'barcode',
        });
      },
    });
  };

  return (
    <SheetScreen
      title={t('customFood.title')}
      footer={<Button label={t('customFood.save')} onPress={onSave} loading={save.isPending} />}
    >
      <TextField
        label={t('customFood.name')}
        value={form.name}
        onChangeText={set('name')}
        placeholder={t('customFood.namePlaceholder')}
      />
      {errors.name ? <Text className="-mt-3 text-sm text-danger">{errors.name}</Text> : null}
      <TextField label={t('customFood.brand')} value={form.brand} onChangeText={set('brand')} />
      <NumberField
        label={t('customFood.barcode')}
        value={form.barcode}
        onChangeText={set('barcode')}
        error={errors.barcode}
      />

      <View className="flex-row items-center justify-between">
        <Text>{t('customFood.isLiquid')}</Text>
        <Switch
          accessibilityLabel={t('customFood.isLiquid')}
          value={form.isLiquid}
          onValueChange={(isLiquid) => setForm((f) => ({ ...f, isLiquid }))}
          trackColor={{ true: color('brand') }}
        />
      </View>

      <Text variant="heading">{t('customFood.per', { unit })}</Text>
      {errors.plausibility ? (
        <Text className="text-sm text-danger" accessibilityLiveRegion="polite">
          {errors.plausibility}
        </Text>
      ) : null}
      {field('kcal', t('food.energy'), 'kcal')}
      <View className="flex-row gap-3">
        <View className="flex-1">{field('fat', t('macros.fat'))}</View>
        <View className="flex-1">{field('saturatedFat', t('customFood.saturatedFatShort'))}</View>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">{field('carbs', t('macros.carbs'))}</View>
        <View className="flex-1">{field('sugar', t('customFood.sugarShort'))}</View>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">{field('protein', t('macros.protein'))}</View>
        <View className="flex-1">{field('fiber', t('food.fiber'))}</View>
      </View>
      {field('salt', t('food.salt'))}

      <Text variant="heading">{t('customFood.portions')}</Text>
      <View className="flex-row gap-3">
        <View className="flex-1">
          {field('servingGrams', t('food.serving'), form.isLiquid ? 'ml' : 'g')}
        </View>
        <View className="flex-1">
          {field('packageGrams', t('food.package'), form.isLiquid ? 'ml' : 'g')}
        </View>
      </View>
    </SheetScreen>
  );
}
