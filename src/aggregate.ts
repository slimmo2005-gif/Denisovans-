import type {
  CountrySummary,
  Estimate,
  ExcludedRow,
  IncludedRow,
  Paper,
  Specimen,
  Site,
} from "./types";

export function pointPercent(estimate: Estimate): number | null {
  if (estimate.statistic !== "absolute_percent") return null;
  if (estimate.kind === "individual") {
    const people = estimate.individuals;
    if (!people?.length) return null;
    const total = people.reduce((sum, person) => sum + person.percent, 0);
    return total / people.length;
  }
  return estimate.value;
}

export function exclusionReason(estimate: Estimate): string | null {
  switch (estimate.statistic) {
    case "relative_to_reference":
      return "This is a fraction of another population's Denisovan ancestry, not a percentage of the genome.";
    case "detected_tract_percent":
    case "detected_megabases":
      return "This measures detected archaic sequence, which is a different quantity from total Denisovan ancestry.";
    case "modeled_absolute_percent":
      return "This is the paper's model or extrapolation, not a direct estimate for a living group.";
    case "upper_bound_percent":
    case "lower_bound_percent":
      return "The paper gives a bound, not a point estimate.";
    case "absolute_percent": {
      const percent = pointPercent(estimate);
      if (percent == null) {
        return "The paper reports a range and no single percentage.";
      }
      if (!estimate.preferred) {
        return "Another estimate from the same sample is the one used in the country figure.";
      }
      if (estimate.sampleSize == null) {
        return "The paper does not state a sample size, so this estimate is not weighted into the country figure.";
      }
      if (estimate.kind === "individual" && estimate.individuals) {
        if (estimate.sampleSize !== estimate.individuals.length) {
          return "The sample size does not match the number of individual percentages.";
        }
      }
      return null;
    }
    default:
      return "This statistic is not an absolute percentage of the genome.";
  }
}

function rangeValues(estimate: Estimate): number[] {
  if (estimate.statistic !== "absolute_percent") return [];
  const values: number[] = [];
  const point = pointPercent(estimate);
  if (point != null) values.push(point);
  if (estimate.valueMin != null) values.push(estimate.valueMin);
  if (estimate.valueMax != null) values.push(estimate.valueMax);
  return values;
}

export function summarizeCountry(
  countryCode: string,
  estimates: Estimate[],
): CountrySummary {
  const rows = estimates.filter((estimate) =>
    estimate.countryCodes.includes(countryCode),
  );
  const included: IncludedRow[] = [];
  const excluded: ExcludedRow[] = [];
  const seenGroups = new Set<string>();

  for (const estimate of rows) {
    const reason = exclusionReason(estimate);
    if (reason) {
      excluded.push({ estimate, reason });
      continue;
    }
    const percent = pointPercent(estimate);
    if (percent == null || estimate.sampleSize == null) {
      excluded.push({
        estimate,
        reason: "This estimate could not be turned into a weighted percentage.",
      });
      continue;
    }
    if (seenGroups.has(estimate.sampleGroup)) {
      excluded.push({
        estimate,
        reason: "Another preferred estimate from this sample is already in the country figure.",
      });
      continue;
    }
    seenGroups.add(estimate.sampleGroup);
    included.push({
      estimate,
      percent,
      sampleSize: estimate.sampleSize,
    });
  }

  const weight = included.reduce((sum, row) => sum + row.sampleSize, 0);
  const headline =
    weight === 0
      ? null
      : included.reduce((sum, row) => sum + row.percent * row.sampleSize, 0) /
        weight;

  const span = rows.flatMap(rangeValues);
  const range: [number, number] | null =
    span.length === 0 ? null : [Math.min(...span), Math.max(...span)];

  return { countryCode, headline, range, included, excluded };
}

export function summariesByCountry(
  estimates: Estimate[],
): Map<string, CountrySummary> {
  const codes = new Set<string>();
  for (const estimate of estimates) {
    for (const code of estimate.countryCodes) codes.add(code);
  }
  const summaries = new Map<string, CountrySummary>();
  for (const code of codes) {
    summaries.set(code, summarizeCountry(code, estimates));
  }
  return summaries;
}

