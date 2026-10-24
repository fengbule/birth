// Run manually to refresh the frozen dataset. Visitors never call external APIs.
import { mkdir, writeFile } from "node:fs/promises";
const year = Number(process.argv[2] || 2023);
if (!Number.isInteger(year) || year < 2000 || year > new Date().getFullYear())
  throw Error("Pass a year between 2000 and the present.");
const get = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw Error(`HTTP ${r.status} from ${url}`);
  return r.json();
};
const [meta, stats, map] = await Promise.all([
  get("https://api.worldbank.org/v2/country?format=json&per_page=400"),
  get(
    `https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL;SP.DYN.CBRT.IN;SP.DYN.LE00.IN;NY.GDP.PCAP.PP.CD?source=2&format=json&date=${year}&per_page=4000`,
  ),
  get(
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson",
  ),
]);
if (meta[0].pages !== 1 || stats[0].pages !== 1)
  throw Error("API pagination changed; inspect before updating.");
const names = new Intl.DisplayNames(["zh-CN"], { type: "region" }),
  values = new Map();
for (const r of stats[1]) {
  if (!values.has(r.countryiso3code)) values.set(r.countryiso3code, {});
  values.get(r.countryiso3code)[r.indicator.id] = r.value;
}
const countries = meta[1]
  .filter((m) => m.region.id !== "NA")
  .map((m) => {
    const s = values.get(m.id) || {};
    return {
      id: m.id,
      code: m.iso2Code,
      name: names.of(m.iso2Code),
      en: m.name,
      region: m.region.value,
      income: m.incomeLevel.id,
      capital: m.capitalCity,
      lat: +m.latitude,
      lon: +m.longitude,
      population: s["SP.POP.TOTL"],
      birthRate: s["SP.DYN.CBRT.IN"],
      life: s["SP.DYN.LE00.IN"],
      gdp: s["NY.GDP.PCAP.PP.CD"],
    };
  })
  .filter((c) => c.population > 0 && c.birthRate > 0 && c.life > 0);
if (countries.length < 180)
  throw Error(
    `Insufficient coverage: ${countries.length}. Existing data kept.`,
  );
const round = (x) =>
  typeof x === "number" ? Math.round(x * 100) / 100 : x.map(round);
const land = map.features.map((f) => ({
  type: f.geometry.type,
  coordinates: round(f.geometry.coordinates),
}));
await mkdir("public/data", { recursive: true });
await writeFile(
  "public/data/countries.json",
  JSON.stringify({
    year,
    source: "World Bank WDI",
    fetched: new Date().toISOString().slice(0, 10),
    countries,
  }),
);
await writeFile("public/data/land.json", JSON.stringify(land));
console.log(
  `${countries.length} economies updated to ${year}. Review data and run npm test && npm run build.`,
);
