import { beforeEach, describe, expect, it } from 'vitest';

import type { Db } from '@/data/db';
import {
  addEntry,
  copyEntries,
  dailyTotals,
  dayTotals,
  deleteEntry,
  getEntry,
  listEntries,
  moveEntry,
  recentFoods,
  updateEntryAmount,
  updateEntryDetails,
} from '@/data/repositories/diary';
import {
  addMealType,
  ensureDefaultMealTypes,
  listMealTypes,
  mealKeyForTime,
  renameMealType,
  setMealTypeArchived,
} from '@/data/repositories/mealTypes';
import { createTestDb } from './testDb';

let db: Db;
let breakfast: number;
let dinner: number;

const oats = { kcal: 186, protein: 6.75, carbs: 29.35, fat: 3.5, fiber: 5 };

beforeEach(() => {
  db = createTestDb();
  ensureDefaultMealTypes(db);
  ensureDefaultMealTypes(db); // idempotent
  const meals = listMealTypes(db);
  breakfast = meals.find((m) => m.key === 'breakfast')!.id;
  dinner = meals.find((m) => m.key === 'dinner')!.id;
});

describe('meal types', () => {
  it('seeds four defaults once and supports custom meals', () => {
    expect(listMealTypes(db).map((m) => m.key)).toEqual(['breakfast', 'lunch', 'dinner', 'snacks']);
    const id = addMealType(db, 'Pre-Workout');
    renameMealType(db, id, 'Vor dem Training');
    expect(listMealTypes(db).at(-1)).toMatchObject({ name: 'Vor dem Training', sort: 4 });
    setMealTypeArchived(db, id, true);
    expect(listMealTypes(db)).toHaveLength(4);
    expect(listMealTypes(db, { includeArchived: true })).toHaveLength(5);
  });

  it('picks a meal by time of day', () => {
    expect(mealKeyForTime(new Date(2026, 0, 1, 7, 30))).toBe('breakfast');
    expect(mealKeyForTime(new Date(2026, 0, 1, 12, 0))).toBe('lunch');
    expect(mealKeyForTime(new Date(2026, 0, 1, 19, 0))).toBe('dinner');
    expect(mealKeyForTime(new Date(2026, 0, 1, 16, 0))).toBe('snacks');
    expect(mealKeyForTime(new Date(2026, 0, 1, 2, 0))).toBe('snacks');
  });
});

