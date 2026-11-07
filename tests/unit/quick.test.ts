import { describe, expect, it } from "vitest";
import { projectQuickBalances } from "../../src/engine/quick.ts";

describe("quick balances", () => {
  it("keeps existing assets separate from new contributions", () => {
    const combined = projectQuickBalances(630000, 13000);
    const fresh = projectQuickBalances(0, 13000);
    const existing = projectQuickBalances(630000, 0);
    expect(combined.map((p) => p.year)).toEqual([10, 20, 30]);
    combined.forEach((point, i) => {
      expect(point.total).toBe((fresh[i]?.total ?? NaN) + (existing[i]?.total ?? NaN));
    });
  });
  it("returns zero without assets or contributions", () => {
    expect(projectQuickBalances(0, 0).every((p) => p.total === 0)).toBe(true);
  });
  it("rejects balances exceeding integer precision", () => {
    expect(() => projectQuickBalances(Number.MAX_SAFE_INTEGER, 0)).toThrow("範囲");
  });
});
