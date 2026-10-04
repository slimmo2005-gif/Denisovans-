import {
  formatEstimateValue,
  formatPercent,
  summarizeCountry,
} from "./aggregate";
import type {
  Check,
  CountrySummary,
  Estimate,
  Grade,
  Paper,
  Site,
  Specimen,
} from "./types";

export type AtlasData = {
  papers: Paper[];
  estimates: Estimate[];
  sites: Site[];
  specimens: Specimen[];
  checks: Check[];
};

const gradeLabel: Record<Grade, string> = {
  confirmed: "Confirmed",
  likely: "Likely",
  possible: "Possible",
};

export function renderHome(panel: HTMLElement, data: AtlasData, onSite: (siteId: string) => void): void {
  panel.replaceChildren();
  const regional = data.estimates.filter((estimate) => estimate.countryCodes.length === 0);
  append(panel, "p", "eyebrow", "Old World and Oceania");
  append(panel, "h2", "", "What the color means");
  append(
    panel,
    "p",
    "lede",
    "A country is colored only when a paper states an absolute Denisovan percentage for an indigenous group there. Gray means no such percentage is in this atlas. It does not mean zero.",
  );
  append(
    panel,
    "p",
    "",
    "The number is a sample-size-weighted mean of one preferred estimate per independent sample. Ratios to New Guineans, detected-sequence lengths, bounds, and models stay on the panel and out of the color.",
  );
  const list = document.createElement("ul");
  list.className = "site-jump";
  for (const site of data.sites) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = site.name;
    button.addEventListener("click", () => onSite(site.id));
    item.append(button);
    list.append(item);
  }
  append(panel, "h3", "", "Fossil sites");
  panel.append(list);
  append(panel, "h3", "", "Regional figures, not assigned to one country");
  for (const estimate of regional) {
    panel.append(estimateCard(estimate, data, false));
  }
}

export function renderCountry(
  panel: HTMLElement,
  data: AtlasData,
  countryCode: string,
  countryName: string,
  onSite: (siteId: string) => void,
): void {
  const summary = summarizeCountry(countryCode, data.estimates);
  const rows = data.estimates.filter((estimate) => estimate.countryCodes.includes(countryCode));
  const sites = data.sites.filter((site) => site.countryCode === countryCode);
  const countryChecks = data.checks.filter((check) => check.countryCode === countryCode);

  panel.replaceChildren();
  append(panel, "p", "eyebrow", countryCode || "Area");
  append(panel, "h2", "", countryName);

  if (summary.headline == null) {
    append(panel, "p", "headline muted", "No primary percentage");
    append(
      panel,
      "p",
      "",
      "No paper in this atlas gives an absolute Denisovan percentage, with a sample size, for an indigenous group in this country. Reports that do exist are listed below and are not turned into a color.",
    );
  } else {
    append(panel, "p", "headline", formatPercent(summary.headline));
    append(panel, "p", "formula", formula(summary));
    if (summary.range) {
      append(
        panel,
        "p",
        "range",
        `Range of absolute percentages in the underlying papers: ${formatPercent(summary.range[0])} to ${formatPercent(summary.range[1])}. The range includes estimates that are not in the weighted figure.`,
      );
    }
  }

  if (summary.included.length > 0) {
    append(panel, "h3", "", "In the country figure");
    for (const row of summary.included) {
      panel.append(estimateCard(row.estimate, data, true));
    }
  }

  const rest = rows.filter(
    (estimate) => !summary.included.some((row) => row.estimate.id === estimate.id),
  );
  if (rest.length > 0) {
    append(panel, "h3", "", "Reported, not averaged in");
    for (const estimate of rest) {
      const reason = summary.excluded.find((row) => row.estimate.id === estimate.id)?.reason;
      const card = estimateCard(estimate, data, false);
      if (reason) {
        const note = document.createElement("p");
        note.className = "reason";
        note.textContent = reason;
        card.append(note);
      }
      panel.append(card);
    }
  }

  if (sites.length > 0) {
    append(panel, "h3", "", "Fossil sites here");
    const list = document.createElement("ul");
    list.className = "site-jump";
    for (const site of sites) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = site.name;
      button.addEventListener("click", () => onSite(site.id));
      item.append(button);
      list.append(item);
    }
    panel.append(list);
  }

  if (countryChecks.length > 0) {
    append(panel, "h3", "", "Checked against other summaries");
    for (const check of countryChecks) panel.append(checkCard(check, data));
  }
}

