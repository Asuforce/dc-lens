import { describe, expect, it } from "vitest";
import { afterTaxPayout } from "../../src/engine/payout-tax.ts";
import { SimulationInputError, simulate } from "../../src/engine/simulate.ts";
import { annualSocialInsurance } from "../../src/engine/social-insurance.ts";
import type { SimulationInput } from "../../src/engine/types.ts";
import { ALL_DATASETS } from "../../src/regulations/all-datasets.ts";
import { type RegulationSet, resolveRegulationSet } from "../../src/regulations/loader.ts";

const resolved = resolveRegulationSet(ALL_DATASETS, "2026-10-29", "precise");
if (!resolved.ok) throw new Error(resolved.errors.join("; "));
const set: RegulationSet = resolved.set;

function baseInput(overrides: Partial<SimulationInput["plan"]> = {}): SimulationInput {
  return {
    profile: {
      age: 35,
      retirementAge: 60,
      pensionStartAge: 65,
      pensionEndAge: 90,
      prefecture: "tokyo",
      insurer: "kyokai-kenpo",
    },
    salary: {
      annualIncomeYen: 4_200_000,
      monthlySalaryYen: 300_000,
      annualBonusYen: 600_000,
      annualRaiseRate: 0.01,
      events: [],
      bonusMode: "fixed-ratio",
      monthlySalaryIsEstimated: false,
    },
    plan: {
      dcMonthlyContributionYen: 20_000,
      idecoMonthlyContributionYen: 20_000,
      dcAnnualCostRate: 0.003,
      idecoAnnualCostRate: 0.003,
      idecoFixedMonthlyFeeYen: 0,
      ...overrides,
    },
    assumptions: {
      grossAnnualReturn: 0.03,
      inflationRate: 0.01,
      discountRate: 0.02,
      mode: "simple",
      valuation: "nominal",
    },
    regulationVersion: "2026",
  };
}

describe("annualSocialInsurance against bundled 2026 data (hand-derived)", () => {
  it("matches standard remuneration x published rates for a mid-grade salary in Tokyo, age 35", () => {
    const r = annualSocialInsurance(set, {
      prefecture: "tokyo",
      age: 35,
      monthlyRemunerationYen: 300_000,
      bonusPaymentsYen: [300_000, 300_000],
    });
    const pension = 12 * ((300_000 * 18.3) / 200) + 2 * ((300_000 * 18.3) / 200);
    const health = 12 * ((300_000 * (9.85 + 0.23)) / 200) + 2 * ((300_000 * (9.85 + 0.23)) / 200);
    expect(r.pensionEmployeeYen).toBe(Math.round(pension));
    expect(r.healthEmployeeYen).toBe(Math.round(health));
    expect(r.careApplied).toBe(false);
  });

  it("adds the long-term care rate at age 40", () => {
    const at = (age: number) =>
      annualSocialInsurance(set, {
        prefecture: "tokyo",
        age,
        monthlyRemunerationYen: 300_000,
        bonusPaymentsYen: [],
      }).healthEmployeeYen;
    expect(at(40)).toBe(Math.round(12 * ((300_000 * (9.85 + 0.23 + 1.62)) / 200)));
    expect(at(39)).toBeLessThan(at(40));
  });
});

