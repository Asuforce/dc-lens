import { simulateYear } from "./investment.ts";

/** Existing assets remain invested independently; cash-flow savings are not reinvested. */
export function projectQuickBalances(balance: number, contribution: number) {
  const points: { year: number; fresh: number; existing: number; total: number }[] = [];
  let fresh = 0;
  let existing = balance;
  const params = { grossAnnualReturn: 0.03, annualCostRate: 0, fixedMonthlyFeeYen: 0 };
  for (let year = 1; year <= 30; year++) {
    fresh = simulateYear(fresh, contribution, params).endBalanceYen;
    existing = simulateYear(existing, 0, params).endBalanceYen;
    const total = fresh + existing;
    if (!Number.isSafeInteger(total))
      throw new Error("積立残高が計算可能な整数円の範囲を超えています。");
    if (year % 10 === 0) points.push({ year, fresh, existing, total });
  }
  return points;
}
