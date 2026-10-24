import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
const digest = createHash("sha256");
async function walk(dir) {
  for (const f of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const p = dir + "/" + f.name;
    if (f.isDirectory()) await walk(p);
    else {
      digest.update(p);
      digest.update(await readFile(p));
    }
  }
}
await walk("public");
await writeFile(
  "dist/version.json",
  JSON.stringify({
    version: JSON.parse(await readFile("package.json", "utf8")).version,
    sha256: digest.digest("hex"),
  }),
);
console.log("Static build ready in dist/");
