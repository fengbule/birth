import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createApp } from "../server.mjs";
import { DatabaseSync } from "node:sqlite";
import { createMemorialAPI } from "../lib/memorials.mjs";
const fixture = {
  name: "测试角色",
  country: "CHN",
  year: 2026,
  age: 80,
  summary: "一段测试人生。",
  note: "谢谢那些普通的日子。",
  moments: [{ age: 18, title: "新的起点" }],
};
test("public memorial lifecycle persists and enforces ownership and candle uniqueness", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "birth-api-")),
    dbPath = path.join(dir, "test.sqlite");
  let app = createApp({ dbPath });
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  let base = `http://127.0.0.1:${app.address().port}`;
  const post = (url, body, headers = {}) =>
    fetch(base + url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  try {
    let r = await post("/api/memorials", fixture, {
      Origin: "https://evil.example",
    });
    assert.equal(r.status, 403);
    r = await post(
      "/api/memorials",
      {},
      {
        Origin: "https://birth.example",
        "X-Forwarded-Host": "birth.example",
      },
    );
    assert.equal(r.status, 400); // Accepted origin, rejected payload.
    r = await post(
      "/api/memorials",
      {},
      {
        Origin: "https://evil.example",
        "X-Forwarded-Host": "birth.example",
      },
    );
    assert.equal(r.status, 403);
    r = await post("/api/memorials", { ...fixture, age: -1 });
    assert.equal(r.status, 400);
    r = await post("/api/memorials", {
      ...fixture,
      age: 5,
      moments: [{ age: 18, title: "不可能的未来记录" }],
    });
    assert.equal(r.status, 400);
    r = await post("/api/memorials", fixture);
    assert.equal(r.status, 201);
    const { id, ownerToken } = await r.json();
    const listed = await fetch(base + "/api/memorials").then((r) => r.json());
    assert.equal(listed.total, 1);
    assert.equal(listed.items[0].owner_hash, undefined);
    assert.equal(listed.items[0].ownerToken, undefined);
    r = await post("/api/memorials/" + id + "/candle", {});
    const cookie = r.headers.get("set-cookie").split(";")[0];
    assert.equal((await r.json()).candles, 1);
    r = await post("/api/memorials/" + id + "/candle", {}, { Cookie: cookie });
    assert.equal((await r.json()).added, false);
    r = await post("/api/memorials/" + id + "/comments", {
      text: "愿每一种人生都被看见。",
    });
    assert.equal(r.status, 201);
    await new Promise((r) => app.close(r));
    app = createApp({ dbPath });
    await new Promise((r) => app.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${app.address().port}`;
    const memory = await fetch(base + "/api/memorials/" + id).then((r) =>
      r.json(),
    );
    assert.equal(memory.candles, 1);
    assert.equal(memory.messages[0].text, "愿每一种人生都被看见。");
    r = await fetch(base + "/api/memorials/" + id, {
      method: "DELETE",
      headers: { Authorization: "Bearer wrong" },
    });
    assert.equal(r.status, 403);
    r = await fetch(base + "/api/memorials/" + id, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + ownerToken },
    });
    assert.equal(r.status, 200);
    assert.equal((await fetch(base + "/api/memorials/" + id)).status, 404);
    assert.equal(
      (await fetch(base + "/api/memorials").then((r) => r.json())).total,
      0,
    );
  } finally {
    await new Promise((r) => app.close(r));
    await rm(dir, { recursive: true, force: true });
  }
});

test("pagination retains simultaneous publications and SQLite backups are consistent", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "birth-pages-"));
  const dbPath = path.join(dir, "test.sqlite");
  const api = createMemorialAPI(dbPath);
  const db = new DatabaseSync(dbPath);
  const insert = db.prepare(
    "INSERT INTO memorials VALUES (?,?,?,?,?,?,?,?,?,?)",
  );
  for (let i = 0; i < 25; i++)
    insert.run(
      i.toString(16).padStart(24, "0"),
      "owner-hash",
      "角色 " + i,
      "CHN",
      2026,
      80,
      "测试",
      "",
      "[]",
      "2026-10-25T00:00:00.000Z",
    );
  const app = createApp({ dbPath });
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${app.address().port}/api/memorials`;
  try {
    const first = await fetch(base).then((r) => r.json());
    const second = await fetch(
      base + "?before=" + encodeURIComponent(first.next),
    ).then((r) => r.json());
    assert.equal(first.items.length, 20);
    assert.equal(second.items.length, 5);
    assert.equal(second.next, null);
    assert.equal(
      new Set([...first.items, ...second.items].map((x) => x.id)).size,
      25,
    );
    const dest = path.join(dir, "backup.sqlite");
    api.backup(dest);
    const copy = new DatabaseSync(dest, { readOnly: true });
    assert.equal(
      copy.prepare("PRAGMA integrity_check").get().integrity_check,
      "ok",
    );
    assert.equal(
      copy.prepare("SELECT count(*) AS n FROM memorials").get().n,
      25,
    );
    copy.close();
  } finally {
    await new Promise((r) => app.close(r));
    db.close();
    api.close();
    await rm(dir, { recursive: true, force: true });
  }
});
