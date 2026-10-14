import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '@/data/client';
import { listUserFoods } from '@/data/repositories/foods';
import { hasValidCheckDigit, digitsOnly } from '@/features/barcode/gtin';
import type { LookupResult } from '@/features/barcode/lookup';
import { useBarcodeLookup } from '@/features/barcode/useBarcodeLookup';
import { useAddTarget } from '@/features/diary/useAddTarget';
import { openFood } from '@/features/foods/navigation';
import { Button, EmptyState, NumberField, Text } from '@/ui';

type State =
  | { kind: 'scanning' }
  | { kind: 'loading'; code: string }
  | { kind: 'result'; result: Exclude<LookupResult, { status: 'found' }> };

const FRAME_W = 280;
const FRAME_H = 170;

export default function BarcodeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [state, setState] = useState<State>({ kind: 'scanning' });
  const [manual, setManual] = useState<string | null>(null);
  const busy = useRef(false);
  const lookup = useBarcodeLookup();
  const target = useAddTarget();
  const nav = {
    date: target.date,
    ...(target.mealTypeId !== undefined && { meal: String(target.mealTypeId) }),
    via: 'barcode' as const,
  };

  const { data: recent = [] } = useQuery({
    queryKey: ['recentScans'],
    queryFn: () =>
      listUserFoods(db, { limit: 50 })
        .filter((f) => f.barcode)
        .slice(0, 10),
  });

  const handleCode = useCallback(
    async (raw: string, type?: string) => {
      if (busy.current) return;
      const code = digitsOnly(raw);
      // Ignore misreads: product codes must carry a valid GS1 check digit.
      if (!hasValidCheckDigit(code) && !(type?.includes('upc_e') && code.length === 8)) return;
      busy.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setState({ kind: 'loading', code });
      try {
        const result = await lookup(code, type);
        if (result.status === 'found') {
          router.back();
          openFood(result.food, nav);
          return;
        }
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setState({ kind: 'result', result });
      } catch {
        setState({ kind: 'result', result: { status: 'offline', code } });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lookup, target.date, target.mealTypeId],
  );

  const rescan = () => {
    busy.current = false;
    setState({ kind: 'scanning' });
  };

  if (!permission) return <View className="flex-1 bg-black" />;
  if (!permission.granted) {
    return (
      <View className="flex-1 justify-center bg-bg" style={{ paddingBottom: insets.bottom }}>
        <EmptyState
          icon="camera-outline"
          title={t('barcode.permissionTitle')}
          message={t('barcode.permissionBody')}
          actionLabel={permission.canAskAgain ? t('barcode.allow') : t('barcode.openSettings')}
          onAction={() =>
            permission.canAskAgain ? void requestPermission() : void Linking.openSettings()
          }
        />
        <Button variant="ghost" label={t('common.close')} onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={
          state.kind === 'scanning'
            ? (r: BarcodeScanningResult) => void handleCode(r.data, r.type)
            : undefined
        }
      />

      {/* Dimmed overlay with a clear scan window. */}
      <View
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        className="items-center justify-center"
      >
        <View
          style={{ width: FRAME_W, height: FRAME_H }}
          className="rounded-3xl border-2 border-white/90"
        />
        <Text
          className="mt-4 text-center text-white"
          style={{ textShadowColor: 'black', textShadowRadius: 6 }}
        >
          {state.kind === 'loading'
            ? t('barcode.lookingUp', { code: state.code })
            : t('barcode.hint')}
        </Text>
        {state.kind === 'loading' && <ActivityIndicator color="white" className="mt-3" />}
      </View>

      <View
        className="absolute left-0 right-0 flex-row justify-between px-5"
        style={{ top: insets.top + 8 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={() => router.back()}
          className="h-11 w-11 items-center justify-center rounded-full bg-black/50"
        >
          <Ionicons name="close" size={24} color="white" />
        </Pressable>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={t('barcode.torch')}
          accessibilityState={{ checked: torch }}
          onPress={() => setTorch((v) => !v)}
          className="h-11 w-11 items-center justify-center rounded-full bg-black/50"
        >
          <Ionicons name={torch ? 'flash' : 'flash-off'} size={22} color="white" />
        </Pressable>
      </View>

      <View
        className="absolute bottom-0 left-0 right-0 gap-3 rounded-t-3xl bg-surface px-5 pt-5"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        {state.kind === 'result' ? (
          <>
            <Text variant="heading" accessibilityLiveRegion="polite">
              {state.result.status === 'offline'
                ? t('barcode.offlineTitle')
                : t('barcode.notFoundTitle')}
            </Text>
            <Text variant="caption">
              {state.result.status === 'offline'
                ? t('barcode.offlineBody')
                : t('barcode.notFoundBody', { code: state.result.code })}
            </Text>
            <Button
              label={t('barcode.createProduct')}
              onPress={() =>
                router.replace({
                  pathname: '/food/new',
                  params: {
                    barcode: state.result.code,
                    ...(nav.meal && { meal: nav.meal }),
                    date: nav.date,
                  },
                })
              }
            />
            <Button
              variant="secondary"
              label={state.result.status === 'offline' ? t('common.retry') : t('barcode.scanAgain')}
              onPress={() =>
                state.result.status === 'offline'
                  ? (rescan(), void handleCode(state.result.code))
                  : rescan()
              }
            />
          </>
        ) : manual !== null ? (
          <>
            <NumberField
              label={t('barcode.manualLabel')}
              value={manual}
              onChangeText={setManual}
              autoFocus
              placeholder="4001234567890"
            />
            <Button
              label={t('barcode.lookup')}
              disabled={digitsOnly(manual).length < 8}
              onPress={() => void handleCode(manual)}
            />
            <Button variant="ghost" label={t('common.cancel')} onPress={() => setManual(null)} />
          </>
        ) : (
          <>
            {recent.length > 0 && (
              <View className="gap-2">
                <Text variant="label">{t('barcode.recent')}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="gap-2"
                >
                  {recent.map((f) => (
                    <Pressable
                      key={f.id}
                      accessibilityRole="button"
                      onPress={() => {
                        router.back();
                        openFood(f, nav);
                      }}
                      className="max-w-[180px] rounded-2xl bg-surface-2 px-3 py-2"
                    >
                      <Text numberOfLines={1} className="font-medium text-text">
                        {f.name}
                      </Text>
                      {f.brand ? (
                        <Text variant="caption" numberOfLines={1}>
                          {f.brand}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            <Button variant="secondary" label={t('barcode.manual')} onPress={() => setManual('')} />
          </>
        )}
      </View>
    </View>
  );
}
