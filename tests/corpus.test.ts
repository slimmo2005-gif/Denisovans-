import { describe, expect, it } from "vitest";
import { summarizeCountry, validateCorpus } from "../src/aggregate";
import type { Check, Estimate, Paper, Site, Specimen } from "../src/types";
import papers from "../data/papers.json";
import estimates from "../data/estimates.json";
import sites from "../data/sites.json";
import specimens from "../data/specimens.json";
import checks from "../data/checks.json";

const corpus = {
  papers: papers as Paper[],
  estimates: estimates as Estimate[],
  sites: sites as Site[],
  specimens: specimens as Specimen[],
};

describe("published corpus", () => {
  it("links every paper, site, and preferred estimate", () => {
    expect(validateCorpus(corpus)).toEqual([]);
  });

  it("uses every paper in an estimate, a specimen, or a check", () => {
    const used = new Set<string>();
    for (const estimate of corpus.estimates) used.add(estimate.paperId);
    for (const specimen of corpus.specimens) {
      for (const paperId of specimen.paperIds) used.add(paperId);
    }
    for (const check of checks as Check[]) used.add(check.reviewPaperId);
    const unused = corpus.papers.filter((paper) => !used.has(paper.id)).map((paper) => paper.id);
    expect(unused).toEqual([]);
    const paperIds = new Set(corpus.papers.map((paper) => paper.id));
    for (const check of checks as Check[]) {
      expect(paperIds.has(check.reviewPaperId)).toBe(true);
    }
    const estimateIds = corpus.estimates.map((estimate) => estimate.id);
    expect(new Set(estimateIds).size).toBe(estimateIds.length);
  });

  it("colors Papua New Guinea from Meyer and Malaspinas only", () => {
    const summary = summarizeCountry("PG", corpus.estimates);
    expect(summary.headline).toBeCloseTo((3 * 1 + 4 * 25) / 26);
    expect(summary.included.map((row) => row.estimate.id).sort()).toEqual([
      "malaspinas-2016-papuans",
      "meyer-2012-papuan",
    ]);
  });

  it("colors Australia from the Malaspinas sample of 83", () => {
    const summary = summarizeCountry("AU", corpus.estimates);
    expect(summary.headline).toBe(4);
    expect(summary.included.map((row) => row.estimate.id)).toEqual(["malaspinas-2016-australians"]);
  });

  it("does not color Indonesia, the Philippines, China, or Fiji", () => {
    for (const code of ["ID", "PH", "CN", "FJ"]) {
      expect(summarizeCountry(code, corpus.estimates).headline).toBeNull();
    }
  });

  it("keeps a discrepancy from changing the primary number", () => {
    const before = summarizeCountry("PG", corpus.estimates).headline;
    const discrepancy = (checks as Check[]).find((check) => check.status === "discrepancy");
    expect(discrepancy?.countryCode).toBe("PG");
    expect(summarizeCountry("PG", corpus.estimates).headline).toBe(before);
  });
});
