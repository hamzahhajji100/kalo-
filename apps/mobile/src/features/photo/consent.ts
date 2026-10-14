import { Alert } from 'react-native';

import i18n from '@/i18n';
import { usePreferences } from '@/lib/preferences';

/**
 * Ask once before the first photo leaves the device (photos of meals can reveal health information).
 * Resolves true if the user agreed now or earlier.
 */
export function ensurePhotoConsent(): Promise<boolean> {
  if (usePreferences.getState().photoConsent) return Promise.resolve(true);
  return new Promise((resolve) => {
    Alert.alert(i18n.t('consent.title'), i18n.t('consent.body'), [
      { text: i18n.t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
      {
        text: i18n.t('consent.agree'),
        onPress: () => {
          usePreferences.getState().set({ photoConsent: true });
          resolve(true);
        },
      },
    ]);
  });
}
