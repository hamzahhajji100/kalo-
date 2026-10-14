import { kgToLb, lbToKg } from '@kalo/core';

import { formatDecimal } from './format';
import { usePreferences } from './preferences';

/**
 * Body-weight units. Data is always stored in kg; imperial only changes display and input.
 * Food amounts stay in g/ml because EU labels are per 100 g/ml.
 */
export function useWeightUnit() {
  const imperial = usePreferences((s) => s.units) === 'imperial';
  return {
    unit: imperial ? 'lb' : 'kg',
    /** Display value for a kg weight. */
    toDisplay: (kg: number) => (imperial ? kgToLb(kg) : kg),
    /** Convert user input to kg. */
    toKg: (v: number) => (imperial ? lbToKg(v) : v),
    format: (kg: number, digits = 1) =>
      `${formatDecimal(imperial ? kgToLb(kg) : kg, digits)} ${imperial ? 'lb' : 'kg'}`,
  };
}
