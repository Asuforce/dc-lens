import { describe, expect, it } from "vitest";
import { ALL_DATASETS } from "../../src/regulations/all-datasets.ts";
import { resolveRegulationSet } from "../../src/regulations/loader.ts";

describe("resolveRegulationSet with the bundled datasets", () => {
  it("resolves every kind for 2026-10-29 in precise mode", () => {
    const r = resolveRegulationSet(ALL_DATASETS, "2026-10-29", "precise");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.set.versions).toHaveLength(7);
      expect(r.set.warnings.length).toBeGreaterThan(0);
    }
  });

  it("fails safely for a date with no data", () => {
    const r = resolveRegulationSet(ALL_DATASETS, "2000-01-01", "precise");
    expect(r.ok).toBe(false);
  });
});

it("contribution limit follows the effective date and can be absent", () => {
  const before = resolveRegulationSet(ALL_DATASETS, "2026-11-30", "precise");
  const after = resolveRegulationSet(ALL_DATASETS, "2026-12-01", "precise");
  const absent = resolveRegulationSet(
    ALL_DATASETS.filter((d) => d.meta.kind !== "contribution-limit"),
    "2026-11-30",
    "precise",
  );
  if (!before.ok || !after.ok || !absent.ok) throw new Error("resolution failed");
  expect(before.set.contributionLimit?.status).toBe("verified");
  expect(after.set.contributionLimit?.status).toBe("planned");
  expect(absent.set.contributionLimit).toBeNull();
});
