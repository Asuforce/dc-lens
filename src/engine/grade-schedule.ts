import type { GradeTable } from "../regulations/schema.ts";
import { findGrade } from "./social-insurance.ts";

const averageOf = (values: number[]): number =>
  Math.floor(values.reduce((sum, value) => sum + value, 0) / values.length);

export function scheduleStandardRemuneration(args: {
  table: GradeTable;
  initialRemunerationYen: number;
  monthlyRemunerationYen: number[];
  fixedWageChangeMonthIndexes: number[];
}): number[] {
  const { table, monthlyRemunerationYen: months } = args;
  let current = findGrade(table, args.initialRemunerationYen);
  const changes = new Set(args.fixedWageChangeMonthIndexes);
  const result: number[] = [];
  let pending: typeof current | undefined;
  let skipSeptember = false;
  for (let i = 0; i < months.length; i++) {
    const month = (i % 12) + 1;
    if (month === 1) skipSeptember = false;
    if (pending) {
      current = pending;
      pending = undefined;
      if (month >= 7 && month <= 9) skipSeptember = true;
    }
    if (month === 9 && !skipSeptember) {
      const april = i - 5;
      const average = averageOf(months.slice(april, april + 3));
      current = findGrade(table, average);
    }
    result.push(current.standardMonthlyYen);
    const start = i - 2;
    if (changes.has(start) && start >= 0) {
      const average = averageOf(months.slice(start, i + 1));
      const candidate = findGrade(table, average);
      if (Math.abs(candidate.grade - current.grade) >= 2) pending = candidate;
    }
  }
  return result;
}
