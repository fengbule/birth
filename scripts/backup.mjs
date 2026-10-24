import { createMemorialAPI } from "../lib/memorials.mjs";
import path from "node:path";
const target = process.argv[2];
if (!target) throw Error("Pass an absolute backup destination.");
const api = createMemorialAPI(
  path.resolve(process.env.DATA_DIR || "data", "birth.sqlite"),
);
try {
  api.backup(target);
  console.log("SQLite backup complete.");
} finally {
  api.close();
}
