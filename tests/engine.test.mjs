import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createLife,
  step,
  choose,
  decisions,
  validateLife,
  weightedCountry,
  random,
  annualIncome,
  pendingDecision,
} from "../public/engine.js";
const { countries } = JSON.parse(
  await readFile(new URL("../public/data/countries.json", import.meta.url)),
);
test("data includes only valid economies and probability inputs", () => {
  assert.ok(countries.length > 200);
  assert.equal(new Set(countries.map((c) => c.id)).size, countries.length);
  for (const c of countries) {
    assert.ok(c.population > 0 && c.birthRate > 0 && c.life > 0);
    assert.ok(c.lat >= -90 && c.lat <= 90 && c.lon >= -180 && c.lon <= 180);
  }
  assert.ok(
    !countries.some((c) => ["WLD", "HIC", "LIC", "EAS"].includes(c.id)),
  );
});
test("same birth seed, mode, and settings reproduce every initial field", () => {
  const options = { seed: 81923, createdAt: 123456789, year: 2026 };
  assert.deepEqual(
    createLife(countries, options),
    createLife(countries, options),
  );
});
test("birth and population sampling use their respective weights", () => {
  const sample = [
    { id: "A", population: 100, birthRate: 10 },
    { id: "B", population: 100, birthRate: 30 },
  ];
  for (const [mode, expected] of [
    ["births", 0.25],
    ["population", 0.5],
  ]) {
    const s = { rng: 9292 };
    let a = 0;
    for (let i = 0; i < 50000; i++)
      a += weightedCountry(sample, mode, s).id === "A";
    assert.ok(Math.abs(a / 50000 - expected) < 0.01);
  }
});
test("a pending decision freezes time, each decision can resolve only once", () => {
  const s = createLife(countries, { seed: 22 });
  s.stage = "living";
  while (!s.pending) step(s, countries);
  assert.equal(s.pending, 2);
  const rng = s.rng;
  step(s, countries);
  assert.equal(s.age, 2);
  assert.equal(s.rng, rng);
  assert.equal(choose(s, 0, countries), true);
  assert.equal(choose(s, 0, countries), false);
  step(s, countries);
  assert.equal(s.age, 3);
});
test("1000 complete lives preserve invariants and terminate without deadlocks", () => {
  for (let seed = 1; seed <= 1000; seed++) {
    const s = createLife(countries, { seed, gentle: seed % 2 === 0 });
    s.stage = "living";
    let loops = 0;
    while (s.stage === "living" && loops++ < 150) {
      if (s.pending) choose(s, Math.floor(random(s) * pendingDecision(s,countries).choices.length), countries);
      else step(s, countries);
      assert.ok(
        validateLife(s, countries),
        `invalid state, seed ${seed}, age ${s.age}`,
      );
    }
    assert.equal(s.stage, "ended");
    assert.ok(s.age >= 0 && s.age <= 110);
    assert.equal(s.events.at(-1).type, "end");
    assert.equal(s.pending, null);
    const copy = structuredClone(s);
    step(s, countries);
    assert.deepEqual(s, copy);
  }
});
test("malformed imports cannot enter the simulation", () => {
  const good = createLife(countries, { seed: 8 });
  assert.ok(validateLife(good, countries));
  for (const patch of [
    { age: Infinity },
    { country: "WLD" },
    { name: {} },
    { money: NaN },
    { pending: 18 },
    { events: [{ title: "bad" }] },
    { peers: [] },
    { duration: 999 },
    { health: 999 },
  ])
    assert.equal(validateLife({ ...good, ...patch }, countries), false);
});
test("spending, education, and retirement change the economic model", () => {
  const s = createLife(countries, { seed: 5 }),
    c = countries.find((c) => c.id === s.country);
  s.stage = "living";
  s.age = 23;
  s.education = "基础教育";
  const basic = annualIncome(s, c);
  s.education = "大学毕业";
  assert.ok(annualIncome(s, c) > basic);
  s.retired = true;
  assert.ok(annualIncome(s, c) < basic);
  s.education = "大学在读";
  assert.equal(annualIncome(s, c), 0);
  s.education = "基础教育";
  s.retired = false;
  s.age = 32;
  s.pending = 32;
  s.money = 1e7;
  choose(s, 0, countries);
  assert.ok(s.money < 1e7);
  assert.equal(s.housing, "按揭中的家");
});
test("each milestone resolves every offered option exactly once", () => {
  for (const d of decisions)
    for (let i = 0; i < d.choices.length; i++) {
      const s = createLife(countries, { seed: 99 });
      s.stage = "living";
      s.age = d.age;
      s.pending = d.age;
      assert.equal(choose(s, i, countries), true);
      assert.equal(s.pending, null);
      assert.ok(validateLife(s, countries));
      assert.equal(s.events.at(-1).type, "decision");
    }
});
