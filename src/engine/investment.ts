import type { Yen } from "./types.ts";

export interface InvestmentParams {
  grossAnnualReturn: number;
  annualCostRate: number;
  fixedMonthlyFeeYen: Yen;
}

export interface YearFlow {
  startBalanceYen: Yen;
  endBalanceYen: Yen;
  contributionYen: Yen;
  trustFeeYen: Yen;
  fixedFeeYen: Yen;
}

export function monthlyGrowthRate(grossAnnualReturn: number): number {
  return (1 + grossAnnualReturn) ** (1 / 12) - 1;
}

export function monthlyCostRate(annualCostRate: number): number {
  return 1 - (1 - annualCostRate) ** (1 / 12);
}

export function validateInvestmentParams(p: InvestmentParams): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(p.grossAnnualReturn) || p.grossAnnualReturn <= -1) {
    errors.push("想定利回りは -100% より大きい数値で指定してください。");
  }
  if (!Number.isFinite(p.annualCostRate) || p.annualCostRate < 0 || p.annualCostRate >= 1) {
    errors.push("年率コストは 0 以上 100% 未満で指定してください。");
  }
  if (!Number.isInteger(p.fixedMonthlyFeeYen) || p.fixedMonthlyFeeYen < 0) {
    errors.push("固定費は 0 以上の整数円で指定してください。");
  }
  return errors;
}

/**
 * One month, in this order: contribution at the start of the month, growth at the
 * pre-cost gross rate, trust fee on the grown balance, then the fixed fee.
 * Each step rounds to whole yen so the balance is always an integer.
 */
export function stepMonth(
  balanceYen: Yen,
  contributionYen: Yen,
  params: InvestmentParams,
): { balanceYen: Yen; trustFeeYen: Yen; fixedFeeYen: Yen } {
  const grown = Math.round(
    (balanceYen + contributionYen) * (1 + monthlyGrowthRate(params.grossAnnualReturn)),
  );
  const trustFeeYen = Math.min(grown, Math.round(grown * monthlyCostRate(params.annualCostRate)));
  const afterTrust = grown - trustFeeYen;
  const fixedFeeYen = Math.min(afterTrust, params.fixedMonthlyFeeYen);
  return { balanceYen: afterTrust - fixedFeeYen, trustFeeYen, fixedFeeYen };
}

export function simulateYear(
  startBalanceYen: Yen,
  monthlyContributionYen: Yen,
  params: InvestmentParams,
  months = 12,
): YearFlow {
  let balance = startBalanceYen;
  let trustFeeYen = 0;
  let fixedFeeYen = 0;
  for (let m = 0; m < months; m += 1) {
    const step = stepMonth(balance, monthlyContributionYen, params);
    balance = step.balanceYen;
    trustFeeYen += step.trustFeeYen;
    fixedFeeYen += step.fixedFeeYen;
  }
  return {
    startBalanceYen,
    endBalanceYen: balance,
    contributionYen: monthlyContributionYen * months,
    trustFeeYen,
    fixedFeeYen,
  };
}
