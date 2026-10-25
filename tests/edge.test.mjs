import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLife, validateLife, step, choose } from "../public/engine.js";
import {
  configureEras,
  remember,
  transact,
  netWorth,
} from "../public/systems.js";
import { validOwners, readOwners, mergeOwners } from "../public/ownership.js";
const countries = JSON.parse(
  readFileSync(new URL("../public/data/countries.json", import.meta.url)),
).countries;
configureEras(
  JSON.parse(
    readFileSync(new URL("../public/data/eras.json", import.meta.url)),
  ),
);
const fresh = () => createLife(countries, { seed: 9 });
test("observed lifetime pace settings retain compatibility with older saves", () => {
  assert.equal(fresh().duration, 60);
  for (const duration of [5, 15, 30, 60, 90]) {
    const s = createLife(countries, { seed: 9, duration });
    assert.equal(s.duration, duration);
    assert.ok(validateLife(s, countries));
  }
});
test("imports reject missing financial fields and impossible decision states", () => {
  for (const mutate of [
    (s) => delete s.deep.assets.bonds,
    (s) => delete s.deep.assets.mortgage,
    (s) => delete s.deep.career.level,
    (s) => delete s.deep.career.experience,
    (s) => (s.deep.career.level = 7),
    (s) => (s.deep.annual.age = 0.5),
    (s) => {
      s.stage = "living";
      s.pending = "scene";
    },
    (s) => {
      s.stage = "living";
      s.pending = "scene";
      delete s.deep;
    },
    (s) => {
      s.stage = "living";
      s.pending = "scene";
      s.deep.pendingScene = 21;
    },
    (s) => (s.deep.pendingScene = 21),
    (s) => (s.deep.reflection = 5),
    (s) => {
      s.deep.world = "past";
      s.year = 1987;
    },
    (s) => (s.events[0].age = 10),
    (s) => (s.year = 2026.5),
    (s) => delete s.createdAt,
  ]) {
    const s = fresh();
    mutate(s);
    assert.equal(validateLife(s, countries), false);
  }
});
test("thousands of trades remain reloadable and preserve notable records", () => {
  const s = fresh();
  s.stage = "living";
  while (s.age < 24 || s.pending || s.deep.reflection !== null) {
    if (s.pending) choose(s, 1, countries);
    else if (s.deep.reflection !== null) remember(s, "");
    else step(s, countries);
  }
  s.money = 50000;
  const initial = netWorth(s),
    notable = s.events.filter((e) => e.type === "decision").map((e) => e.id);
  s.events[1].star = true;
  const star = s.events[1].id;
  for (let i = 0; i < 2500; i++) {
    assert.ok(transact(s, "stocks", 1, countries).ok);
    assert.ok(transact(s, "sell-stocks", 1, countries).ok);
  }
  assert.equal(netWorth(s), initial);
  assert.equal(s.events.length, 2000);
  assert.equal(new Set(s.events.map((e) => e.id)).size, s.events.length);
  assert.ok(notable.every((id) => s.events.some((e) => e.id === id)));
  assert.ok(s.events.some((e) => e.id === star && e.star));
  assert.ok(validateLife(JSON.parse(JSON.stringify(s)), countries));
  step(s, countries);
  assert.ok(validateLife(s, countries));
});
test("memorial ownership moves with a private archive and preserves existing keys", () => {
  const key = "a".repeat(24),
    token = "b".repeat(64),
    other = "c".repeat(24),
    otherToken = "d".repeat(64);
  const data = new Map();
  const storage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  };
  mergeOwners({ [key]: token }, storage);
  const archive = JSON.parse(
    JSON.stringify({ memorialOwners: readOwners(storage) }),
  );
  mergeOwners({ [other]: otherToken }, storage);
  mergeOwners(archive.memorialOwners, storage);
  assert.deepEqual(readOwners(storage), { [key]: token, [other]: otherToken });
  for (const invalid of [
    null,
    [],
    "bad",
    { [key]: 42 },
    { [key]: "bad" },
    { bad: token },
  ]) {
    assert.equal(validOwners(invalid), false);
    assert.throws(() => mergeOwners(invalid, storage));
  }
  assert.equal(readOwners(storage)[key], token);
  mergeOwners(undefined, storage); // Older archives have no credentials field.
  storage.setItem("birth.memorialOwners", '"corrupt"');
  assert.deepEqual(readOwners(storage), {});
});
