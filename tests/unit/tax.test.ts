import { describe, expect, it } from "vitest";
import {
  findBracket,
  floorTo,
  incomeTax,
  residentTax,
  salaryDeductionYen,
} from "../../src/engine/tax.ts";
import type { IncomeTaxPayload, ResidentTaxPayload } from "../../src/regulations/schema.ts";

const common = {
  salaryDeductionBrackets: [
    { overYen: 0, upToYen: 100000, ratePercent: 0, constantYen: 20000 },
    { overYen: 100000, upToYen: null, ratePercent: 10, constantYen: 0 },
  ],
  salaryDeductionMinimumYen: 15000,
  basicDeductionBrackets: [{ overYen: 0, upToYen: null, deductionYen: 30000 }],
};
const income: IncomeTaxPayload = {
  ...common,
  taxBrackets: [{ overYen: 0, upToYen: null, ratePercent: 12.5, deductionYen: 1000 }],
  surtaxTotalPercent: 2.1,
};
const resident: ResidentTaxPayload = { ...common, incomeLevyPercent: 10, perCapitaLevyYen: 500 };
const input = {
  grossSalaryYen: 253999,
  socialInsuranceYen: 12000,
  smallBusinessMutualAidYen: 10000,
};
describe("tax", () => {
  it("selects inclusive upper boundaries", () => {
    const rows = common.salaryDeductionBrackets;
    expect(findBracket(rows, 0)).toBe(rows[0]);
    expect(findBracket(rows, 100000)).toBe(rows[0]);
    expect(findBracket(rows, 100001)).toBe(rows[1]);
    expect(() => findBracket(rows, -1)).toThrow(RangeError);
    expect(() => findBracket(rows, 1.5)).toThrow(RangeError);
  });
  it("applies flat, minimum and gross cap", () => {
    expect(salaryDeductionYen(1000, common)).toBe(1000);
    expect(salaryDeductionYen(100000, common)).toBe(20000);
    expect(salaryDeductionYen(100001, common)).toBe(15000);
    expect(floorTo(100, 199)).toBe(100);
    expect(floorTo(100, -1)).toBe(0);
  });
  it("calculates income tax and deductions", () => {
    const result = incomeTax(input, income);
    const taxable = Math.floor((253999 - 25399 - 12000 - 10000 - 30000) / 1000) * 1000;
    const base = Math.floor((taxable * 12500) / 100000) - 1000;
    const surtax = Math.floor((base * 2100) / 100000);
    expect(result.taxableIncomeYen).toBe(taxable);
    expect(result.baseTaxYen).toBe(base);
    expect(result.surtaxYen).toBe(surtax);
    expect(result.totalYen).toBe(Math.floor((base + surtax) / 100) * 100);
    expect(incomeTax({ ...input, socialInsuranceYen: 0 }, income).totalYen).toBeGreaterThan(
      result.totalYen,
    );
    expect(incomeTax({ ...input, smallBusinessMutualAidYen: 0 }, income).totalYen).toBeGreaterThan(
      result.totalYen,
    );
    expect(incomeTax(input, income)).toEqual(incomeTax(input, income));
    expect(incomeTax({ ...input, smallBusinessMutualAidYen: 11000 }, income).taxableIncomeYen).toBe(
      taxable - 1000,
    );
    expect(
      incomeTax({ grossSalaryYen: 0, socialInsuranceYen: 0, smallBusinessMutualAidYen: 0 }, income)
        .totalYen,
    ).toBe(0);
  });
  it("calculates resident tax including per capita at zero", () => {
    const result = residentTax(input, resident);
    expect(result.incomeLevyYen).toBe(
      Math.floor(Math.floor((result.taxableIncomeYen * 10) / 100) / 100) * 100,
    );
    expect(result.totalYen).toBe(result.incomeLevyYen + 500);
    expect(result.warnings).toHaveLength(2);
    expect(
      residentTax(
        { grossSalaryYen: 0, socialInsuranceYen: 0, smallBusinessMutualAidYen: 0 },
        resident,
      ).totalYen,
    ).toBe(500);
  });
});
