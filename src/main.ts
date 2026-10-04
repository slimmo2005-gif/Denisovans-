import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import { summarizeCountry } from "./aggregate";
import checks from "../data/checks.json";
import estimates from "../data/estimates.json";
import papers from "../data/papers.json";
import sites from "../data/sites.json";
import specimens from "../data/specimens.json";
import { renderCountry, renderHome, renderSite, type AtlasData } from "./panel";
import type { Check, Estimate, Grade, Paper, Site, Specimen } from "./types";

const data: AtlasData = {
  papers: papers as Paper[],
  estimates: estimates as Estimate[],
  sites: sites as Site[],
  specimens: specimens as Specimen[],
  checks: checks as Check[],
};

type CountryFeature = GeoJSON.Feature<GeoJSON.Geometry, { iso: string; name: string }>;

const gradeRank: Record<Grade, number> = { possible: 1, likely: 2, confirmed: 3 };

const panelQuery = document.querySelector<HTMLElement>("#panel");
const mapNode = document.querySelector<HTMLElement>("#map");
if (!panelQuery || !mapNode) throw new Error("Map markup is missing");
const panel: HTMLElement = panelQuery;

const map = L.map(mapNode, {
  minZoom: 2,
  maxZoom: 8,
  worldCopyJump: false,
  attributionControl: true,
});
map.attributionControl?.addAttribution("Country shapes: Natural Earth");

map.fitBounds([
  [-47, -18],
  [72, 188],
]);

const legend = new L.Control({ position: "bottomleft" });
legend.onAdd = () => {
  const box = L.DomUtil.create("div", "legend");
  box.innerHTML = `
    <strong>Share of the genome</strong>
    <div class="swatch"><i style="background:#d9d3c7"></i> No primary percentage</div>
    <div class="swatch"><i style="background:#f3e2c0"></i> Under 0.5%</div>
    <div class="swatch"><i style="background:#e4c07a"></i> 0.5–1.5%</div>
    <div class="swatch"><i style="background:#d08a45"></i> 1.5–2.5%</div>
    <div class="swatch"><i style="background:#b85a32"></i> 2.5–3.5%</div>
    <div class="swatch"><i style="background:#7c2f28"></i> 3.5% and above</div>
    <strong style="margin-top:8px">Fossils</strong>
    <div class="swatch"><i class="pin pin-confirmed"></i> Confirmed</div>
    <div class="swatch"><i class="pin pin-likely"></i> Likely</div>
    <div class="swatch"><i class="pin pin-possible"></i> Possible</div>
  `;
  return box;
};
legend.addTo(map);

const showAncestry = document.querySelector<HTMLInputElement>("#show-ancestry");
const showFossils = document.querySelector<HTMLInputElement>("#show-fossils");
const gradeInputs = Array.from(document.querySelectorAll<HTMLInputElement>(".grade-toggle"));

let countries: L.GeoJSON | null = null;
const markers = new Map<string, L.Marker>();

function ancestryFill(iso: string): string {
  if (!iso) return "#d9d3c7";
  const headline = summarizeCountry(iso, data.estimates).headline;
  if (headline == null) return "#d9d3c7";
  if (headline < 0.5) return "#f3e2c0";
  if (headline < 1.5) return "#e4c07a";
  if (headline < 2.5) return "#d08a45";
  if (headline < 3.5) return "#b85a32";
  return "#7c2f28";
}

function styleCountry(feature?: CountryFeature): L.PathOptions {
  const iso = feature?.properties.iso ?? "";
  const colored = showAncestry?.checked !== false;
  return {
    color: "#f7f4ee",
    weight: 0.6,
    fillColor: ancestryFill(iso),
    fillOpacity: colored ? 0.88 : 0.12,
  };
}

function tooltipText(iso: string, name: string): string {
  if (!iso) return name;
  const headline = summarizeCountry(iso, data.estimates).headline;
  return headline == null ? `${name}: no primary percentage` : `${name}: ${headline.toFixed(2)}%`;
}

function openCountry(iso: string, name: string): void {
  renderCountry(panel, data, iso, name, openSite);
  panel.scrollTop = 0;
}

function openSite(siteId: string): void {
  const site = data.sites.find((item) => item.id === siteId);
  if (!site) return;
  renderSite(panel, data, site);
  panel.scrollTop = 0;
  const marker = markers.get(siteId);
  if (marker) marker.openPopup();
  map.panTo([site.lat, site.lng]);
}

function siteGrade(siteId: string): Grade {
  const present = data.specimens.filter((specimen) => specimen.siteId === siteId);
  return present.reduce<Grade>((best, specimen) => {
    return gradeRank[specimen.grade] > gradeRank[best] ? specimen.grade : best;
  }, "possible");
}

function visibleGrades(): Set<Grade> {
  const selected = gradeInputs.filter((input) => input.checked).map((input) => input.value as Grade);
  return new Set(selected);
}

function refreshMarkers(): void {
  const grades = visibleGrades();
  const fossilsOn = showFossils?.checked !== false;
  for (const [siteId, marker] of markers) {
    const grade = siteGrade(siteId);
    const show = fossilsOn && grades.has(grade);
    if (show && !map.hasLayer(marker)) marker.addTo(map);
    if (!show && map.hasLayer(marker)) marker.remove();
  }
}

function addMarkers(): void {
  for (const site of data.sites) {
    const grade = siteGrade(site.id);
    const icon = L.divIcon({
      className: "fossil-icon",
      html: `<span class="pin pin-${grade}"></span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    const marker = L.marker([site.lat, site.lng], { icon, zIndexOffset: 500 });
    marker.bindTooltip(`${site.name}: ${grade}`, { direction: "top" });
    marker.on("click", (event) => {
      L.DomEvent.stopPropagation(event.originalEvent);
      openSite(site.id);
    });
    markers.set(site.id, marker);
  }
  refreshMarkers();
}

async function loadCountries(): Promise<void> {
  const response = await fetch(`${import.meta.env.BASE_URL}geo/old-world.geojson`);
  if (!response.ok) throw new Error("Country shapes failed to load");
  const collection = (await response.json()) as GeoJSON.FeatureCollection;
  countries = L.geoJSON(collection, {
    style: (feature) => styleCountry(feature as CountryFeature),
    onEachFeature: (feature, layer) => {
      const properties = (feature as CountryFeature).properties;
      layer.bindTooltip(tooltipText(properties.iso, properties.name), { sticky: true });
      layer.on("click", () => openCountry(properties.iso, properties.name));
      layer.on("mouseover", () => {
        (layer as L.Path).setStyle({ weight: 1.6, color: "#1c1915" });
      });
      layer.on("mouseout", () => {
        if (countries) countries.resetStyle(layer as L.Path);
      });
    },
  }).addTo(map);
}

function restyleCountries(): void {
  countries?.setStyle((feature) => styleCountry(feature as CountryFeature));
}

showAncestry?.addEventListener("change", restyleCountries);
showFossils?.addEventListener("change", refreshMarkers);
for (const input of gradeInputs) input.addEventListener("change", refreshMarkers);

document.querySelector("#close-panel")?.addEventListener("click", () => {
  renderHome(panel, data, openSite);
});

renderHome(panel, data, openSite);
addMarkers();
loadCountries().catch((error: unknown) => {
  appendError(error instanceof Error ? error.message : "The map could not be loaded");
});

function appendError(message: string): void {
  const note = document.createElement("p");
  note.className = "reason";
  note.textContent = message;
  panel.prepend(note);
}
