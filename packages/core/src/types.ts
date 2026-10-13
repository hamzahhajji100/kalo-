/** Shared domain types for the nutrition engine. All masses in kg/g, lengths in cm, energy in kcal. */

export type Sex = 'female' | 'male';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export type Goal = 'lose' | 'maintain' | 'gain';

export type Pace = 'slow' | 'medium' | 'fast';

export type TrainingExperience = 'beginner' | 'intermediate' | 'advanced';

export type Diet = 'omnivore' | 'vegetarian' | 'vegan' | 'pescetarian' | 'low_carb' | 'keto';

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  /** Optional body-fat percentage (e.g. 18 for 18 %). Enables Katch-McArdle. */
  bodyFatPct?: number;
  activity: ActivityLevel;
  trainingDaysPerWeek: number;
  goal: Goal;
  targetWeightKg?: number;
  pace: Pace;
  experience?: TrainingExperience;
  diet?: Diet;
}

/** Macro and energy values. Per 100 g for foods, absolute for entries/days. */
export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  saturatedFat?: number;
  salt?: number;
}

export interface WeightPoint {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  kg: number;
}

export interface IntakePoint {
  /** ISO date (YYYY-MM-DD). Only days the user actually logged. */
  date: string;
  kcal: number;
}
