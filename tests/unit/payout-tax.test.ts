import { describe, expect, it } from "vitest";
import { lumpSumTax } from "../../src/engine/payout-tax.ts";
import { ALL_DATASETS } from "../../src/regulations/all-datasets.ts";
import { resolveRegulationSet } from "../../src/regulations/loader.ts";

const resolved = resolveRegulationSet(ALL_DATASETS, "2026-10-30", "precise");
if (!resolved.ok) throw new Error(resolved.errors.join(" / "));
const set = resolved.set;
describe("一時金課税", () => {
  it.each([
    [1, 800000],
    [2, 800000],
    [3, 1200000],
    [20, 8000000],
    [21, 8700000],
  ])("勤続 %i 年の控除", (serviceYears, deduction) => {
    expect(lumpSumTax({ lumpSumYen: 0, serviceYears }, set).deductionYen).toBe(deduction);
  });
  it.each([
    [50000, 3000, 2000],
    [52000, 3100, 2000],
  ])("住民税の端数処理", (income, municipal, prefectural) => {
    const result = lumpSumTax({ lumpSumYen: 800000 + income * 2, serviceYears: 1 }, set);
    expect(result.residentTaxMunicipalYen).toBe(municipal);
    expect(result.residentTaxPrefecturalYen).toBe(prefectural);
  });
  it("所得税と千円未満切捨て", () => {
    const result = lumpSumTax({ lumpSumYen: 800000 + 7601998, serviceYears: 1 }, set);
    expect(result.taxableRetirementIncomeYen).toBe(3800000);
    expect(result.incomeTaxYen).toBe(339482);
  });
});
