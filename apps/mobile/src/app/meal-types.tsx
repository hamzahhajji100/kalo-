import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch, View } from 'react-native';

import { db } from '@/data/client';
import {
  addMealType,
  listMealTypes,
  renameMealType,
  setMealTypeArchived,
} from '@/data/repositories/mealTypes';
import { mealName } from '@/features/diary/components/MealSection';
import { keys } from '@/features/diary/queries';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, SheetScreen, Text, TextField } from '@/ui';

/** Add, rename and hide meals. Hidden meals keep their past entries. */
export default function MealTypesScreen() {
  const { t } = useTranslation();
  const { color } = useTheme();
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ['mealTypes', 'all'],
    queryFn: () => listMealTypes(db, { includeArchived: true }),
  });
  const [name, setName] = useState('');
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['mealTypes'] });
    void qc.invalidateQueries({ queryKey: ['day'] });
  };

  return (
    <SheetScreen title={t('settings.mealTypes')}>
      {data.map((m) => (
        <View key={m.id} className="flex-row items-center gap-3">
          <View className="flex-1">
            <TextField
              label={m.key ? t(`meals.${m.key}`) : t('settings.customMeal')}
              defaultValue={mealName(m, t)}
              onEndEditing={(e) => {
                const v = e.nativeEvent.text.trim();
                if (v && v !== mealName(m, t)) {
                  renameMealType(db, m.id, v);
                  refresh();
                }
              }}
            />
          </View>
          <View className="items-center pt-5">
            <Switch
              accessibilityLabel={t('settings.showMeal', { name: mealName(m, t) })}
              value={!m.archived}
              onValueChange={(v) => {
                setMealTypeArchived(db, m.id, !v);
                refresh();
              }}
              trackColor={{ true: color('brand') }}
            />
          </View>
        </View>
      ))}
      <Text variant="caption">{t('settings.mealTypesHint')}</Text>
      <TextField
        label={t('settings.newMeal')}
        value={name}
        onChangeText={setName}
        placeholder={t('settings.newMealPlaceholder')}
      />
      <Button
        variant="secondary"
        label={t('settings.addMeal')}
        disabled={!name.trim()}
        onPress={() => {
          addMealType(db, name.trim());
          setName('');
          refresh();
          void qc.invalidateQueries({ queryKey: keys.mealTypes });
        }}
      />
    </SheetScreen>
  );
}
