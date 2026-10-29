import type { Yen } from "./types.ts";

export function discountFactor(discountRate: number, yearsFromBase: number): number {
  return 1 / (1 + discountRate) ** yearsFromBase;
}

export function presentValueYen(nominalYen: Yen, discountRate: number, yearsFromBase: number): Yen {
  return Math.round(nominalYen * discountFactor(discountRate, yearsFromBase));
}

export function cumulative(values: readonly Yen[]): Yen[] {
  const out: Yen[] = [];
  let sum = 0;
  for (const v of values) {
    sum += v;
    out.push(sum);
  }
  return out;
}

/**
 * First age at which the cumulative difference changes sign relative to the first
 * non-zero value, or lands on zero after being non-zero. Returns null when it never crosses.
 */
export function findBreakEvenAge(
  ages: readonly number[],
  cumulativeYen: readonly Yen[],
): number | null {
  let initialSign = 0;
  for (let i = 0; i < cumulativeYen.length; i += 1) {
    const value = cumulativeYen[i] ?? 0;
    const sign = Math.sign(value);
    if (initialSign === 0) {
      initialSign = sign;
      continue;
    }
    if (sign === 0 || sign !== initialSign) return ages[i] ?? null;
  }
  return null;
}
