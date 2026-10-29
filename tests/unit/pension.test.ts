import { describe, expect, it } from "vitest";
import {
  annualAccrualYen,
  annualBenefitYen,
  benefitYears,
  lifetimeBenefitYen,
} from "../../src/engine/pension.ts";

const payload = { multiplierPerMille: 5.481 };

describe("annualAccrualYen", () => {
  it("is zero when the standard remuneration is zero", () => {
    expect(annualAccrualYen(payload, 0, 0)).toBe(0);
  });

  it("multiplies twelve months plus bonus by the benefit multiplier", () => {
    expect(annualAccrualYen(payload, 200_000, 0)).toBe(Math.round((2_400_000 * 5.481) / 1000));
    expect(annualAccrualYen(payload, 200_000, 600_000)).toBe(
      Math.round((3_000_000 * 5.481) / 1000),
    );
  });

  it("gives equal accruals for equal standard remuneration", () => {
    expect(annualAccrualYen(payload, 300_000, 0)).toBe(annualAccrualYen(payload, 300_000, 0));
  });

  it("lowers the accrual when the standard monthly remuneration drops", () => {
    expect(annualAccrualYen(payload, 290_000, 0)).toBeLessThan(
      annualAccrualYen(payload, 300_000, 0),
    );
  });
});

describe("benefit totals", () => {
  it("sums accruals into the annual benefit", () => {
    expect(annualBenefitYen([1_000, 2_000, 3_000])).toBe(6_000);
    expect(annualBenefitYen([])).toBe(0);
  });

  it("counts benefit years from the start age up to, not including, the end age", () => {
    expect(benefitYears(65, 90)).toBe(25);
    expect(benefitYears(70, 65)).toBe(0);
  });

  it("multiplies the annual benefit by the years paid", () => {
    expect(lifetimeBenefitYen([1_000, 2_000], 65, 70)).toBe(15_000);
  });
});
