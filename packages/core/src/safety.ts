import { bmi, weightAtBmi } from './energy';
import type { Profile, Sex } from './types';

/** Absolute calorie floors commonly used without medical supervision. */
export const MIN_KCAL: Record<Sex, number> = { female: 1200, male: 1500 };

/** Minimum healthy BMI; targets below are not supported. */
export const MIN_HEALTHY_BMI = 18.5;

export type BlockReason =
  'minor' | 'invalid_input' | 'underweight' | 'target_underweight' | 'target_direction';

/**
 * When `ok` is false no plan may be calculated; the UI shows a supportive message instead.
 * `minHealthyWeightKg` (BMI 18.5 for this height) is included for those messages.
 */
export type SafetyCheck =
  | { ok: true; minHealthyWeightKg: number }
  | { ok: false; block: BlockReason; minHealthyWeightKg: number };

const inRange = (v: number, min: number, max: number) => Number.isFinite(v) && v >= min && v <= max;

/**
 * Decide whether we may compute a plan. Minors, underweight users who want to lose,
 * and targets below a healthy BMI get a warning instead of a number.
 */
export function checkProfileSafety(p: Profile): SafetyCheck {
  const minHealthyWeightKg = Math.ceil(weightAtBmi(MIN_HEALTHY_BMI, p.heightCm) * 10) / 10;
  const fail = (block: BlockReason): SafetyCheck => ({ ok: false, block, minHealthyWeightKg });

  if (
    !inRange(p.age, 1, 120) ||
    !inRange(p.heightCm, 100, 250) ||
    !inRange(p.weightKg, 30, 350) ||
    !inRange(p.trainingDaysPerWeek, 0, 7) ||
    (p.bodyFatPct !== undefined && !inRange(p.bodyFatPct, 3, 70)) ||
    (p.targetWeightKg !== undefined && !inRange(p.targetWeightKg, 30, 350))
  ) {
    return fail('invalid_input');
  }
  if (p.age < 18) return fail('minor');

  if (p.goal === 'lose') {
    if (bmi(p.weightKg, p.heightCm) < MIN_HEALTHY_BMI) return fail('underweight');
    if (p.targetWeightKg !== undefined) {
      if (p.targetWeightKg >= p.weightKg) return fail('target_direction');
      if (bmi(p.targetWeightKg, p.heightCm) < MIN_HEALTHY_BMI) return fail('target_underweight');
    }
  }
  if (p.goal === 'gain' && p.targetWeightKg !== undefined && p.targetWeightKg <= p.weightKg) {
    return fail('target_direction');
  }
  return { ok: true, minHealthyWeightKg };
}