export function validateCorpus(input: {
  papers: Paper[];
  estimates: Estimate[];
  sites: Site[];
  specimens: Specimen[];
}): string[] {
  const problems: string[] = [];
  const paperIds = new Set(input.papers.map((paper) => paper.id));
  const siteIds = new Set(input.sites.map((site) => site.id));

  for (const estimate of input.estimates) {
    if (!paperIds.has(estimate.paperId)) {
      problems.push(`${estimate.id} cites missing paper ${estimate.paperId}`);
    }
    if (estimate.preferred && estimate.statistic !== "absolute_percent") {
      problems.push(`${estimate.id} is preferred but is not an absolute percentage`);
    }
    if (estimate.kind === "individual") {
      const people = estimate.individuals ?? [];
      if (people.length === 0) {
        problems.push(`${estimate.id} is individual but lists nobody`);
      } else if (estimate.sampleSize !== people.length) {
        problems.push(`${estimate.id} sample size does not match its individuals`);
      }
    }
  }

  const preferredByCountryGroup = new Map<string, string[]>();
  for (const estimate of input.estimates) {
    if (!estimate.preferred || estimate.statistic !== "absolute_percent") continue;
    for (const code of estimate.countryCodes) {
      const key = `${code}:${estimate.sampleGroup}`;
      const list = preferredByCountryGroup.get(key) ?? [];
      list.push(estimate.id);
      preferredByCountryGroup.set(key, list);
    }
  }
  for (const [key, ids] of preferredByCountryGroup) {
    if (ids.length > 1) {
      problems.push(`More than one preferred estimate for ${key}: ${ids.join(", ")}`);
    }
  }

  for (const specimen of input.specimens) {
    if (!siteIds.has(specimen.siteId)) {
      problems.push(`${specimen.id} cites missing site ${specimen.siteId}`);
    }
    for (const paperId of specimen.paperIds) {
      if (!paperIds.has(paperId)) {
        problems.push(`${specimen.id} cites missing paper ${paperId}`);
      }
    }
  }

  return problems;
}

export function formatPercent(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded.toFixed(rounded % 1 === 0 ? 1 : 2)}%`;
}

export function formatEstimateValue(estimate: Estimate): string {
  const se = estimate.uncertainty?.se;
  const seText = se == null ? "" : ` ± ${trimNumber(se)}`;
  const ci = estimate.uncertainty?.ci95;
  const ciText = ci ? ` (95% CI ${trimNumber(ci[0])}–${trimNumber(ci[1])})` : "";

  switch (estimate.statistic) {
    case "absolute_percent":
    case "detected_tract_percent":
    case "modeled_absolute_percent": {
      const point = estimate.kind === "individual" ? pointPercent(estimate) : estimate.value;
      if (point == null) {
        if (
          estimate.statistic === "modeled_absolute_percent" &&
          estimate.valueMin != null &&
          estimate.valueMax != null
        ) {
          return `${trimNumber(estimate.valueMin)}–${trimNumber(estimate.valueMax)}% (derived range)`;
        }
        return rangeText(estimate, "%");
      }
      return `${formatPercent(point)}${seText}${ciText}`;
    }
    case "upper_bound_percent":
      return estimate.value == null ? "upper bound" : `less than ${trimNumber(estimate.value)}%`;
    case "lower_bound_percent":
      return estimate.value == null ? "lower bound" : `greater than ${trimNumber(estimate.value)}%`;
    case "detected_megabases":
      return estimate.value == null
        ? rangeText(estimate, " Mb")
        : `about ${trimNumber(estimate.value)} Mb detected${ciText}`;
    case "relative_to_reference": {
      const reference = estimate.referencePopulation ?? "the reference population";
      if (estimate.value == null) {
        if (estimate.valueMin != null && estimate.valueMax != null) {
          return `${trimNumber(estimate.valueMin)}–${trimNumber(estimate.valueMax)}% higher than ${reference}`;
        }
        return `relative to ${reference}`;
      }
      const seBit = se == null ? "" : ` ± ${trimNumber(se)}`;
      return `${trimNumber(estimate.value)}${seBit} times ${reference}`;
    }
    default:
      return "—";
  }
}

function rangeText(estimate: Estimate, unit: string): string {
  if (estimate.valueMin == null || estimate.valueMax == null) return "range not stated as a single figure";
  return `${trimNumber(estimate.valueMin)}–${trimNumber(estimate.valueMax)}${unit}`;
}

function trimNumber(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}
