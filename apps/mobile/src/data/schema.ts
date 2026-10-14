/**
 * User database (kalo-user.db). All personal data lives here, on the device.
 * The read-only food catalogue is a separate database (see catalog.ts) so catalogue updates
 * can never touch user data. Diary entries therefore store a nutrient snapshot instead of
 * relying on a join: an entry stays correct even if the source food changes or disappears.
 */
import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

/** Absolute nutrient columns, shared by entries and snapshots. */
const nutrientColumns = () => ({
  kcal: real('kcal').notNull(),
  protein: real('protein').notNull(),
  carbs: real('carbs').notNull(),
  fat: real('fat').notNull(),
  fiber: real('fiber'),
  sugar: real('sugar'),
  saturatedFat: real('saturated_fat'),
  salt: real('salt'),
});

/** Foods the user created, scanned, or got from AI/online search (per 100 g). */
export const foods = sqliteTable(
  'foods',
  {
    id: text('id').primaryKey(),
    source: text('source', { enum: ['off', 'usda', 'custom', 'ai', 'recipe'] }).notNull(),
    sourceId: text('source_id').notNull(),
    barcode: text('barcode'),
    name: text('name').notNull(),
    nameAlt: text('name_alt'),
    brand: text('brand'),
    imageUrl: text('image_url'),
    isLiquid: integer('is_liquid', { mode: 'boolean' }).notNull().default(false),
    ...nutrientColumns(),
    microsJson: text('micros_json'),
    portionsJson: text('portions_json').notNull().default('[]'),
    nutriScore: text('nutri_score'),
    ingredients: text('ingredients'),
    allergensJson: text('allergens_json').notNull().default('[]'),
    verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [index('foods_barcode_idx').on(t.barcode), index('foods_name_idx').on(t.name)],
);

export const mealTypes = sqliteTable('meal_types', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** Built-in key (breakfast, lunch, dinner, snacks) for translated names; null for custom ones. */
  key: text('key'),
  name: text('name'),
  sort: integer('sort').notNull(),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
});

export const diaryEntries = sqliteTable(
  'diary_entries',
  {
    id: text('id').primaryKey(),
    /** Local calendar day, YYYY-MM-DD. */
    date: text('date').notNull(),
    mealTypeId: integer('meal_type_id')
      .notNull()
      .references(() => mealTypes.id),
    foodId: text('food_id'),
    recipeId: text('recipe_id'),
    name: text('name').notNull(),
    brand: text('brand'),
    grams: real('grams'),
    /** Human-readable amount, e.g. "2 Scheiben" (optional). */
    amountLabel: text('amount_label'),
    ...nutrientColumns(),
    source: text('source', {
      enum: ['photo', 'barcode', 'search', 'quick', 'recipe', 'template', 'copy'],
    }).notNull(),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [index('diary_date_idx').on(t.date), index('diary_food_idx').on(t.foodId)],
);

export const recipes = sqliteTable('recipes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  servings: real('servings').notNull().default(1),
  /** Total cooked weight in g; if unknown, the sum of raw ingredient weights is used. */
  totalGrams: real('total_grams'),
  createdAt: text('created_at').notNull().default(now),
  updatedAt: text('updated_at').notNull().default(now),
});

export const recipeItems = sqliteTable('recipe_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  recipeId: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  foodId: text('food_id').notNull(),
  name: text('name').notNull(),
  grams: real('grams').notNull(),
  /** Per-100 g snapshot of the ingredient. */
  ...nutrientColumns(),
  sort: integer('sort').notNull().default(0),
});

export const mealTemplates = sqliteTable('meal_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull().default(now),
});

export const mealTemplateItems = sqliteTable('meal_template_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  templateId: text('template_id')
    .notNull()
    .references(() => mealTemplates.id, { onDelete: 'cascade' }),
  foodId: text('food_id'),
  name: text('name').notNull(),
  brand: text('brand'),
  grams: real('grams'),
  amountLabel: text('amount_label'),
  /** Absolute values for this item. */
  ...nutrientColumns(),
});

export const favorites = sqliteTable('favorites', {
  foodId: text('food_id').primaryKey(),
  /** Food JSON snapshot so favourites render without the catalogue. */
  foodJson: text('food_json').notNull(),
  createdAt: text('created_at').notNull().default(now),
});

/** Single-row table (id = 1). */
export const profile = sqliteTable('profile', {
  id: integer('id').primaryKey(),
  sex: text('sex', { enum: ['female', 'male'] }).notNull(),
  birthDate: text('birth_date').notNull(),
  heightCm: real('height_cm').notNull(),
  bodyFatPct: real('body_fat_pct'),
  activity: text('activity', {
    enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
  }).notNull(),
  trainingDaysPerWeek: integer('training_days_per_week').notNull(),
  experience: text('experience', { enum: ['beginner', 'intermediate', 'advanced'] }),
  goal: text('goal', { enum: ['lose', 'maintain', 'gain'] }).notNull(),
  targetWeightKg: real('target_weight_kg'),
  pace: text('pace', { enum: ['slow', 'medium', 'fast'] }).notNull(),
  diet: text('diet', {
    enum: ['omnivore', 'vegetarian', 'vegan', 'pescetarian', 'low_carb', 'keto'],
  }).notNull(),
  allergiesJson: text('allergies_json').notNull().default('[]'),
  updatedAt: text('updated_at').notNull().default(now),
});

/** Every target change, with the reason shown to the user. The latest row valid on a date applies. */
export const goalsHistory = sqliteTable(
  'goals_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    validFrom: text('valid_from').notNull(),
    kcal: real('kcal').notNull(),
    protein: real('protein').notNull(),
    carbs: real('carbs').notNull(),
    fat: real('fat').notNull(),
    waterMl: real('water_ml').notNull(),
    steps: integer('steps'),
    /** Current TDEE estimate behind this target (prior for the next check-in). */
    tdee: real('tdee').notNull(),
    reason: text('reason', {
      enum: [
        'onboarding',
        'profile_changed',
        'manual',
        'on_track',
        'slower_than_planned',
        'faster_than_planned',
        'expenditure_updated',
        'insufficient_data',
      ],
    }).notNull(),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [index('goals_valid_from_idx').on(t.validFrom)],
);

export const weights = sqliteTable('weights', {
  date: text('date').primaryKey(),
  kg: real('kg').notNull(),
});

export const bodyMeasurements = sqliteTable('body_measurements', {
  date: text('date').primaryKey(),
  waistCm: real('waist_cm'),
  hipCm: real('hip_cm'),
  chestCm: real('chest_cm'),
  armCm: real('arm_cm'),
  thighCm: real('thigh_cm'),
});

export const progressPhotos = sqliteTable('progress_photos', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  /** Local file URI in the app's document directory. Never uploaded. */
  uri: text('uri').notNull(),
});

export const waterLogs = sqliteTable(
  'water_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    date: text('date').notNull(),
    ml: real('ml').notNull(),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [index('water_date_idx').on(t.date)],
);

export const checkIns = sqliteTable(
  'check_ins',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    date: text('date').notNull(),
    resultJson: text('result_json').notNull(),
    accepted: integer('accepted', { mode: 'boolean' }).notNull(),
  },
  (t) => [uniqueIndex('check_ins_date_idx').on(t.date)],
);