export function renderSite(panel: HTMLElement, data: AtlasData, site: Site): void {
  const specimens = data.specimens.filter((specimen) => specimen.siteId === site.id);
  panel.replaceChildren();
  append(panel, "p", "eyebrow", site.place);
  append(panel, "h2", "", site.name);
  append(panel, "p", "coord", site.coordinateNote);
  for (const specimen of specimens) panel.append(specimenCard(specimen, data));
}

function formula(summary: CountrySummary): string {
  const terms = summary.included
    .map((row) => `${formatPercent(row.percent)} × ${row.sampleSize}`)
    .join(" + ");
  const weight = summary.included.reduce((sum, row) => sum + row.sampleSize, 0);
  return `(${terms}) / ${weight}. One preferred absolute percentage from each independent sample, weighted by the published sample size.`;
}

function estimateCard(estimate: Estimate, data: AtlasData, included: boolean): HTMLElement {
  const card = document.createElement("article");
  card.className = "card";
  const paper = data.papers.find((item) => item.id === estimate.paperId);
  const title = document.createElement("h4");
  title.textContent = estimate.population;
  const badge = document.createElement("span");
  badge.className = included ? "badge in" : "badge out";
  badge.textContent = included ? "In the average" : "Not in the average";
  const head = document.createElement("div");
  head.className = "card-head";
  head.append(title, badge);
  const value = document.createElement("p");
  value.className = "value";
  value.textContent = formatEstimateValue(estimate);
  card.append(head, value, metaLine(`Method: ${estimate.method}`));
  card.append(metaLine(`Reference: ${estimate.archaicReference}`));
  card.append(metaLine(sampleLine(estimate)));
  card.append(metaLine(estimate.locator));
  if (estimate.notes) card.append(metaLine(estimate.notes));
  if (paper) card.append(paperLink(paper));
  return card;
}

function specimenCard(specimen: Specimen, data: AtlasData): HTMLElement {
  const card = document.createElement("article");
  card.className = "card";
  const head = document.createElement("div");
  head.className = "card-head";
  const title = document.createElement("h4");
  title.textContent = specimen.name;
  const badge = document.createElement("span");
  badge.className = `badge grade-${specimen.grade}`;
  badge.textContent = specimen.hybrid ? `${gradeLabel[specimen.grade]} hybrid` : gradeLabel[specimen.grade];
  head.append(title, badge);
  card.append(head);
  card.append(metaLine(specimen.kind === "sediment" ? "Sediment, not a fossil" : "Fossil"));
  card.append(metaLine(specimen.dateLabel));
  card.append(metaLine(specimen.evidence.join(", ").replaceAll("_", " ")));
  const description = document.createElement("p");
  description.textContent = specimen.description;
  const rationale = document.createElement("p");
  rationale.textContent = specimen.gradeRationale;
  card.append(description, rationale);
  if (specimen.image) {
    const link = document.createElement("a");
    link.href = specimen.image.href;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = specimen.image.caption;
    const license = document.createElement("p");
    license.className = "meta";
    license.textContent = specimen.image.license;
    card.append(link, license);
  }
  for (const paperId of specimen.paperIds) {
    const paper = data.papers.find((item) => item.id === paperId);
    if (paper) card.append(paperLink(paper));
  }
  return card;
}

function checkCard(check: Check, data: AtlasData): HTMLElement {
  const card = document.createElement("article");
  card.className = "card";
  const badge = document.createElement("span");
  badge.className = `badge status-${check.status}`;
  badge.textContent = check.status.replaceAll("_", " ");
  card.append(badge);
  const claim = document.createElement("p");
  claim.textContent = check.claim;
  const comparison = document.createElement("p");
  comparison.textContent = check.comparison;
  card.append(claim, comparison);
  const paper = data.papers.find((item) => item.id === check.reviewPaperId);
  if (paper) card.append(paperLink(paper));
  return card;
}

function paperLink(paper: Paper): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = paper.url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = `${paper.citation}. ${paper.title}`;
  return link;
}

function sampleLine(estimate: Estimate): string {
  if (estimate.sampleSize == null) return "Sample size not stated for this figure";
  const people = estimate.sampleSize === 1 ? "person" : "people";
  return `Sample size ${estimate.sampleSize} ${people}`;
}

function metaLine(text: string): HTMLParagraphElement {
  const line = document.createElement("p");
  line.className = "meta";
  line.textContent = text;
  return line;
}

function append(parent: HTMLElement, tag: string, className: string, text: string): void {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  parent.append(node);
}
