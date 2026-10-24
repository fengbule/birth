// Historical slices are downloaded only by maintainers, never by visitors.
import { readFile, writeFile } from "node:fs/promises";
const { countries } = JSON.parse(
  await readFile("public/data/countries.json", "utf8"),
);
const ids = new Set(countries.map((c) => c.id));
const eras = {};
for (const year of [1970, 1990, 2010]) {
  const url = `https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL;SP.DYN.CBRT.IN;SP.DYN.LE00.IN;NY.GDP.PCAP.PP.CD?source=2&format=json&date=${year}&per_page=4000`;
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw Error(`World Bank HTTP ${response.status}`);
  const [meta, rows] = await response.json();
  if (meta.pages !== 1) throw Error("Inspect API pagination before updating.");
  const fields = {
    "SP.POP.TOTL": "population",
    "SP.DYN.CBRT.IN": "birthRate",
    "SP.DYN.LE00.IN": "life",
    "NY.GDP.PCAP.PP.CD": "gdp",
  };
  const values = {};
  for (const row of rows) {
    if (!ids.has(row.countryiso3code)) continue;
    (values[row.countryiso3code] ||= {})[fields[row.indicator.id]] = row.value;
  }
  eras[year] = Object.fromEntries(
    Object.entries(values).filter(
      ([, s]) => s.population > 0 && s.birthRate > 0 && s.life > 0,
    ),
  );
  if (Object.keys(eras[year]).length < 180)
    throw Error(`Insufficient ${year} coverage. Existing data kept.`);
}
await writeFile(
  "public/data/eras.json",
  JSON.stringify({
    source: "World Bank WDI",
    fetched: new Date().toISOString().slice(0, 10),
    eras,
  }),
);
console.log(
  Object.fromEntries(
    Object.entries(eras).map(([y, v]) => [y, Object.keys(v).length]),
  ),
);
