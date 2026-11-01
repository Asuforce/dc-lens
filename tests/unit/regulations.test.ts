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

describe("retirement income dataset", () => {
  const m = { ...meta, kind: "retirement-income" };
  const payload = {
    deductionPerYearUpTo20Yen: 400000,
    deductionPerYearOver20Yen: 700000,
    deductionMinimumYen: 800000,
    deductionBaseAt20YearsYen: 8000000,
    taxableFractionDenominator: 2,
    residentPrefecturalPercent: 4,
    residentMunicipalPercent: 6,
  };
  it("validates required values and rejects invalid amounts and rates", () => {
    expect(validateDataset({ meta: m, payload }).ok).toBe(true);
    expect(
      validateDataset({ meta: m, payload: { ...payload, taxableFractionDenominator: 0 } }).ok,
    ).toBe(false);
    expect(
      validateDataset({ meta: m, payload: { ...payload, residentMunicipalPercent: 101 } }).ok,
    ).toBe(false);
    expect(validateDataset({ meta: m, payload: { ...payload, deductionMinimumYen: -1 } }).ok).toBe(
      false,
    );
    expect(validateDataset({ meta: m, payload: {} }).ok).toBe(false);
  });
  it("selects verified data only within its effective period", () => {
    const datasets = parseDatasets([{ meta: { ...m, effectiveTo: "2030-12-31" }, payload }]);
    expect(selectDataset(datasets, "retirement-income", "2030-01-01", "precise").ok).toBe(true);
    expect(selectDataset(datasets, "retirement-income", "2031-01-01", "precise").ok).toBe(false);
    const provisional = parseDatasets([
      { meta: { ...m, status: "provisional", verifiedAt: null }, payload },
    ]);
    expect(selectDataset(provisional, "retirement-income", "2030-06-01", "precise").ok).toBe(false);
    expect(selectDataset(provisional, "retirement-income", "2030-06-01", "draft").ok).toBe(true);
  });
});
