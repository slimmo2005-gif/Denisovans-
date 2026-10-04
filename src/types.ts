export type PaperRole = "primary" | "review";

export type Paper = {
  id: string;
  citation: string;
  year: number;
  title: string;
  doi: string;
  url: string;
  role: PaperRole;
};

export type Statistic =
  | "absolute_percent"
  | "relative_to_reference"
  | "detected_tract_percent"
  | "detected_megabases"
  | "modeled_absolute_percent"
  | "upper_bound_percent"
  | "lower_bound_percent";

export type EstimateKind = "population_mean" | "individual";

export type IndividualPercent = {
  label: string;
  percent: number;
};

export type Estimate = {
  id: string;
  paperId: string;
  population: string;
  countryCodes: string[];
  region?: string;
  sampleSize: number | null;
  kind: EstimateKind;
  individuals?: IndividualPercent[];
  statistic: Statistic;
  value: number | null;
  valueMin?: number | null;
  valueMax?: number | null;
  uncertainty?: {
    se?: number;
    ci95?: [number, number];
  };
  method: string;
  archaicReference: string;
  referencePopulation?: string;
  sampleGroup: string;
  preferred: boolean;
  locator: string;
  notes?: string;
};

export type Evidence = "dna" | "protein" | "sediment_dna" | "morphology";

export type Grade = "confirmed" | "likely" | "possible";

export type Site = {
  id: string;
  name: string;
  place: string;
  countryCode: string;
  lat: number;
  lng: number;
  coordinateNote: string;
};

export type SpecimenImage = {
  href: string;
  caption: string;
  license: string;
};

export type Specimen = {
  id: string;
  siteId: string;
  name: string;
  grade: Grade;
  kind: "fossil" | "sediment";
  evidence: Evidence[];
  dateLabel: string;
  description: string;
  gradeRationale: string;
  paperIds: string[];
  hybrid?: boolean;
  image?: SpecimenImage | null;
};

export type CheckStatus = "agrees" | "not_comparable" | "discrepancy";

export type Check = {
  id: string;
  countryCode: string | null;
  status: CheckStatus;
  reviewPaperId: string;
  claim: string;
  comparison: string;
};

export type IncludedRow = {
  estimate: Estimate;
  percent: number;
  sampleSize: number;
};

export type ExcludedRow = {
  estimate: Estimate;
  reason: string;
};

export type CountrySummary = {
  countryCode: string;
  headline: number | null;
  range: [number, number] | null;
  included: IncludedRow[];
  excluded: ExcludedRow[];
};
