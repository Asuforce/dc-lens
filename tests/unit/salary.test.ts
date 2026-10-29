import { describe, expect, it } from "vitest";
import {
  estimateMonthlySalary,
  projectSalary,
  validateSalaryProfile,
} from "../../src/engine/salary.ts";
import type { SalaryProfile, UserProfile } from "../../src/engine/types.ts";

const profile: UserProfile = {
  age: 30,
  retirementAge: 34,
  pensionStartAge: 65,
  pensionEndAge: 90,
  prefecture: "",
  insurer: "custom",
};
const salary: SalaryProfile = {
  annualIncomeYen: 1440,
  monthlySalaryYen: 100,
  annualBonusYen: 240,
  annualRaiseRate: 0,
  events: [],
  bonusMode: "fixed-ratio",
  monthlySalaryIsEstimated: false,
};

describe("給与予測", () => {
  it("昇給ゼロでは金額が変わらない", () => {
    expect(projectSalary(profile, salary).map((year) => year.annualGrossYen)).toEqual([
      1440, 1440, 1440, 1440,
    ]);
  });
  it("固定比率では前年度の丸め済み金額から計算する", () => {
    const years = projectSalary(profile, { ...salary, annualRaiseRate: 0.1 });
    expect(years.map((year) => year.monthlySalaryYen)).toEqual([100, 110, 121, 133]);
    expect(years[1]?.annualBonusYen).toBe(264);
    for (const year of years)
      expect(year.annualGrossYen).toBe(12 * year.monthlySalaryYen + year.annualBonusYen);
  });
  it("月給固定では賞与だけ変わり、負の賞与をゼロにする", () => {
    const years = projectSalary(profile, {
      ...salary,
      bonusMode: "fixed-monthly-bonus-grows",
      annualRaiseRate: -0.5,
    });
    expect(years.map((year) => year.monthlySalaryYen)).toEqual([100, 100, 100, 100]);
    expect(years[1]?.annualBonusYen).toBe(0);
    expect(years[1]?.annualGrossYen).toBe(1200);
  });
  it("イベントは指定年齢だけ昇給率を上書きする", () => {
    expect(
      projectSalary(profile, {
        ...salary,
        annualRaiseRate: 0.1,
        events: [{ age: 31, raiseRate: -0.1 }],
      }).map((year) => year.raiseRateApplied),
    ).toEqual([0, -0.1, 0.1, 0.1]);
  });
  it("退職年齢が現在年齢以下なら空", () => {
    expect(projectSalary({ ...profile, retirementAge: 30 }, salary)).toEqual([]);
  });
  it("月給を推定する", () => expect(estimateMonthlySalary(1441, 240)).toBe(100));
});

describe("給与入力の検証", () => {
  it("正常な入力を受け入れる", () => expect(validateSalaryProfile(salary)).toEqual([]));
  it.each(["annualIncomeYen", "monthlySalaryYen", "annualBonusYen"] as const)(
    "不正な金額 %s を拒否する",
    (field) => {
      for (const value of [-1, 1.5, Number.NaN])
        expect(validateSalaryProfile({ ...salary, [field]: value }).length).toBeGreaterThan(0);
    },
  );
  it("年収の不整合を拒否する", () =>
    expect(validateSalaryProfile({ ...salary, annualIncomeYen: 1441 })).not.toEqual([]));
  it("不正な昇給率を拒否する", () => {
    for (const rate of [-1, Number.POSITIVE_INFINITY, Number.NaN]) {
      expect(validateSalaryProfile({ ...salary, annualRaiseRate: rate })).not.toEqual([]);
      expect(
        validateSalaryProfile({ ...salary, events: [{ age: 31, raiseRate: rate }] }),
      ).not.toEqual([]);
    }
  });
  it("イベント年齢の重複を拒否する", () =>
    expect(
      validateSalaryProfile({
        ...salary,
        events: [
          { age: 31, raiseRate: 0 },
          { age: 31, raiseRate: 0 },
        ],
      }),
    ).not.toEqual([]));
});
