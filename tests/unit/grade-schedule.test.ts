import { describe, expect, it } from "vitest";
import { scheduleStandardRemuneration } from "../../src/engine/grade-schedule.ts";
import health from "../../src/regulations/data/2026/health-insurance-kyokai-kenpo.json";
import pension from "../../src/regulations/data/2026/pension-insurance.json";

function row<T>(list: T[], index: number): T {
  const found = list[index];
  if (found === undefined) throw new Error(`Missing row ${index}`);
  return found;
}

const table = pension.payload;
const base = row(table.grades, 13);
const next = row(table.grades, 14);
const higher = row(table.grades, 15);
const baseBound = base.lowerBoundYen;
const nextBound = next.lowerBoundYen;
const higherBound = higher.lowerBoundYen;
const run = (months: number[], changes: number[], initial = baseBound) =>
  scheduleStandardRemuneration({
    table,
    initialRemunerationYen: initial,
    monthlyRemunerationYen: months,
    fixedWageChangeMonthIndexes: changes,
  });

describe("standard remuneration schedule", () => {
  it("keeps a constant standard for 36 months", () => {
    expect(run(Array<number>(36).fill(baseBound), [])).toEqual(
      Array<number>(36).fill(base.standardMonthlyYen),
    );
  });
  it.each([{ changes: [3] }, { changes: [] }])(
    "applies a one-grade April raise in September with change indexes $changes",
    ({ changes }) => {
      const months = [...Array<number>(3).fill(baseBound), ...Array<number>(9).fill(nextBound)];
      expect(run(months, changes)).toEqual([
        ...Array<number>(8).fill(base.standardMonthlyYen),
        ...Array<number>(4).fill(next.standardMonthlyYen),
      ]);
    },
  );
  it("applies a two-grade April raise in July and skips September", () => {
    const highest = row(table.grades, 21);
    const months = [
      ...Array<number>(3).fill(baseBound),
      ...Array<number>(3).fill(higherBound),
      ...Array<number>(6).fill(highest.lowerBoundYen),
    ];
    expect(run(months, [3, 4])).toEqual([
      ...Array<number>(6).fill(base.standardMonthlyYen),
      higher.standardMonthlyYen,
      ...Array<number>(5).fill(row(table.grades, 17).standardMonthlyYen),
    ]);
  });
  it("applies a January raise in April", () => {
    expect(run(Array<number>(8).fill(higherBound), [0])).toEqual([
      ...Array<number>(3).fill(base.standardMonthlyYen),
      ...Array<number>(5).fill(higher.standardMonthlyYen),
    ]);
  });
  it("revises health by two grades while pension changes one at the pension ceiling", () => {
    const initial = row(pension.payload.grades, 30).lowerBoundYen;
    const raised = row(health.payload.grades, 35).lowerBoundYen;
    const months = Array<number>(6).fill(raised);
    const args = {
      initialRemunerationYen: initial,
      monthlyRemunerationYen: months,
      fixedWageChangeMonthIndexes: [0],
    };
    expect(scheduleStandardRemuneration({ ...args, table: pension.payload })[3]).toBe(
      row(pension.payload.grades, 30).standardMonthlyYen,
    );
    expect(scheduleStandardRemuneration({ ...args, table: health.payload })[3]).toBe(
      row(health.payload.grades, 35).standardMonthlyYen,
    );
  });
  it("carries annual April raises across three years", () => {
    const months = Array.from({ length: 36 }, (_, i) =>
      i < 3
        ? baseBound
        : i < 15
          ? nextBound
          : i < 27
            ? higherBound
            : row(table.grades, 16).lowerBoundYen,
    );
    const result = run(months, [3, 15, 27]);
    expect([result[8], result[19], result[20], result[31], result[32]]).toEqual([
      next.standardMonthlyYen,
      next.standardMonthlyYen,
      higher.standardMonthlyYen,
      higher.standardMonthlyYen,
      row(table.grades, 16).standardMonthlyYen,
    ]);
  });
  it("does not revise when fewer than three months remain", () => {
    expect(run([higherBound, higherBound], [0])).toEqual([
      base.standardMonthlyYen,
      base.standardMonthlyYen,
    ]);
  });
});
