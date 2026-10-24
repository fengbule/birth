import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMemorialAPI } from "./lib/memorials.mjs";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};
export function createApp({
  dbPath = path.resolve(process.env.DATA_DIR || "data", "birth.sqlite"),
  staticRoot = process.env.STATIC_ROOT ||
    fileURLToPath(new URL("./public/", import.meta.url)),
} = {}) {
  const root = path.resolve(staticRoot),
    api = createMemorialAPI(dbPath);
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost"),
        pathname = decodeURIComponent(url.pathname);
      if (pathname.startsWith("/api/")) {
        await api.handler(req, res, url);
        return;
      }
      if (pathname === "/healthz") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ok");
        return;
      }
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        res.end();
        return;
      }
      const file = path.resolve(
        root,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      let info;
      try {
        info = await stat(file);
      } catch {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      if (!info.isFile()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const content = await readFile(file);
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Cache-Control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch (e) {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "服务暂时无法完成这个请求。" }));
      } else res.end();
    }
  });
  server.on("close", api.close);
  return server;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const server = createApp();
  server.listen(
    Number(process.env.PORT) || 4173,
    process.env.HOST || "127.0.0.1",
    () =>
      console.log(
        `Local: http://${process.env.HOST || "127.0.0.1"}:${server.address().port}`,
      ),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => server.close(() => process.exit(0)));
}
