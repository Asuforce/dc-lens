import { describe, expect, it } from "vitest";
import { simulate } from "../../src/engine/simulate.ts";
import type { SimulationInput } from "../../src/engine/types.ts";
import { resultToCsv } from "../../src/lib/csv.ts";
import { ALL_DATASETS } from "../../src/regulations/all-datasets.ts";
import { resolveRegulationSet } from "../../src/regulations/loader.ts";

const resolved = resolveRegulationSet(ALL_DATASETS, "2026-10-29", "precise");
if (!resolved.ok) throw new Error(resolved.errors.join("; "));
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

describe("resultToCsv", () => {
  it("exports each year with a BOM and CRLF", () => {
    const result = simulate(baseInput(), resolved.set);
    const csv = resultToCsv(result);
    expect(csv.startsWith("\uFEFF年,年齢,入力報酬,手取り差,DC所得税")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.split("\r\n")).toHaveLength(result.yearlyResults.length + 2);
    expect(csv.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
  });
  it("quotes special characters and guards string formulas", () => {
    const result = simulate(baseInput(), resolved.set);
    for (const prefix of ["=", "+", "-", "@", "\t", "\r"]) {
      result.regulationVersion = `${prefix}a,"b"\n`;
      expect(resultToCsv(result)).toContain(`"'${prefix}a,""b""\n"`);
    }
    result.regulationVersion = 'a,"b"\n';
    expect(resultToCsv(result)).toContain('"a,""b""\n"');
  });
});
