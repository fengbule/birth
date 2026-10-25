import { DatabaseSync } from "node:sqlite";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
const hash = (s) => createHash("sha256").update(s).digest("hex");
export function createMemorialAPI(filename) {
  if (filename !== ":memory:")
    mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS memorials(id TEXT PRIMARY KEY, owner_hash TEXT NOT NULL, name TEXT NOT NULL, country TEXT NOT NULL, birth_year INTEGER NOT NULL, age INTEGER NOT NULL, summary TEXT NOT NULL, note TEXT NOT NULL, moments TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS candles(memorial_id TEXT REFERENCES memorials(id) ON DELETE CASCADE, visitor TEXT, day TEXT, PRIMARY KEY(memorial_id,visitor,day));
    CREATE TABLE IF NOT EXISTS comments(id TEXT PRIMARY KEY,memorial_id TEXT REFERENCES memorials(id) ON DELETE CASCADE,text TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS comments_memorial ON comments(memorial_id);
  `);
  const limit = new Map();
  const text = (x, max) =>
    typeof x === "string" && x.trim().length > 0 && x.length <= max;
  const serialize = (row) => {
    if (!row) return null;
    const { owner_hash, ...m } = row;
    return {
      ...m,
      moments: JSON.parse(m.moments),
      candles: db
        .prepare("SELECT count(*) AS n FROM candles WHERE memorial_id=?")
        .get(m.id).n,
      comments: db
        .prepare("SELECT count(*) AS n FROM comments WHERE memorial_id=?")
        .get(m.id).n,
    };
  };
  function allowed(req, scope, max = 20) {
    const ip =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "local",
      key = hash(ip) + "|" + scope,
      now = Date.now();
    let v = limit.get(key);
    if (!v || now > v.until) {
      v = { n: 0, until: now + 3600000 };
      limit.set(key, v);
    }
    if (limit.size > 10000)
      for (const [k, x] of limit) if (x.until < now) limit.delete(k);
    return ++v.n <= max;
  }
  async function handler(req, res, url) {
    const send = (status, data) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(data));
    };
    const fail = (status, message) => send(status, { error: message });
    if (url.pathname === "/api/health") {
      send(200, { ok: true, storage: "sqlite", version: 2 });
      return;
    }
    if (
      url.pathname !== "/api/memorials" &&
      !url.pathname.startsWith("/api/memorials/")
    ) {
      fail(404, "未找到这个接口。");
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      const origin = req.headers.origin,
        host = req.headers["x-forwarded-host"] || req.headers.host;
      if (origin) {
        let match = false;
        try {
          match = new URL(origin).host === host;
        } catch {}
        if (!match) {
          fail(403, "只能从本站提交。");
          return;
        }
      }
      if (
        req.method !== "DELETE" &&
        !req.headers["content-type"]?.startsWith("application/json")
      ) {
        fail(415, "需要 JSON 内容。");
        return;
      }
      if (!allowed(req, "writes", 80)) {
        fail(429, "操作太频繁，请稍后再试。");
        return;
      }
    }
    const parts = url.pathname.split("/").filter(Boolean),
      id = parts[2],
      action = parts[3];
    if (parts.length > 4 || (id && !/^[a-f0-9]{24}$/.test(id))) {
      fail(404, "没有找到这个纪念。");
      return;
    }
    if (req.method === "GET" && !id) {
      const country = url.searchParams.get("country"),
        cursor = url.searchParams.get("before");
      const clauses = [],
        args = [];
      if (country) {
        if (!/^[A-Z]{3}$/.test(country)) {
          fail(400, "地区格式无效。");
          return;
        }
        clauses.push("country=?");
        args.push(country);
      }
      if (cursor) {
        if (!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\|[a-f0-9]{24}$/.test(cursor)) {
          fail(400, "分页位置无效。");
          return;
        }
        const [time, key] = cursor.split("|");
        clauses.push("(created_at < ? OR (created_at = ? AND id < ?))");
        args.push(time, time, key);
      }
      const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "",
        random = url.searchParams.get("random") === "1";
      const rows = db
        .prepare(
          `SELECT * FROM memorials ${where} ORDER BY ${random ? "random()" : "created_at DESC,id DESC"} LIMIT ${random ? 1 : 21}`,
        )
        .all(...args);
      const hasMore = rows.length > 20,
        items = rows.slice(0, 20).map(serialize);
      send(200, {
        items,
        next: hasMore ? items.at(-1).created_at + "|" + items.at(-1).id : null,
        total: db.prepare("SELECT count(*) AS n FROM memorials").get().n,
      });
      return;
    }
    const row = id
      ? db.prepare("SELECT * FROM memorials WHERE id=?").get(id)
      : null;
    if (id && !row) {
      fail(404, "这个纪念已经离开了这里。");
      return;
    }
    if (req.method === "GET" && id && !action) {
      send(200, {
        ...serialize(row),
        messages: db
          .prepare(
            "SELECT id,text,created_at FROM comments WHERE memorial_id=? ORDER BY created_at DESC LIMIT 30",
          )
          .all(id),
      });
      return;
    }
    if (req.method === "DELETE" && id && !action) {
      const token = req.headers.authorization?.replace(/^Bearer /, "") || "",
        candidate = hash(token);
      if (
        candidate.length !== row.owner_hash.length ||
        !timingSafeEqual(Buffer.from(candidate), Buffer.from(row.owner_hash))
      ) {
        fail(403, "需要发布时的管理凭证。");
        return;
      }
      db.prepare("DELETE FROM memorials WHERE id=?").run(id);
      send(200, { ok: true });
      return;
    }
    if (req.method !== "POST") {
      fail(405, "不支持这个操作。");
      return;
    }
    let size = 0,
      chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 16384) {
        fail(413, "内容太长。");
        return;
      }
      chunks.push(chunk);
    }
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks));
    } catch {
      fail(400, "内容格式不正确。");
      return;
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      fail(400, "内容格式不正确。");
      return;
    }
    if (!id) {
      if (!allowed(req, "publish", 10)) {
        fail(429, "这一小时已经留下很多故事，请稍后再来。");
        return;
      }
      if (
        !text(body.name, 80) ||
        !text(body.country, 3) ||
        !/^[A-Z]{3}$/.test(body.country) ||
        !Number.isInteger(body.year) ||
        body.year < 1900 ||
        body.year > 2100 ||
        !Number.isInteger(body.age) ||
        body.age < 0 ||
        body.age > 110 ||
        !text(body.summary, 600) ||
        typeof body.note !== "string" ||
        body.note.length > 500 ||
        !Array.isArray(body.moments) ||
        body.moments.length > 5 ||
        !body.moments.every(
          (m) =>
            m &&
            Number.isInteger(m.age) &&
            m.age >= 0 &&
            m.age <= body.age &&
            text(m.title, 180),
        )
      ) {
        fail(400, "人生摘要包含无效内容。");
        return;
      }
      if (db.prepare("SELECT count(*) AS n FROM memorials").get().n >= 10000) {
        fail(503, "纪念馆暂时已满。");
        return;
      }
      const newId = randomBytes(12).toString("hex"),
        token = randomBytes(32).toString("hex");
      db.prepare("INSERT INTO memorials VALUES (?,?,?,?,?,?,?,?,?,?)").run(
        newId,
        hash(token),
        body.name.trim(),
        body.country,
        body.year,
        body.age,
        body.summary.trim(),
        body.note.trim(),
        JSON.stringify(body.moments),
        new Date().toISOString(),
      );
      send(201, { id: newId, ownerToken: token });
      return;
    }
    if (action === "candle") {
      let visitor = req.headers.cookie?.match(
        /(?:^|;\s*)birth_visitor=([a-f0-9]{48})(?:;|$)/,
      )?.[1];
      if (!visitor) {
        visitor = randomBytes(24).toString("hex");
        const secure =
          req.headers["x-forwarded-proto"] === "https" || req.socket.encrypted;
        res.setHeader(
          "Set-Cookie",
          `birth_visitor=${visitor}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=31536000${secure ? "; Secure" : ""}`,
        );
      }
      const result = db
        .prepare("INSERT OR IGNORE INTO candles VALUES (?,?,?)")
        .run(id, hash(visitor), new Date().toISOString().slice(0, 10));
      send(200, {
        ok: true,
        added: result.changes > 0,
        candles: serialize(row).candles,
      });
      return;
    }
    if (action === "comments") {
      if (!text(body.text, 160)) {
        fail(400, "请留下一句 160 字以内的话。");
        return;
      }
      if (!allowed(req, "comments", 8)) {
        fail(429, "请留一些空间，让其他人也说说话。");
        return;
      }
      if (
        db
          .prepare("SELECT count(*) AS n FROM comments WHERE memorial_id=?")
          .get(id).n >= 200
      ) {
        fail(409, "这段人生已经收到很多留言。");
        return;
      }
      db.prepare("INSERT INTO comments VALUES (?,?,?,?)").run(
        randomBytes(12).toString("hex"),
        id,
        body.text.trim(),
        new Date().toISOString(),
      );
      send(201, { ok: true });
      return;
    }
    fail(404, "未找到这个操作。");
  }
  return {
    handler,
    close: () => db.close(),
    backup: (target) => {
      const dest = path.resolve(target).replaceAll("'", "''");
      db.exec(`VACUUM INTO '${dest}'`);
    },
  };
}
