import type { RegulationSet } from "../regulations/loader.ts";
import type { Grade, GradeTable } from "../regulations/schema.ts";

export function findGrade(table: GradeTable, remunerationYen: number): Grade {
  if (!Number.isInteger(remunerationYen) || remunerationYen < 0)
    throw new RangeError("Invalid remuneration");
  const first = table.grades[0];
  if (!first) throw new Error("Empty grade table");
  if (remunerationYen < first.lowerBoundYen) return first;
  const grade = table.grades.find(
    (g) =>
      remunerationYen >= g.lowerBoundYen &&
      (g.upperBoundYen === null || remunerationYen < g.upperBoundYen),
  );
  if (!grade) throw new Error("No matching grade");
  return grade;
}

export function halfPremiumYen(standardYen: number, totalRatePercent: number): number {
  const n = standardYen * Math.round(totalRatePercent * 1000);
  const d = 200000;
  const q = Math.floor(n / d);
  return n - q * d > d / 2 ? q + 1 : q;
}

export function standardBonusYen(bonusYen: number): number {
  return Math.floor(bonusYen / 1000) * 1000;
}

export interface SocialInsuranceInput {
  prefecture: string;
  age: number;
  monthlyRemunerationYen: number;
  bonusPaymentsYen: number[];
}
export interface SocialInsuranceResult {
  pensionGrade: number;
  pensionStandardMonthlyYen: number;
  pensionStandardBonusYen: number;
  healthGrade: number;
  healthStandardMonthlyYen: number;
  healthStandardBonusYen: number;
  careApplied: boolean;
  pensionEmployeeYen: number;
  healthEmployeeYen: number;
  totalEmployeeYen: number;
  warnings: string[];
}
export function annualSocialInsurance(
  set: Pick<RegulationSet, "pension" | "health">,
  input: SocialInsuranceInput,
): SocialInsuranceResult {
  const pg = findGrade(set.pension, input.monthlyRemunerationYen);
  const hg = findGrade(set.health, input.monthlyRemunerationYen);
  return annualSocialInsuranceMonthly(set, {
    prefecture: input.prefecture,
    age: input.age,
    pensionStandardMonthlyYen: Array<number>(12).fill(pg.standardMonthlyYen),
    healthStandardMonthlyYen: Array<number>(12).fill(hg.standardMonthlyYen),
    bonusPaymentsYen: input.bonusPaymentsYen,
  });
}

export function annualSocialInsuranceMonthly(
  set: Pick<RegulationSet, "pension" | "health">,
  input: {
    prefecture: string;
    age: number;
    pensionStandardMonthlyYen: number[];
    healthStandardMonthlyYen: number[];
    bonusPaymentsYen: number[];
  },
): SocialInsuranceResult {
  if (input.pensionStandardMonthlyYen.length !== 12 || input.healthStandardMonthlyYen.length !== 12)
    throw new RangeError("Expected 12 monthly standards");
  const { pension, health } = set;
  const rate = Object.hasOwn(health.healthTotalRatePercentByPrefecture, input.prefecture)
    ? health.healthTotalRatePercentByPrefecture[input.prefecture]
    : undefined;
  if (rate === undefined) throw new Error(`Unknown prefecture: ${input.prefecture}`);
  const pensionLastYen = input.pensionStandardMonthlyYen.at(-1);
  const healthLastYen = input.healthStandardMonthlyYen.at(-1);
  if (pensionLastYen === undefined || healthLastYen === undefined)
    throw new RangeError("Expected 12 monthly standards");
  const pg = findGrade(pension, pensionLastYen);
  const hg = findGrade(health, healthLastYen);
  const careApplied = input.age >= 40 && input.age < 65;
  const healthRate =
    rate + health.childSupportTotalRatePercent + (careApplied ? health.careTotalRatePercent : 0);
  let pensionEmployeeYen = input.pensionStandardMonthlyYen.reduce(
    (sum, value) => sum + halfPremiumYen(value, pension.totalRatePercent),
    0,
  );
  let healthEmployeeYen = input.healthStandardMonthlyYen.reduce(
    (sum, value) => sum + halfPremiumYen(value, healthRate),
    0,
  );
  let pensionStandardBonusYen = 0;
  let healthStandardBonusYen = 0;
  const warnings: string[] = [];
  if (pg === pension.grades[pension.grades.length - 1])
    warnings.push("厚生年金の標準報酬月額は最高等級です。");
  if (hg === health.grades[health.grades.length - 1])
    warnings.push("健康保険の標準報酬月額は最高等級です。");
  for (const payment of input.bonusPaymentsYen) {
    const standard = standardBonusYen(payment);
    const p = Math.min(standard, pension.bonusCapPerMonthYen);
    const h = Math.min(standard, Math.max(0, health.annualBonusCapYen - healthStandardBonusYen));
    if (p < standard) warnings.push("厚生年金の標準賞与額を上限で制限しました。");
    if (h < standard) warnings.push("健康保険の標準賞与額を年間上限で制限しました。");
    pensionStandardBonusYen += p;
    healthStandardBonusYen += h;
    pensionEmployeeYen += halfPremiumYen(p, pension.totalRatePercent);
    healthEmployeeYen += halfPremiumYen(h, healthRate);
  }
  return {
    pensionGrade: pg.grade,
    pensionStandardMonthlyYen: pensionLastYen,
    pensionStandardBonusYen,
    healthGrade: hg.grade,
    healthStandardMonthlyYen: healthLastYen,
    healthStandardBonusYen,
    careApplied,
    pensionEmployeeYen,
    healthEmployeeYen,
    totalEmployeeYen: pensionEmployeeYen + healthEmployeeYen,
    warnings,
  };
}