describe("simulate", () => {
  it("calculates payout from the last working balances without changing the simulation", () => {
    const input = baseInput({ dcAnnualCostRate: 0.02 });
    const result = simulate(input, set);
    const before = structuredClone(result);
    const row = result.yearlyResults.findLast((year) => year.age < input.profile.retirementAge);
    expect(row).toBeDefined();
    if (!row) throw new Error("missing working year");
    const payout = afterTaxPayout(result, input, 3, set);
    expect(payout.dc.afterTaxYen + payout.dc.totalTaxYen).toBe(row.dc.investmentBalanceYen);
    expect(payout.ideco.afterTaxYen + payout.ideco.totalTaxYen).toBe(
      row.ideco.investmentBalanceYen,
    );
    expect(payout.serviceYears).toBe(input.profile.retirementAge - input.profile.age + 3);
    expect(result).toEqual(before);
    expect(simulate(input, set)).toEqual(before);
    expect(() => afterTaxPayout(result, input, -1, set)).toThrow();
    expect(() => afterTaxPayout(result, input, 1.5, set)).toThrow();
  });
  it("uses entered rates and validates their range", () => {
    const input = baseInput();
    const original = simulate(input, set);
    input.profile.insurer = "kenpo-kumiai";
    input.profile.customHealthRates = {
      healthTotalRatePercent: set.health.healthTotalRatePercentByPrefecture.tokyo ?? 0,
      careTotalRatePercent: set.health.careTotalRatePercent,
      childSupportTotalRatePercent: set.health.childSupportTotalRatePercent,
    };
    const result = simulate(input, set);
    expect(result.summary).toEqual(original.summary);
    expect(result.warnings).toContain(
      "健康保険料率は利用者入力の値です。等級表と賞与上限は法定の共通表を使っています。",
    );
    input.profile.customHealthRates.healthTotalRatePercent = 21;
    expect(() => simulate(input, set)).toThrow(SimulationInputError);
  });
  it("rejects invalid input instead of returning a precise-looking result", () => {
    const bad = baseInput();
    bad.salary.annualIncomeYen = 1;
    expect(() => simulate(bad, set)).toThrow(SimulationInputError);
  });

  it("rejects an unsupported insurer", () => {
    const bad = baseInput();
    bad.profile.insurer = "kenpo-kumiai";
    expect(() => simulate(bad, set)).toThrow(SimulationInputError);
  });

  it("returns zero differences and no break-even when both contributions are zero", () => {
    const r = simulate(
      baseInput({ dcMonthlyContributionYen: 0, idecoMonthlyContributionYen: 0 }),
      set,
    );
    expect(r.summary.currentAnnualDifferenceYen).toBe(0);
    expect(r.summary.retirementAssetDifferenceYen).toBe(0);
    expect(r.summary.annualPensionDifferenceAtRetirementYen).toBe(0);
    expect(r.summary.breakEvenAge).toBeNull();
    expect(r.summary.lifetimeNominalDifferenceYen).toBe(0);
  });

  it("loses a little to the smaller salary income deduction when the contribution changes no grade", () => {
    const r = simulate(
      baseInput({ dcMonthlyContributionYen: 1_000, idecoMonthlyContributionYen: 1_000 }),
      set,
    );
    const diff = r.yearlyResults[0]?.annualCashFlowDifferenceYen ?? Number.NaN;
    const extraTaxableIncome = 0.2 * 12_000;
    expect(diff).toBeLessThan(0);
    expect(Math.abs(diff)).toBeLessThanOrEqual(extraTaxableIncome * 0.25);
  });

  it("shows a positive cash flow advantage and a negative pension effect for the DC scenario", () => {
    const r = simulate(baseInput(), set);
    expect(r.summary.currentAnnualDifferenceYen).toBeGreaterThan(0);
    expect(r.summary.annualPensionDifferenceAtRetirementYen).toBeLessThan(0);
    expect(r.yearlyResults[0]?.age).toBe(35);
    expect(r.yearlyResults.at(-1)?.age).toBe(89);
  });

  it("gives identical balances when contributions and costs are identical", () => {
    const r = simulate(baseInput(), set);
    expect(r.summary.retirementAssetDifferenceYen).toBe(0);
  });

  it("favors the lower-cost product when only the trust fee differs", () => {
    const r = simulate(baseInput({ dcAnnualCostRate: 0.02 }), set);
    expect(r.summary.retirementAssetDifferenceYen).toBeLessThan(0);
  });

  it("does not add the balance difference every year to the cumulative total", () => {
    const r = simulate(baseInput({ dcAnnualCostRate: 0.02 }), set);
    const lastWorking = r.yearlyResults.findLast((y) => y.age < 60);
    const cashFlowSum = r.yearlyResults.reduce((s, y) => s + y.annualCashFlowDifferenceYen, 0);
    const pensionSum = r.yearlyResults.reduce((s, y) => s + y.annualPensionBenefitDifferenceYen, 0);
    expect(r.summary.lifetimeNominalDifferenceYen).toBe(
      cashFlowSum + pensionSum + (lastWorking?.investmentBalanceDifferenceYen ?? 0),
    );
  });

  it("keeps present value and nominal series separate and discounts later cash flows", () => {
    const r = simulate(baseInput(), set);
    expect(r.summary.lifetimePresentValueDifferenceYen).not.toBe(
      r.summary.lifetimeNominalDifferenceYen,
    );
  });

  it("carries the regulation version, assumptions, and warnings", () => {
    const r = simulate(baseInput(), set);
    expect(r.regulationVersion).toContain("income-tax");
    expect(r.assumptions.length).toBeGreaterThan(0);
    expect(r.warnings.some((w) => w.includes("加入資格"))).toBe(true);
  });
});

it("warns only above each contribution cap", () => {
  for (const [field, cap, name] of [
    ["dcMonthlyContributionYen", 55000, "選択制DC"],
    ["idecoMonthlyContributionYen", 23000, "iDeCo"],
  ] as const) {
    expect(
      simulate(baseInput({ [field]: cap }), set).warnings.some((w) =>
        w.includes(`${name}の月額掛金`),
      ),
    ).toBe(false);
    expect(
      simulate(baseInput({ [field]: cap + 1 }), set).warnings.some((w) =>
        w.includes(`${name}の月額掛金`),
      ),
    ).toBe(true);
  }
});
