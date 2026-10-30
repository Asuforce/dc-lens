import { describe, expect, it } from "vitest";
import {
  addScenario,
  defaultLabel,
  removeScenario,
  type ScenarioEntry,
} from "../../src/ui/scenarios.ts";

const entry: ScenarioEntry = {
  id: 1,
  label: "  試算  ",
  valuation: "nominal",
  regulationVersion: "test",
  summary: {
    currentAnnualDifferenceYen: 0,
    retirementAssetDifferenceYen: 0,
    annualPensionDifferenceAtRetirementYen: 0,
    breakEvenAge: null,
    lifetimeNominalDifferenceYen: 0,
    lifetimePresentValueDifferenceYen: 0,
  },
  contributions: { dcMonthlyYen: 0, idecoMonthlyYen: 0 },
  grossAnnualReturn: 0,
};
describe("scenarios", () => {
  it("normalizes labels and preserves input", () => {
    const original: ScenarioEntry[] = [];
    const added = addScenario(original, entry);
    expect(original).toEqual([]);
    expect(added[0]?.label).toBe("試算");
    expect(entry.label).toBe("  試算  ");
    expect(addScenario([], { ...entry, label: " " })[0]?.label).toBe(defaultLabel(1));
    expect(addScenario([], { ...entry, label: "あ".repeat(45) })[0]?.label).toHaveLength(40);
  });
  it("limits and removes without mutation", () => {
    const list = Array.from({ length: 4 }, (_, id) => ({ ...entry, id }));
    expect(addScenario(list, entry)).toBe(list);
    expect(removeScenario(list, 1)).toHaveLength(3);
    expect(list).toHaveLength(4);
  });
});