describe('diary', () => {
  it('adds, lists in meal order, and totals a day', () => {
    addEntry(db, {
      date: '2026-10-14',
      mealTypeId: dinner,
      name: 'Döner',
      nutrients: { kcal: 650, protein: 30, carbs: 60, fat: 30 },
      source: 'quick',
    });
    addEntry(db, {
      date: '2026-10-14',
      mealTypeId: breakfast,
      foodId: 'usda:1',
      name: 'Haferflocken',
      grams: 50,
      nutrients: oats,
      source: 'search',
    });
    addEntry(db, {
      date: '2026-10-15',
      mealTypeId: breakfast,
      name: 'Kaffee',
      nutrients: { kcal: 5, protein: 0, carbs: 0, fat: 0 },
      source: 'quick',
    });

    expect(listEntries(db, '2026-10-14').map((e) => e.name)).toEqual(['Haferflocken', 'Döner']);
    expect(dayTotals(db, '2026-10-14')).toEqual({
      kcal: 836,
      protein: 36.75,
      carbs: 89.35,
      fat: 33.5,
      fiber: 5,
    });
    expect(dayTotals(db, '2026-01-01')).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
    expect(
      dailyTotals(db, '2026-10-01', '2026-10-31').map((d) => [d.date, d.entries, d.kcal]),
    ).toEqual([
      ['2026-10-14', 2, 836],
      ['2026-10-15', 1, 5],
    ]);
  });

  it('scales nutrients when the amount changes', () => {
    const id = addEntry(db, {
      date: '2026-10-14',
      mealTypeId: breakfast,
      foodId: 'usda:1',
      name: 'Haferflocken',
      grams: 50,
      nutrients: oats,
      source: 'search',
    });
    updateEntryAmount(db, id, 75, '75 g');
    expect(getEntry(db, id)).toMatchObject({
      grams: 75,
      amountLabel: '75 g',
      kcal: 279,
      fiber: 7.5,
      sugar: null,
    });
    expect(() => updateEntryAmount(db, 'missing', 10)).toThrow(/not found/);
  });

  it('refuses gram scaling for quick entries but allows editing details', () => {
    const id = addEntry(db, {
      date: '2026-10-14',
      mealTypeId: breakfast,
      name: 'Snack',
      nutrients: { kcal: 200, protein: 0, carbs: 0, fat: 0 },
      source: 'quick',
    });
    expect(() => updateEntryAmount(db, id, 10)).toThrow(/no gram amount/);
    updateEntryDetails(db, id, {
      name: 'Müsliriegel',
      nutrients: { kcal: 180, protein: 3, carbs: 25, fat: 7, sugar: 12 },
    });
    expect(getEntry(db, id)).toMatchObject({ name: 'Müsliriegel', kcal: 180, sugar: 12 });
    updateEntryDetails(db, id, {});
    expect(getEntry(db, id)).toMatchObject({ name: 'Müsliriegel' });
  });

  it('moves, deletes and copies entries', () => {
    const id = addEntry(db, {
      date: '2026-10-14',
      mealTypeId: breakfast,
      foodId: 'usda:1',
      name: 'Haferflocken',
      grams: 50,
      nutrients: oats,
      source: 'search',
    });
    addEntry(db, {
      date: '2026-10-14',
      mealTypeId: dinner,
      name: 'Pizza',
      nutrients: { kcal: 800, protein: 30, carbs: 90, fat: 35 },
      source: 'quick',
    });

    expect(
      copyEntries(db, { fromDate: '2026-10-14', toDate: '2026-10-15', mealTypeId: breakfast }),
    ).toBe(1);
    expect(listEntries(db, '2026-10-15')).toMatchObject([
      { name: 'Haferflocken', source: 'copy', grams: 50, fiber: 5 },
    ]);
    expect(
      copyEntries(db, { fromDate: '2026-10-14', toDate: '2026-10-16', toMealTypeId: dinner }),
    ).toBe(2);
    expect(listEntries(db, '2026-10-16').every((e) => e.mealTypeId === dinner)).toBe(true);

    moveEntry(db, id, dinner, '2026-10-13');
    expect(getEntry(db, id)).toMatchObject({ mealTypeId: dinner, date: '2026-10-13' });
    moveEntry(db, id, breakfast);
    expect(getEntry(db, id)).toMatchObject({ mealTypeId: breakfast, date: '2026-10-13' });
    deleteEntry(db, id);
    expect(getEntry(db, id)).toBeUndefined();
  });

  it('lists recent foods with their last amount', async () => {
    addEntry(db, {
      date: '2026-10-13',
      mealTypeId: breakfast,
      foodId: 'usda:1',
      name: 'Haferflocken',
      grams: 50,
      nutrients: oats,
      source: 'search',
    });
    await new Promise((r) => setTimeout(r, 5));
    addEntry(db, {
      date: '2026-10-14',
      mealTypeId: breakfast,
      foodId: 'off:4000',
      name: 'Skyr',
      grams: 150,
      nutrients: { kcal: 95, protein: 16, carbs: 6, fat: 0.3 },
      source: 'barcode',
    });
    await new Promise((r) => setTimeout(r, 5));
    addEntry(db, {
      date: '2026-10-14',
      mealTypeId: breakfast,
      foodId: 'usda:1',
      name: 'Haferflocken',
      grams: 80,
      nutrients: oats,
      source: 'search',
    });
    addEntry(db, {
      date: '2026-10-14',
      mealTypeId: breakfast,
      name: 'ohne Food-ID',
      nutrients: oats,
      source: 'quick',
    });

    const recent = recentFoods(db);
    expect(recent.map((r) => [r.foodId, r.grams, r.timesEaten])).toEqual([
      ['usda:1', 80, 2],
      ['off:4000', 150, 1],
    ]);
  });
});

describe('micronutrients', () => {
  it('stores, scales and copies micros with entries', () => {
    const db2 = createTestDb();
    ensureDefaultMealTypes(db2);
    const meal = listMealTypes(db2)[0]!.id;
    const id = addEntry(db2, {
      date: '2026-10-14',
      mealTypeId: meal,
      name: 'Spinat',
      grams: 100,
      nutrients: { kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
      micros: { ironMg: 2.7, calciumMg: 99 },
      source: 'search',
    });
    updateEntryAmount(db2, id, 200);
    expect(JSON.parse(getEntry(db2, id)!.microsJson!)).toEqual({ ironMg: 5.4, calciumMg: 198 });
    copyEntries(db2, { fromDate: '2026-10-14', toDate: '2026-10-15' });
    expect(JSON.parse(listEntries(db2, '2026-10-15')[0]!.microsJson!)).toEqual({
      ironMg: 5.4,
      calciumMg: 198,
    });
    const noMicros = addEntry(db2, {
      date: '2026-10-14',
      mealTypeId: meal,
      name: 'X',
      nutrients: { kcal: 1, protein: 0, carbs: 0, fat: 0 },
      micros: {},
      source: 'quick',
    });
    expect(getEntry(db2, noMicros)!.microsJson).toBeNull();
  });
});
