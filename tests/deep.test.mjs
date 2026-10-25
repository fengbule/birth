import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createLife, step, choose, validateLife } from "../public/engine.js";
import {
  configureEras,
  initSystems,
  performAction,
  transact,
  migrate,
  netWorth,
  remember,
  livingCountry,
  worldCountries,
} from "../public/systems.js";
const { countries } = JSON.parse(
  await readFile(new URL("../public/data/countries.json", import.meta.url)),
);
configureEras(
  JSON.parse(
    await readFile(new URL("../public/data/eras.json", import.meta.url)),
  ),
);
const adult = () => {
  const s = createLife(countries, { seed: 88 });
  s.stage = "living";
  s.age = 28;
  s.money = 1000000;
  s.knowledge = 60;
  return s;
};
test("historical worlds use observed data and future scenario stays explicit", () => {
  for (const year of [1970, 1990, 2010]) {
    const pool = worldCountries(countries, "past", year);
    assert.ok(pool.length > 180);
    const s = createLife(countries, { seed: 42, world: "past", year });
    assert.equal(s.deep.world, "past");
    assert.equal(
      livingCountry(s, countries).life,
      pool.find((c) => c.id === s.country).life,
    );
    assert.ok(validateLife(s, countries));
  }
  const today = worldCountries(countries),
    future = worldCountries(countries, "future");
  assert.equal(today.length, future.length);
  assert.ok(future[0].life >= today[0].life);
});
test("old version 1 saves acquire new systems without losing identity or RNG", () => {
  const s = adult();
  delete s.deep;
  const { seed, rng, name, country, events } = structuredClone(s);
  initSystems(s);
  assert.deepEqual(
    {
      seed: s.seed,
      rng: s.rng,
      name: s.name,
      country: s.country,
      events: s.events,
    },
    { seed, rng, name, country, events },
  );
  assert.ok(validateLife(s, countries));
});
test("annual activities have a shared limit and cannot be repeated", () => {
  const s = adult();
  assert.ok(performAction(s, "exercise", countries).ok);
  assert.equal(performAction(s, "exercise", countries).ok, false);
  assert.ok(performAction(s, "learn", countries).ok);
  assert.ok(performAction(s, "friend", countries).ok);
  assert.equal(performAction(s, "travel", countries).ok, false);
  step(s, countries);
  if (s.pending) choose(s, 1, countries);
  assert.equal(s.deep.annual.actions.length, 0);
});
test("investing and redeeming conserve net worth until simulated returns occur", () => {
  const s = adult(),
    initial = netWorth(s);
  assert.ok(transact(s, "stocks", 10000, countries).ok);
  assert.equal(netWorth(s), initial);
  assert.ok(transact(s, "sell-stocks", 4000, countries).ok);
  assert.equal(netWorth(s), initial);
  assert.equal(transact(s, "stocks", 1e9, countries).ok, false);
  assert.equal(transact(s, "sell-bonds", 1, countries).ok, false);
  assert.equal(transact(s, "stocks", NaN, countries).ok, false);
  step(s, countries);
  assert.ok(Number.isFinite(netWorth(s)));
  assert.notEqual(s.deep.assets.stocks, 6000);
});
test("migration changes residence, preserves birthplace, charges once per year", () => {
  const s = adult(),
    birthplace = s.country,
    target = countries.find((c) => c.id !== birthplace),
    before = s.money;
  assert.ok(migrate(s, target.id, countries).ok);
  assert.equal(s.country, birthplace);
  assert.equal(s.deep.residence, target.id);
  assert.ok(s.money < before);
  assert.equal(livingCountry(s, countries).id, target.id);
  assert.equal(migrate(s, birthplace, countries).ok, false);
  assert.ok(validateLife(s, countries));
});
test("reflection freezes the year until explicitly answered or skipped", () => {
  const s = createLife(countries, { seed: 9, reflections: true });
  s.stage = "living";
  while (s.age < 5) {
    if (s.pending) choose(s,0,countries);
    else step(s,countries);
  }
  assert.equal(s.deep.reflection, 5);
  step(s, countries);
  assert.equal(s.age, 5);
  remember(s, "愿你被温柔对待。");
  step(s, countries);
  assert.equal(s.age, 6);
  assert.equal(s.deep.journal[0].text, "愿你被温柔对待。");
});
test("1000 lives with all new choices, actions and reflections complete and validate", () => {
  for (let seed = 1001; seed <= 2000; seed++) {
    const s = createLife(countries, {
      seed,
      reflections: true,
      world: seed % 2 ? "past" : "today",
      year: seed % 2 ? 1990 : 2026,
    });
    s.stage = "living";
    let n = 0;
    while (s.stage === "living" && n++ < 190) {
      if (s.deep.reflection !== null) remember(s, "记得生活。");
      else if (s.pending) choose(s, seed % 3, countries);
      else {
        if (s.age >= 18 && s.money > 5000) transact(s, "bonds", 100, countries);
        performAction(s, "parents", countries);
        step(s, countries);
      }
      assert.ok(validateLife(s, countries), `seed=${seed}, age=${s.age}`);
    }
    assert.equal(s.stage, "ended", `seed=${seed}`);
  }
});
test("malformed extension fields are rejected before import", () => {
  const s = adult();
  for (const edit of [
    (d) => (d.assets.stocks = -1),
    (d) => (d.residence = "WLD"),
    (d) => (d.journal = [{ age: 5, text: 123 }]),
    (d) => (d.children = [{ name: {}, bornAge: 0, bond: 40, education: 0 }]),
    (d) => (d.annual.actions = Array(4).fill("exercise")),
  ]) {
    const bad = structuredClone(s);
    edit(bad.deep);
    assert.equal(validateLife(bad, countries), false);
  }
});
