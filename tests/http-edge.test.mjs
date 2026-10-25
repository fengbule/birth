import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";
test("HTTP input limits, malformed requests, SQL text and concurrent candles are handled", async () => {
  const app = createApp({ dbPath: ":memory:" });
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${app.address().port}`;
  const post = (body, headers = {}) =>
    fetch(base + "/api/memorials", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body,
    });
  try {
    for (const body of ["null", "[]", '"text"', "{broken"])
      assert.equal((await post(body)).status, 400);
    assert.equal(
      (await post("{}", { "Content-Type": "text/plain" })).status,
      415,
    );
    assert.equal((await post("{}", { Origin: "null" })).status, 403);
    assert.equal(
      (await post(JSON.stringify({ name: "x".repeat(20000) }))).status,
      413,
    );
    assert.equal(
      (await fetch(base + "/api/memorials?country=CHN%27OR%201=1")).status,
      400,
    );
    assert.equal(
      (await fetch(base + "/api/memorials?before=invalid")).status,
      400,
    );
    assert.equal((await fetch(base + "/%2e%2e%2fpackage.json")).status, 403);
    assert.equal((await fetch(base + "/missing-file.js")).status, 404);
    const fixture = {
      name: '<img src=x onerror="alert(1)">',
      country: "CHN",
      year: 2026,
      age: 80,
      summary: "测试",
      note: "'; DROP TABLE memorials; --",
      moments: [],
    };
    const result = await post(JSON.stringify(fixture));
    assert.equal(result.status, 201);
    const owner = await result.json();
    const candle = () =>
      fetch(base + "/api/memorials/" + owner.id + "/candle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "birth_visitor=" + "f".repeat(48),
          "X-Forwarded-Proto": "https",
        },
        body: "{}",
      }).then((r) => r.json());
    const results = await Promise.all(Array.from({ length: 12 }, candle));
    assert.equal(results.filter((r) => r.added).length, 1);
    const publicRecord = await fetch(base + "/api/memorials/" + owner.id).then(
      (r) => r.json(),
    );
    assert.equal(publicRecord.name, fixture.name);
    assert.equal(publicRecord.note, fixture.note);
    assert.equal(publicRecord.candles, 1);
    assert.equal(
      (await fetch(base + "/api/memorials").then((r) => r.json())).total,
      1,
    );
    assert.equal(
      (
        await fetch(base + "/api/memorials/" + owner.id, {
          method: "DELETE",
          headers: { Authorization: "Bearer " + owner.ownerToken },
        })
      ).status,
      200,
    );
  } finally {
    await new Promise((r) => app.close(r));
  }
});
