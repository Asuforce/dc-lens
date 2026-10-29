import { describe, expect, it } from "vitest";
import {
  annualSocialInsurance,
  findGrade,
  halfPremiumYen,
  standardBonusYen,
} from "../../src/engine/social-insurance.ts";

const grades = [
  { grade: 1, standardMonthlyYen: 100000, lowerBoundYen: 10000, upperBoundYen: 150000 },
  { grade: 2, standardMonthlyYen: 200000, lowerBoundYen: 150000, upperBoundYen: 250000 },
  { grade: 3, standardMonthlyYen: 300000, lowerBoundYen: 250000, upperBoundYen: null },
];
const set = {
  pension: { grades, totalRatePercent: 20, bonusCapPerMonthYen: 200000 },
  health: {
    grades,
    annualBonusCapYen: 300000,
    careTotalRatePercent: 2,
    childSupportTotalRatePercent: 1,
    healthTotalRatePercentByPrefecture: { test: 9 },
  },
};
const input = {
  prefecture: "test",
  age: 39,
  monthlyRemunerationYen: 200000,
  bonusPaymentsYen: [250999, 150999],
};

describe("social insurance", () => {
  it("selects grades at boundaries and rejects invalid remuneration", () => {
    for (const [value, grade] of [
      [0, 1],
      [10000, 1],
      [149999, 1],
      [150000, 2],
      [250000, 3],
      [999999, 3],
    ] as const)
      expect(findGrade({ grades }, value).grade).toBe(grade);
    for (const value of [-1, 1.5, NaN])
      expect(() => findGrade({ grades }, value)).toThrow(RangeError);
  });
  it("rounds half down with three decimal rates and floors bonuses", () => {
    expect(halfPremiumYen(10, 10)).toBe(0);
    expect(halfPremiumYen(102, 1)).toBe(1);
    expect(halfPremiumYen(100000, 1.234)).toBe(617);
    expect(halfPremiumYen(100000, 0)).toBe(0);
    expect(standardBonusYen(12345)).toBe(12000);
  });
  it("caps pension per payment and health cumulatively", () => {
    const result = annualSocialInsurance(set, input);
    expect(result.pensionStandardBonusYen).toBe(350000);
    expect(result.healthStandardBonusYen).toBe(300000);
    expect(result.pensionEmployeeYen).toBe(275000);
    expect(result.healthEmployeeYen).toBe(135000);
    expect(result.totalEmployeeYen).toBe(410000);
    expect(result.warnings).toHaveLength(2);
  });
  it("uses age alone as a simplified care eligibility rule", () => {
    for (const [age, applied] of [
      [39, false],
      [40, true],
      [64, true],
      [65, false],
    ] as const)
      expect(annualSocialInsurance(set, { ...input, age }).careApplied).toBe(applied);
  });
  it("handles zero bonus, highest grade and unknown prefectures", () => {
    const result = annualSocialInsurance(set, {
      ...input,
      monthlyRemunerationYen: 300000,
      bonusPaymentsYen: [],
    });
    expect(result.pensionStandardBonusYen).toBe(0);
    expect(result.healthStandardBonusYen).toBe(0);
    expect(result.warnings).toHaveLength(2);
    expect(() => annualSocialInsurance(set, { ...input, prefecture: "unknown" })).toThrow(
      /prefecture/,
    );
  });
  it("reduces premiums when remuneration drops a grade and preserves equal cases", () => {
    const base = annualSocialInsurance(set, input);
    expect(
      annualSocialInsurance(set, { ...input, monthlyRemunerationYen: 100000 }).totalEmployeeYen,
    ).toBeLessThan(base.totalEmployeeYen);
    expect(annualSocialInsurance(set, { ...input }).totalEmployeeYen).toBe(base.totalEmployeeYen);
  });
});
