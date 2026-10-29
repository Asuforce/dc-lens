import { describe, expect, it } from "vitest";
import { ALL_DATASETS } from "../../src/regulations/all-datasets.ts";
import { resolveRegulationSet } from "../../src/regulations/loader.ts";

describe("resolveRegulationSet with the bundled datasets", () => {
  it("resolves every kind for 2026-10-29 in precise mode", () => {
    const r = resolveRegulationSet(ALL_DATASETS, "2026-10-29", "precise");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.set.versions).toHaveLength(5);
      expect(r.set.warnings.length).toBeGreaterThan(0);
    }
  });

  it("fails safely for a date with no data", () => {
    const r = resolveRegulationSet(ALL_DATASETS, "2000-01-01", "precise");
    expect(r.ok).toBe(false);
  });
});
