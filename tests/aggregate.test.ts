import { describe, expect, it } from "vitest";
import { exclusionReason, pointPercent, summarizeCountry } from "../src/aggregate";
import type { Estimate } from "../src/types";

function estimate(partial: Partial<Estimate> & Pick<Estimate, "id">): Estimate {
  return {
    paperId: "paper",
    population: "Example",
    countryCodes: ["PG"],
    sampleSize: 10,
    kind: "population_mean",
    statistic: "absolute_percent",
    value: 4,
    method: "fixture",
    archaicReference: "Altai Denisovan",
    sampleGroup: "group-a",
    preferred: true,
    locator: "Table 1",
    ...partial,
  };
}

describe("pointPercent", () => {
  it("averages published individual percentages and ignores a mismatched hand-typed value", () => {
    const row = estimate({
      id: "people",
      kind: "individual",
      sampleSize: 2,
      value: 9,
      individuals: [
        { label: "A", percent: 4 },
        { label: "B", percent: 6 },
      ],
    });
    expect(pointPercent(row)).toBe(5);
  });

  it("does not treat a ratio as a percentage", () => {
    expect(
      pointPercent(
        estimate({
          id: "ratio",
          statistic: "relative_to_reference",
          value: 0.4,
        }),
      ),
    ).toBeNull();
  });
});

describe("summarizeCountry", () => {
  it("weights one preferred absolute estimate per sample and keeps the range", () => {
    const rows = [
      estimate({ id: "small", sampleGroup: "a", sampleSize: 1, value: 3, preferred: true }),
      estimate({
        id: "small-other-method",
        sampleGroup: "a",
        sampleSize: 1,
        value: 6,
        preferred: false,
      }),
      estimate({ id: "large", sampleGroup: "b", sampleSize: 25, value: 4, preferred: true }),
      estimate({
        id: "ratio",
        statistic: "relative_to_reference",
        value: 0.5,
        preferred: false,
        sampleGroup: "c",
      }),
    ];
    const summary = summarizeCountry("PG", rows);
    expect(summary.headline).toBeCloseTo((3 * 1 + 4 * 25) / 26);
    expect(summary.included.map((row) => row.estimate.id)).toEqual(["small", "large"]);
    expect(summary.range).toEqual([3, 6]);
    expect(summary.excluded.map((row) => row.estimate.id)).toEqual([
      "small-other-method",
      "ratio",
    ]);
  });

  it("leaves a country empty when it has no absolute percentage", () => {
    const summary = summarizeCountry("ID", [
      estimate({
        id: "moluccas",
        countryCodes: ["ID"],
        statistic: "relative_to_reference",
        value: 0.35,
        preferred: false,
      }),
    ]);
    expect(summary.headline).toBeNull();
    expect(exclusionReason(summary.excluded[0].estimate)).toMatch(/fraction/);
  });

  it("does not give a New Guinea percentage to Indonesia", () => {
    const summary = summarizeCountry("ID", [
      estimate({ id: "papuan", countryCodes: ["PG"], value: 4, sampleSize: 25 }),
    ]);
    expect(summary.headline).toBeNull();
    expect(summary.included).toHaveLength(0);
  });

  it("keeps a published range out of the weighted mean", () => {
    const summary = summarizeCountry("PG", [
      estimate({
        id: "range",
        value: null,
        valueMin: 1.9,
        valueMax: 3.4,
        preferred: false,
        sampleGroup: "vernot",
      }),
      estimate({ id: "point", value: 4, sampleSize: 10, sampleGroup: "other" }),
    ]);
    expect(summary.headline).toBe(4);
    expect(summary.range).toEqual([1.9, 4]);
  });

  it("does not weight an absolute percentage whose sample size was not published", () => {
    const summary = summarizeCountry("AU", [
      estimate({
        id: "known",
        countryCodes: ["AU"],
        value: 4,
        sampleSize: 83,
        sampleGroup: "known",
      }),
      estimate({
        id: "unknown-n",
        countryCodes: ["AU"],
        value: 3.4,
        sampleSize: null,
        sampleGroup: "other",
        preferred: true,
      }),
    ]);
    expect(summary.headline).toBe(4);
    expect(summary.excluded.map((row) => row.estimate.id)).toEqual(["unknown-n"]);
  });
});
