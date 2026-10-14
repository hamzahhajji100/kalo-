import { ageOn, type ActivityLevel, type Diet, type Goal, type Pace } from '@kalo/core';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/data/client';
import { latestWeight } from '@/data/repositories/body';
import { getProfile } from '@/data/repositories/profile';
import { planFor } from '@/features/coach/logic';
import {
  draftFromProfile,
  emptyDraft,
  profileFromDraft,
  type OnboardingDraft,
} from '@/features/coach/onboardingDraft';
import { PlanPreview } from '@/features/coach/PlanPreview';
import { completeOnboarding } from '@/features/coach/service';
import { localIsoDate } from '@/lib/date';
import { formatDecimal } from '@/lib/format';
import { parseDecimal } from '@/lib/number';
import { usePreferences } from '@/lib/preferences';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Chips, NumberField, OptionCard, ProgressBar, Text } from '@/ui';

type Step = 'welcome' | 'goal' | 'body' | 'activity' | 'target' | 'diet' | 'plan';

const ACTIVITIES: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const DIETS: Diet[] = ['omnivore', 'vegetarian', 'vegan', 'pescetarian', 'low_carb', 'keto'];
const ALLERGIES = [
  'gluten',
  'milk',
  'eggs',
  'nuts',
  'peanuts',
  'soybeans',
  'fish',
  'crustaceans',
  'sesame-seeds',
  'celery',
];
const LOSS_RATE: Record<Pace, number> = { slow: 0.0025, medium: 0.005, fast: 0.01 };

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { color } = useTheme();
  const qc = useQueryClient();
  const setPrefs = usePreferences((s) => s.set);
  const editing = useLocalSearchParams<{ edit?: string }>().edit === '1';
  const today = localIsoDate();

  const [draft, setDraft] = useState<OnboardingDraft>(() => {
    const p = editing ? getProfile(db) : undefined;
    const w = latestWeight(db)?.kg;
    return p && w ? draftFromProfile(p, w, ageOn(p.birthDate, today)) : emptyDraft();
  });
  const steps: Step[] = useMemo(
    () => [
      ...(editing ? [] : (['welcome'] as Step[])),
      'goal',
      'body',
      'activity',
      ...(draft.goal === 'maintain' ? [] : (['target'] as Step[])),
      'diet',
      'plan',
    ],
    [editing, draft.goal],
  );
  const [index, setIndex] = useState(0);
  const step = steps[Math.min(index, steps.length - 1)]!;
  const set = <K extends keyof OnboardingDraft>(k: K, v: OnboardingDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const parsed = profileFromDraft(draft, today);
  const plan = parsed.ok ? planFor(parsed.profile, parsed.weightKg, today) : null;

  const canContinue: Record<Step, boolean> = {
    welcome: true,
    goal: !!draft.goal,
    body:
      !!draft.sex &&
      ['age', 'heightCm', 'weightKg'].every(
        (k) => !(!parsed.ok && parsed.missing.includes(k as keyof OnboardingDraft)),
      ),
    activity: !!draft.activity,
    target: !(!parsed.ok && parsed.missing.includes('targetWeightKg')),
    diet: parsed.ok,
    plan: parsed.ok,
  };

  const finish = (withoutTargets = false) => {
    if (!parsed.ok) return;
    completeOnboarding(db, {
      profile: parsed.profile,
      weightKg: parsed.weightKg,
      today,
      reason: editing ? 'profile_changed' : 'onboarding',
    });
    setPrefs({ hasOnboarded: true, ...(withoutTargets && { relaxedMode: true }) });
    void qc.invalidateQueries();
    if (editing) router.back();
    else router.replace('/');
  };

  const next = () => (step === 'plan' ? finish() : setIndex((i) => i + 1));
  const weight = parseDecimal(draft.weightKg);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <View className="gap-3 px-5 pt-2">
        <ProgressBar fraction={(index + 1) / steps.length} color={color('brand')} />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-4 px-5 pb-8 pt-6"
      >
        <Animated.View key={step} entering={FadeInRight.duration(220)} className="gap-4">
          {step === 'welcome' && (
            <>
              <Text variant="display">Kalo</Text>
              <Text variant="title">{t('onboarding.welcomeTitle')}</Text>
              <Text>{t('onboarding.welcomeBody')}</Text>
              <Text variant="caption">{t('onboarding.disclaimer')}</Text>
            </>
          )}

          {step === 'goal' && (
            <>
              <Text variant="title" accessibilityRole="header">
                {t('onboarding.goalTitle')}
              </Text>
              {(['lose', 'maintain', 'gain'] as Goal[]).map((g) => (
                <OptionCard
                  key={g}
                  icon={
                    g === 'lose'
                      ? 'trending-down'
                      : g === 'gain'
                        ? 'barbell-outline'
                        : 'swap-horizontal'
                  }
                  title={t(`onboarding.goals.${g}.title`)}
                  subtitle={t(`onboarding.goals.${g}.subtitle`)}
                  selected={draft.goal === g}
                  onPress={() => set('goal', g)}
                />
              ))}
            </>
          )}

          {step === 'body' && (
            <>
              <Text variant="title" accessibilityRole="header">
                {t('onboarding.bodyTitle')}
              </Text>
              <Chips
                accessibilityLabel={t('onboarding.sex')}
                value={draft.sex ?? undefined}
                onChange={(v) => set('sex', v)}
                options={[
                  { value: 'female', label: t('onboarding.female') },
                  { value: 'male', label: t('onboarding.male') },
                ]}
              />
              <Text variant="caption">{t('onboarding.sexHint')}</Text>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <NumberField
                    label={t('onboarding.age')}
                    unit={t('onboarding.years')}
                    value={draft.age}
                    onChangeText={(v) => set('age', v)}
                  />
                </View>
                <View className="flex-1">
                  <NumberField
                    label={t('onboarding.height')}
                    unit="cm"
                    value={draft.heightCm}
                    onChangeText={(v) => set('heightCm', v)}
                  />
                </View>
              </View>
              <NumberField
                label={t('onboarding.weight')}
                unit="kg"
                value={draft.weightKg}
                onChangeText={(v) => set('weightKg', v)}
              />
              <NumberField
                label={t('onboarding.bodyFat')}
                unit="%"
                placeholder={t('onboarding.optional')}
                value={draft.bodyFatPct}
                onChangeText={(v) => set('bodyFatPct', v)}
              />
            </>
          )}

          {step === 'activity' && (
            <>
              <Text variant="title" accessibilityRole="header">
                {t('onboarding.activityTitle')}
              </Text>
              {ACTIVITIES.map((a) => (
                <OptionCard
                  key={a}
                  title={t(`onboarding.activity.${a}.title`)}
                  subtitle={t(`onboarding.activity.${a}.subtitle`)}
                  selected={draft.activity === a}
                  onPress={() => set('activity', a)}
                />
              ))}
              <Text variant="label">{t('onboarding.trainingDays')}</Text>
              <Chips
                accessibilityLabel={t('onboarding.trainingDays')}
                value={draft.trainingDays}
                onChange={(v) => set('trainingDays', v)}
                options={[0, 1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }))}
              />
              {draft.goal === 'gain' && (
                <>
                  <Text variant="label">{t('onboarding.experience')}</Text>
                  <Chips
                    accessibilityLabel={t('onboarding.experience')}
                    value={draft.experience}
                    onChange={(v) => set('experience', v)}
                    options={(['beginner', 'intermediate', 'advanced'] as const).map((e) => ({
                      value: e,
                      label: t(`onboarding.experienceLevels.${e}`),
                    }))}
                  />
                </>
              )}
            </>
          )}

          {step === 'target' && (
            <>
              <Text variant="title" accessibilityRole="header">
                {t('onboarding.targetTitle')}
              </Text>
              <NumberField
                label={t('onboarding.targetWeight')}
                unit="kg"
                placeholder={t('onboarding.optional')}
                value={draft.targetWeightKg}
                onChangeText={(v) => set('targetWeightKg', v)}
              />
              <Text variant="label">{t('onboarding.pace')}</Text>
              {(['slow', 'medium', 'fast'] as Pace[]).map((p) => (
                <OptionCard
                  key={p}
                  title={t(`onboarding.paces.${p}`)}
                  subtitle={
                    draft.goal === 'lose' && weight
                      ? t('onboarding.paceLoss', { kg: formatDecimal(weight * LOSS_RATE[p], 2) })
                      : t(`onboarding.paceGain.${p}`)
                  }
                  selected={draft.pace === p}
                  onPress={() => set('pace', p)}
                />
              ))}
            </>
          )}

          {step === 'diet' && (
            <>
              <Text variant="title" accessibilityRole="header">
                {t('onboarding.dietTitle')}
              </Text>
              <Chips
                accessibilityLabel={t('onboarding.dietTitle')}
                value={draft.diet}
                onChange={(v) => set('diet', v)}
                options={DIETS.map((d) => ({ value: d, label: t(`onboarding.diets.${d}`) }))}
              />
              <Text variant="label">{t('onboarding.allergies')}</Text>
              <View className="flex-row flex-wrap gap-2">
                {ALLERGIES.map((a) => {
                  const on = draft.allergies.includes(a);
                  return (
                    <OptionCard
                      key={a}
                      multi
                      title={t(`allergens.${a}`)}
                      selected={on}
                      onPress={() =>
                        set(
                          'allergies',
                          on ? draft.allergies.filter((x) => x !== a) : [...draft.allergies, a],
                        )
                      }
                    />
                  );
                })}
              </View>
            </>
          )}

          {step === 'plan' && plan && (
            <>
              <Text variant="title" accessibilityRole="header">
                {plan.ok ? t('onboarding.planTitle') : t('onboarding.noPlanTitle')}
              </Text>
              <PlanPreview result={plan} />
              {plan.ok ? <Text variant="caption">{t('onboarding.planExplain')}</Text> : null}
              <Text variant="caption">{t('onboarding.disclaimer')}</Text>
            </>
          )}
        </Animated.View>
      </ScrollView>

      <View className="gap-2 border-t border-border bg-surface px-5 pb-2 pt-3">
        {plan && step !== 'plan' && index >= 2 && <PlanPreview result={plan} compact />}
        {step === 'plan' && plan && !plan.ok ? (
          <Button label={t('onboarding.continueWithout')} onPress={() => finish(true)} />
        ) : (
          <Button
            label={
              step === 'plan'
                ? t('onboarding.start')
                : step === 'welcome'
                  ? t('onboarding.letsGo')
                  : t('onboarding.next')
            }
            disabled={!canContinue[step]}
            onPress={next}
          />
        )}
        {index > 0 && (
          <Button
            variant="ghost"
            label={t('onboarding.back')}
            onPress={() => setIndex((i) => i - 1)}
          />
        )}
        {editing && index === 0 && (
          <Button variant="ghost" label={t('common.cancel')} onPress={() => router.back()} />
        )}
      </View>
    </SafeAreaView>
  );
}
