import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAddTarget } from '@/features/diary/useAddTarget';
import { useAnalysis } from '@/features/photo/analysisStore';
import { toAiError, type AiErrorKind } from '@/features/photo/api';
import { ensurePhotoConsent } from '@/features/photo/consent';
import { runPhotoAnalysis } from '@/features/photo/runAnalysis';
import { config } from '@/lib/config';
import { Button, EmptyState, Text } from '@/ui';

type Photo = { uri: string; width: number; height: number };
type State =
  | { kind: 'camera' }
  | { kind: 'analyzing'; photo: Photo }
  | { kind: 'error'; photo: Photo; error: AiErrorKind | 'no_food'; retryAfter?: number };

export default function PhotoScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [torch, setTorch] = useState(false);
  const [state, setState] = useState<State>({ kind: 'camera' });
  const start = useAnalysis((s) => s.start);
  const target = useAddTarget();
  const params = {
    date: target.date,
    ...(target.mealTypeId !== undefined && { meal: String(target.mealTypeId) }),
  };

  const analyse = async (photo: Photo) => {
    if (!(await ensurePhotoConsent())) return;
    setState({ kind: 'analyzing', photo });
    try {
      const r = await runPhotoAnalysis(photo, i18n.language === 'en' ? 'en' : 'de');
      if (r.status === 'no_food') {
        setState({ kind: 'error', photo, error: 'no_food' });
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      start({ photoUri: photo.uri, dishName: r.dishName, notes: r.notes, items: r.items });
      router.replace({ pathname: '/analysis', params });
    } catch (e) {
      const err = toAiError(e);
      setState({
        kind: 'error',
        photo,
        error: err.kind,
        ...(err.retryAfter !== undefined && { retryAfter: err.retryAfter }),
      });
    }
  };

  const shoot = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const pic = await camera.current?.takePictureAsync({ quality: 0.8, skipProcessing: false });
    if (pic) void analyse({ uri: pic.uri, width: pic.width, height: pic.height });
  };

  const pickFromLibrary = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    const asset = res.canceled ? undefined : res.assets[0];
    if (asset) void analyse({ uri: asset.uri, width: asset.width, height: asset.height });
  };

  if (!config.apiUrl) {
    return (
      <View className="flex-1 justify-center bg-bg" style={{ paddingBottom: insets.bottom }}>
        <EmptyState
          icon="sparkles-outline"
          title={t('photo.notConfiguredTitle')}
          message={t('photo.notConfiguredBody')}
          actionLabel={t('add.search')}
          onAction={() => router.replace({ pathname: '/add/search', params })}
        />
        <Button variant="ghost" label={t('common.close')} onPress={() => router.back()} />
      </View>
    );
  }
  if (!permission) return <View className="flex-1 bg-black" />;
  if (!permission.granted && state.kind === 'camera') {
    return (
      <View className="flex-1 justify-center bg-bg" style={{ paddingBottom: insets.bottom }}>
        <EmptyState
          icon="camera-outline"
          title={t('photo.permissionTitle')}
          message={t('photo.permissionBody')}
          actionLabel={permission.canAskAgain ? t('barcode.allow') : t('barcode.openSettings')}
          onAction={() =>
            permission.canAskAgain ? void requestPermission() : void Linking.openSettings()
          }
        />
        <Button
          variant="secondary"
          label={t('photo.fromLibrary')}
          onPress={() => void pickFromLibrary()}
          className="mx-8"
        />
        <Button variant="ghost" label={t('common.close')} onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {state.kind === 'camera' ? (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
        />
      ) : (
        <Image
          source={{ uri: state.photo.uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      )}

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
        {state.kind === 'camera' && (
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel={t('barcode.torch')}
            accessibilityState={{ checked: torch }}
            onPress={() => setTorch((v) => !v)}
            className="h-11 w-11 items-center justify-center rounded-full bg-black/50"
          >
            <Ionicons name={torch ? 'flash' : 'flash-off'} size={22} color="white" />
          </Pressable>
        )}
      </View>

      {state.kind === 'camera' && (
        <View
          className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between px-10"
          style={{ paddingBottom: insets.bottom + 28 }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('photo.fromLibrary')}
            onPress={() => void pickFromLibrary()}
            className="h-12 w-12 items-center justify-center rounded-full bg-black/50"
          >
            <Ionicons name="images-outline" size={24} color="white" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('photo.shutter')}
            onPress={() => void shoot()}
            className="h-20 w-20 items-center justify-center rounded-full border-4 border-white active:scale-95"
          >
            <View className="h-16 w-16 rounded-full bg-white" />
          </Pressable>
          <View className="h-12 w-12" />
        </View>
      )}

      {state.kind === 'camera' && (
        <Text
          className="absolute left-0 right-0 text-center text-white"
          style={{ top: insets.top + 70, textShadowColor: 'black', textShadowRadius: 6 }}
        >
          {t('photo.hint')}
        </Text>
      )}

      {state.kind === 'analyzing' && (
        <View
          className="absolute bottom-0 left-0 right-0 items-center gap-3 rounded-t-3xl bg-surface px-5 pt-6"
          style={{ paddingBottom: insets.bottom + 24 }}
          accessibilityLiveRegion="polite"
        >
          <ActivityIndicator size="large" />
          <Text variant="heading">{t('photo.analyzing')}</Text>
          <Text variant="caption" className="text-center">
            {t('photo.analyzingHint')}
          </Text>
        </View>
      )}

      {state.kind === 'error' && (
        <View
          className="absolute bottom-0 left-0 right-0 gap-3 rounded-t-3xl bg-surface px-5 pt-6"
          style={{ paddingBottom: insets.bottom + 16 }}
          accessibilityLiveRegion="polite"
        >
          <Text variant="heading">{t(`photo.errors.${state.error}.title`)}</Text>
          <Text variant="caption">
            {t(`photo.errors.${state.error}.body`, {
              hours: Math.max(1, Math.ceil((state.retryAfter ?? 0) / 3600)),
            })}
          </Text>
          {['offline', 'timeout', 'server'].includes(state.error) && (
            <Button label={t('common.retry')} onPress={() => void analyse(state.photo)} />
          )}
          <Button
            variant={state.error === 'no_food' ? 'primary' : 'secondary'}
            label={t('photo.newPhoto')}
            onPress={() => setState({ kind: 'camera' })}
          />
          <Button
            variant="ghost"
            label={t('photo.searchInstead')}
            onPress={() => router.replace({ pathname: '/add/search', params })}
          />
        </View>
      )}
    </View>
  );
}
