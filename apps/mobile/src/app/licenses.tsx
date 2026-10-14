import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';

import { catalogInfo } from '@/data/catalog';
import { formatInt } from '@/lib/format';
import { Button, Card, SheetScreen, Text } from '@/ui';

const SOURCES = [
  {
    key: 'off',
    url: 'https://world.openfoodfacts.org',
    license: 'https://opendatacommons.org/licenses/odbl/1-0/',
  },
  {
    key: 'usda',
    url: 'https://fdc.nal.usda.gov',
    license: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
] as const;

/** Data sources and licences, as required by the ODbL (attribution) and good practice for USDA. */
export default function LicensesScreen() {
  const { t } = useTranslation();
  const { data: info } = useQuery({ queryKey: ['catalogInfo'], queryFn: () => catalogInfo() });
  return (
    <SheetScreen title={t('settings.licenses')}>
      {SOURCES.map((s) => (
        <Card key={s.key} className="gap-2">
          <Text variant="heading">{t(`licenses.${s.key}.title`)}</Text>
          <Text>{t(`licenses.${s.key}.body`)}</Text>
          <View className="flex-row gap-3">
            <Button
              variant="ghost"
              label={t('licenses.website')}
              onPress={() => void Linking.openURL(s.url)}
            />
            <Button
              variant="ghost"
              label={t('licenses.license')}
              onPress={() => void Linking.openURL(s.license)}
            />
          </View>
        </Card>
      ))}
      <Card className="gap-1">
        <Text variant="heading">{t('licenses.catalog')}</Text>
        <Text variant="caption">
          {info
            ? t('licenses.catalogInfo', {
                count: formatInt(info.foods),
                date: info.builtAt?.slice(0, 10) ?? '–',
              })
            : t('licenses.catalogLoading')}
        </Text>
      </Card>
      <Text variant="caption">{t('licenses.ai')}</Text>
    </SheetScreen>
  );
}
