/** Unit conversions. Internally everything is metric; imperial is display-only. */

export const LB_PER_KG = 2.20462262;
export const CM_PER_INCH = 2.54;
export const ML_PER_FL_OZ = 29.5735296;

export const kgToLb = (kg: number) => kg * LB_PER_KG;
export const lbToKg = (lb: number) => lb / LB_PER_KG;
export const mlToFlOz = (ml: number) => ml / ML_PER_FL_OZ;
export const flOzToMl = (oz: number) => oz * ML_PER_FL_OZ;
export const gToOz = (g: number) => g / 28.3495231;

export function cmToFtIn(cm: number): { ft: number; inch: number } {
  const totalIn = Math.round(cm / CM_PER_INCH);
  return { ft: Math.floor(totalIn / 12), inch: totalIn % 12 };
}

export const ftInToCm = (ft: number, inch: number) => (ft * 12 + inch) * CM_PER_INCH;

/** kJ ↔ kcal, used when a label or API only reports kilojoules. */
export const kjToKcal = (kj: number) => kj / 4.184;
/** Sodium (g) to salt (g), as used on EU labels. */
export const sodiumToSalt = (sodiumG: number) => sodiumG * 2.5;
