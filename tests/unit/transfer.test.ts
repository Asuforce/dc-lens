import { describe, expect, it } from "vitest";
import {
  compareTransfer,
  type TransferInput,
  validateTransferInput,
} from "../../src/engine/transfer.ts";

const base: TransferInput = {
  balanceYen: 12000,
  transferFeeYen: 0,
  idleMonths: 0,
  yearsToRetirement: 1,
  grossAnnualReturn: 0,
  keep: { annualCostRate: 0, fixedMonthlyFeeYen: 0 },
  move: { annualCostRate: 0, fixedMonthlyFeeYen: 0 },
  discountRate: 0.1,
};
describe("existing asset transfer", () => {
  it("keeps equal balances with equal costs", () =>
    expect(compareTransfer(base).differenceYen).toBe(0));
  it("deducts the transfer fee", () =>
    expect(compareTransfer({ ...base, transferFeeYen: 110 }).differenceYen).toBe(-110));
  it("does not change a balance during idle months at zero return", () =>
    expect(compareTransfer({ ...base, idleMonths: 20 }).differenceYen).toBe(0));
  it("charges fixed fees only on keep", () =>
    expect(
      compareTransfer({ ...base, keep: { annualCostRate: 0, fixedMonthlyFeeYen: 10 } })
        .differenceYen,
    ).toBe(120));
  it("floors the moved balance", () =>
    expect(compareTransfer({ ...base, transferFeeYen: 13000 }).moveBalanceAtRetirementYen).toBe(0));
  it("validates inputs", () =>
    expect(validateTransferInput({ ...base, idleMonths: -1 }).length).toBeGreaterThan(0));
  it("discounts the difference separately", () => {
    const result = compareTransfer({ ...base, transferFeeYen: 110 });
    expect(result.differenceYen).toBe(-110);
    expect(result.presentValueDifferenceYen).toBe(-100);
  });
  it("has no contribution input", () =>
    expect(Object.keys(base).some((key) => key.includes("contribution"))).toBe(false));
});
