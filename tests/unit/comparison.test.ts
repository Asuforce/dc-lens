import { describe, expect, it } from "vitest";
import {
  cumulative,
  discountFactor,
  findBreakEvenAge,
  presentValueYen,
} from "../../src/engine/comparison.ts";

describe("present value", () => {
  it("does not change nominal values at a zero discount rate", () => {
    expect(presentValueYen(1_000_000, 0, 30)).toBe(1_000_000);
  });

  it("discounts by compound years", () => {
    expect(discountFactor(0.1, 2)).toBeCloseTo(1 / 1.21, 12);
    expect(presentValueYen(1_210_000, 0.1, 2)).toBe(1_000_000);
  });

  it("does not discount the base year", () => {
    expect(presentValueYen(500, 0.05, 0)).toBe(500);
  });
});

describe("cumulative", () => {
  it("accumulates in order", () => {
    expect(cumulative([1, -3, 5])).toEqual([1, -2, 3]);
    expect(cumulative([])).toEqual([]);
  });
});

describe("findBreakEvenAge", () => {
  const ages = [30, 31, 32, 33, 34];

  it("returns the first age where the sign flips", () => {
    expect(findBreakEvenAge(ages, [100, 50, -10, -80, -90])).toBe(32);
    expect(findBreakEvenAge(ages, [-100, -50, 10, 80, 90])).toBe(32);
  });

  it("returns null when the series never crosses", () => {
    expect(findBreakEvenAge(ages, [10, 20, 30, 40, 50])).toBeNull();
    expect(findBreakEvenAge(ages, [-10, -20, -30, -40, -50])).toBeNull();
  });

  it("returns null for an all-zero or empty series", () => {
    expect(findBreakEvenAge(ages, [0, 0, 0, 0, 0])).toBeNull();
    expect(findBreakEvenAge([], [])).toBeNull();
  });

  it("treats landing exactly on zero after a non-zero start as a crossing", () => {
    expect(findBreakEvenAge(ages, [50, 20, 0, 10, 40])).toBe(32);
  });

  it("returns the first of several crossings", () => {
    expect(findBreakEvenAge(ages, [10, -10, 10, -10, 10])).toBe(31);
  });

  it("skips leading zeros before choosing the starting sign", () => {
    expect(findBreakEvenAge(ages, [0, 0, 10, -5, -5])).toBe(33);
  });
});
