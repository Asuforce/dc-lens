import { describe, expect, it } from "vitest";
import { scaleRange } from "../../src/ui/charts.ts";
import { type FormValues, parseForm } from "../../src/ui/state.ts";

const values: FormValues = {
  age: "35",
  retirementAge: "60",
  pensionStartAge: "65",
  pensionEndAge: "90",
  annualIncome: "4200000",
  monthlySalary: "300000",
  bonus: "600000",
  raiseRate: "1",
  events: [],
  bonusMode: "fixed-ratio",
  prefecture: "tokyo",
  dcContribution: "20000",
  idecoContribution: "20000",
  dcCost: "0.3",
  idecoCost: "0.3",
  fixedFee: "0",
  initialBalance: "0",
  grossReturn: "3",
  inflation: "1",
  discount: "2",
  valuation: "nominal",
  regulationVersion: "test",
};
describe("form parsing", () => {
  it("converts percentages and estimates monthly salary", () => {
    const r = parseForm({ ...values, monthlySalary: "" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.salary.monthlySalaryYen).toBe(300000);
      expect(r.input.salary.monthlySalaryIsEstimated).toBe(true);
      expect(r.input.assumptions.discountRate).toBe(0.02);
    }
  });
  it("rejects inconsistent income", () => {
    expect(parseForm({ ...values, annualIncome: "1" }).ok).toBe(false);
  });
  it("rejects missing values", () => {
    expect(parseForm({ ...values, age: "" }).ok).toBe(false);
  });
});
it("includes zero in chart scales", () => {
  expect(scaleRange([2, 5])).toEqual({ min: 0, max: 5 });
  expect(scaleRange([0])).toEqual({ min: 0, max: 1 });
});
