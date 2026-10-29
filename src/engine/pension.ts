import type { PensionBenefitPayload } from "../regulations/schema.ts";
import type { Yen } from "./types.ts";

export function annualAccrualYen(
  payload: PensionBenefitPayload,
  standardMonthlyYen: Yen,
  standardBonusYen: Yen,
): Yen {
  const total = 12 * standardMonthlyYen + standardBonusYen;
  const multiplierThousandths = Math.round(payload.multiplierPerMille * 1000);
  return Math.round((total * multiplierThousandths) / 1_000_000);
}

export function annualBenefitYen(accruals: readonly Yen[]): Yen {
  return accruals.reduce((sum, a) => sum + a, 0);
}

export function benefitYears(startAge: number, endAge: number): number {
  return Math.max(0, endAge - startAge);
}

export function lifetimeBenefitYen(
  accruals: readonly Yen[],
  startAge: number,
  endAge: number,
): Yen {
  return annualBenefitYen(accruals) * benefitYears(startAge, endAge);
}
