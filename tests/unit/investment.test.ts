import { describe, expect, it } from "vitest";
import {
  type InvestmentParams,
  monthlyCostRate,
  monthlyGrowthRate,
  simulateYear,
  validateInvestmentParams,
} from "../../src/engine/investment.ts";

const none: InvestmentParams = { grossAnnualReturn: 0, annualCostRate: 0, fixedMonthlyFeeYen: 0 };

describe("monthly rate conversion", () => {
  it("compounds back to the annual rate", () => {
    expect((1 + monthlyGrowthRate(0.05)) ** 12).toBeCloseTo(1.05, 10);
    expect((1 - monthlyCostRate(0.012)) ** 12).toBeCloseTo(1 - 0.012, 10);
  });

  it("is zero for a zero rate", () => {
    expect(monthlyGrowthRate(0)).toBe(0);
    expect(monthlyCostRate(0)).toBe(0);
  });
});

describe("simulateYear", () => {
  it("only accumulates contributions when return and costs are zero", () => {
    const r = simulateYear(0, 10_000, none);
    expect(r.endBalanceYen).toBe(120_000);
    expect(r.contributionYen).toBe(120_000);
    expect(r.trustFeeYen).toBe(0);
    expect(r.fixedFeeYen).toBe(0);
  });

  it("keeps the balance when there is no contribution, return, or cost", () => {
    expect(simulateYear(500_000, 0, none).endBalanceYen).toBe(500_000);
  });

  it("grows by the annual rate over twelve months without contributions", () => {
    const annual = 1.01 ** 12 - 1;
    const r = simulateYear(1_000_000, 0, { ...none, grossAnnualReturn: annual });
    expect(Math.abs(r.endBalanceYen - 1_126_825)).toBeLessThanOrEqual(12);
  });

  it("applies the trust fee as the annual rate with no return", () => {
    const r = simulateYear(1_000_000, 0, { ...none, annualCostRate: 0.12 });
    expect(Math.abs(r.endBalanceYen - 880_000)).toBeLessThanOrEqual(12);
    expect(r.trustFeeYen).toBe(1_000_000 - r.endBalanceYen);
  });

  it("deducts the fixed fee every month", () => {
    const r = simulateYear(100_000, 0, { ...none, fixedMonthlyFeeYen: 500 });
    expect(r.endBalanceYen).toBe(94_000);
    expect(r.fixedFeeYen).toBe(6_000);
  });

  it("never lets the fixed fee push the balance below zero", () => {
    const r = simulateYear(1_000, 0, { ...none, fixedMonthlyFeeYen: 600 });
    expect(r.endBalanceYen).toBe(0);
    expect(r.fixedFeeYen).toBe(1_000);
  });

  it("gives a lower balance for a higher trust fee on identical inputs", () => {
    const base = { ...none, grossAnnualReturn: 0.05 };
    const low = simulateYear(1_000_000, 30_000, { ...base, annualCostRate: 0.001 });
    const high = simulateYear(1_000_000, 30_000, { ...base, annualCostRate: 0.02 });
    expect(high.endBalanceYen).toBeLessThan(low.endBalanceYen);
  });

  it("supports a partial year", () => {
    expect(simulateYear(0, 10_000, none, 5).endBalanceYen).toBe(50_000);
  });
});

describe("validateInvestmentParams", () => {
  it("accepts zeros", () => {
    expect(validateInvestmentParams(none)).toEqual([]);
  });

  it("rejects a return at or below -100%, a cost rate of 100%, and a fractional fee", () => {
    expect(validateInvestmentParams({ ...none, grossAnnualReturn: -1 })).toHaveLength(1);
    expect(validateInvestmentParams({ ...none, annualCostRate: 1 })).toHaveLength(1);
    expect(validateInvestmentParams({ ...none, fixedMonthlyFeeYen: 10.5 })).toHaveLength(1);
  });
});
