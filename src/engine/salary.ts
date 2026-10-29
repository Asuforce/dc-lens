import type { SalaryProfile, UserProfile } from "./types.ts";

export interface SalaryYear {
  age: number;
  monthlySalaryYen: number;
  annualBonusYen: number;
  annualGrossYen: number;
  raiseRateApplied: number;
}

export function validateSalaryProfile(salary: SalaryProfile): string[] {
  const errors: string[] = [];
  for (const [label, value] of [
    ["年収", salary.annualIncomeYen],
    ["月給", salary.monthlySalaryYen],
    ["賞与", salary.annualBonusYen],
  ] as const) {
    if (!Number.isInteger(value) || value < 0)
      errors.push(`${label}は0以上の整数で入力してください。`);
  }
  if (salary.annualIncomeYen !== 12 * salary.monthlySalaryYen + salary.annualBonusYen)
    errors.push("年収は月給の12か月分と賞与の合計にしてください。");
  if (!Number.isFinite(salary.annualRaiseRate) || salary.annualRaiseRate <= -1)
    errors.push("昇給率は-1より大きい有限の数値にしてください。");
  const ages = new Set<number>();
  for (const event of salary.events) {
    if (!Number.isFinite(event.raiseRate) || event.raiseRate <= -1)
      errors.push("昇給イベントの昇給率は-1より大きい有限の数値にしてください。");
    if (ages.has(event.age)) errors.push("昇給イベントの年齢が重複しています。");
    ages.add(event.age);
  }
  return errors;
}

export function estimateMonthlySalary(annualIncomeYen: number, annualBonusYen: number): number {
  return Math.round((annualIncomeYen - annualBonusYen) / 12);
}

export function projectSalary(profile: UserProfile, salary: SalaryProfile): SalaryYear[] {
  const years: SalaryYear[] = [];
  for (let age = profile.age; age < profile.retirementAge; age++) {
    const previous = years.at(-1);
    if (!previous) {
      years.push({
        age,
        monthlySalaryYen: salary.monthlySalaryYen,
        annualBonusYen: salary.annualBonusYen,
        annualGrossYen: salary.annualIncomeYen,
        raiseRateApplied: 0,
      });
      continue;
    }
    const rate =
      salary.events.find((event) => event.age === age)?.raiseRate ?? salary.annualRaiseRate;
    const monthly =
      salary.bonusMode === "fixed-ratio"
        ? Math.round(previous.monthlySalaryYen * (1 + rate))
        : previous.monthlySalaryYen;
    const gross = Math.max(Math.round(previous.annualGrossYen * (1 + rate)), 12 * monthly);
    years.push({
      age,
      monthlySalaryYen: monthly,
      annualBonusYen: gross - 12 * monthly,
      annualGrossYen: gross,
      raiseRateApplied: rate,
    });
  }
  return years;
}
