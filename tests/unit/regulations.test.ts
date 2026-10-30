import { describe, expect, it } from "vitest";
import { parseDatasets, selectDataset } from "../../src/regulations/loader.ts";
import { validateDataset, validateGradeTable, validateMeta } from "../../src/regulations/schema.ts";

const meta = {
  version: "synthetic-1",
  kind: "pension-insurance",
  effectiveFrom: "2030-01-01",
  effectiveTo: null,
  sourceName: "synthetic fixture",
  sourceUrl: "https://example.com/fixture",
  verifiedAt: "2030-01-02",
  status: "verified",
};

const grades = {
  totalRatePercent: 10,
  bonusCapPerMonthYen: 1000,
  grades: [
    { grade: 1, standardMonthlyYen: 100, lowerBoundYen: 0, upperBoundYen: 150 },
    { grade: 2, standardMonthlyYen: 200, lowerBoundYen: 150, upperBoundYen: null },
  ],
};

describe("validateMeta", () => {
  it("accepts a complete verified dataset meta", () => {
    expect(validateMeta(meta).ok).toBe(true);
  });

  it("requires verifiedAt when status is verified", () => {
    const r = validateMeta({ ...meta, verifiedAt: null });
    expect(r.ok).toBe(false);
  });

  it("rejects a non-https source URL and an unknown status", () => {
    const r = validateMeta({ ...meta, sourceUrl: "http://example.com", status: "guess" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(2);
  });

  it("allows provisional datasets without verification date", () => {
    expect(validateMeta({ ...meta, status: "provisional", verifiedAt: null }).ok).toBe(true);
  });
});

describe("validateGradeTable", () => {
  it("accepts contiguous grades ending with an open upper bound", () => {
    expect(validateGradeTable(grades).ok).toBe(true);
  });

  it("rejects a gap between grades", () => {
    const gap = {
      grades: [
        { grade: 1, standardMonthlyYen: 100, lowerBoundYen: 0, upperBoundYen: 150 },
        { grade: 2, standardMonthlyYen: 200, lowerBoundYen: 160, upperBoundYen: null },
      ],
    };
    expect(validateGradeTable(gap).ok).toBe(false);
  });

  it("rejects an open upper bound before the last grade", () => {
    const open = {
      grades: [
        { grade: 1, standardMonthlyYen: 100, lowerBoundYen: 0, upperBoundYen: null },
        { grade: 2, standardMonthlyYen: 200, lowerBoundYen: 150, upperBoundYen: null },
      ],
    };
    expect(validateGradeTable(open).ok).toBe(false);
  });
});

describe("selectDataset", () => {
  const verified = parseDatasets([{ meta, payload: grades }]);
  const provisional = parseDatasets([
    { meta: { ...meta, status: "provisional", verifiedAt: null }, payload: grades },
  ]);

  it("returns a verified dataset in precise mode", () => {
    expect(selectDataset(verified, "pension-insurance", "2030-06-01", "precise").ok).toBe(true);
  });

  it("refuses a provisional dataset in precise mode but allows draft mode", () => {
    const precise = selectDataset(provisional, "pension-insurance", "2030-06-01", "precise");
    expect(precise.ok).toBe(false);
    if (!precise.ok) expect(precise.reason).toBe("not-verified");
    expect(selectDataset(provisional, "pension-insurance", "2030-06-01", "draft").ok).toBe(true);
  });

  it("reports missing data outside the effective period", () => {
    const r = selectDataset(verified, "pension-insurance", "2029-12-31", "precise");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing");
  });
});

describe("validateDataset", () => {
  it("validates the payload that matches the kind", () => {
    expect(validateDataset({ meta, payload: { grades: [] } }).ok).toBe(false);
    expect(validateDataset({ meta, payload: grades }).ok).toBe(true);
  });
});

describe("contribution limits", () => {
  it("validates positive integer caps", () => {
    const m = { ...meta, kind: "contribution-limit" };
    expect(validateDataset({ meta: m, payload: { dcMonthlyYen: 1, idecoMonthlyYen: 2 } }).ok).toBe(
      true,
    );
    expect(
      validateDataset({ meta: m, payload: { dcMonthlyYen: 0, idecoMonthlyYen: 2.5 } }).ok,
    ).toBe(false);
  });
});
