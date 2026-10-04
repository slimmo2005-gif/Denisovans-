import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const source =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";
const keep = new Set(["Africa", "Europe", "Asia", "Oceania"]);

const response = await fetch(source);
if (!response.ok) {
  throw new Error(`Could not download Natural Earth (${response.status})`);
}
const world = await response.json();

const isIso = (value) => typeof value === "string" && /^[A-Z]{2}$/.test(value);
const claimed = new Set(world.features.map((feature) => feature.properties?.ISO_A2).filter(isIso));

const features = world.features
  .filter((feature) => keep.has(feature.properties?.CONTINENT))
  .map((feature) => {
    const primary = feature.properties.ISO_A2;
    const fallback = feature.properties.ISO_A2_EH;
    let iso = "";
    if (isIso(primary)) iso = primary;
    else if (isIso(fallback) && !claimed.has(fallback)) iso = fallback;
    return {
      type: "Feature",
      properties: {
        iso,
        name: feature.properties.NAME ?? feature.properties.ADMIN ?? "Unnamed",
        continent: feature.properties.CONTINENT,
      },
      geometry: feature.geometry,
    };
  });

const collection = { type: "FeatureCollection", features };
const target = resolve("public/geo/old-world.geojson");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, JSON.stringify(collection));
console.log(`Wrote ${features.length} countries to ${target}`);
