import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLife, step, choose, validateLife, pendingDecision, decisions } from "../public/engine.js";
import { consume, consumptionOptions } from "../public/life-events.js";
import {
  configureEras,
  remember,
  actionList,
  performAction,
  transact,
  migrate,
  worldCountries,
} from "../public/systems.js";
const countries = JSON.parse(
  readFileSync(new URL("../public/data/countries.json", import.meta.url)),
).countries;
configureEras(
  JSON.parse(
    readFileSync(new URL("../public/data/eras.json", import.meta.url)),
  ),
);
test("5000 mixed-world lives survive variable choices, credit, queued offers, investments and reloads", () => {
  const worlds = [
    { world: "today", year: 2026 },
    ...[1970, 1990, 2010].map((year) => ({ world: "past", year })),
    { world: "future", year: 2050 },
  ];
  let visited = new Set(),
    choices = new Set(),
    moves = 0,
    actions = 0,
    ends = 0;
  for (let seed = 20001; seed <= 25000; seed++) {
    const fixedCountry = seed - 20001 < countries.length;
    const setting = fixedCountry ? worlds[0] : worlds[seed % worlds.length];
    const pool = worldCountries(countries, setting.world, setting.year);
    let s = createLife(fixedCountry ? [countries[seed - 20001]] : countries, {
      seed,
      createdAt: 1000 + seed,
      mode: seed % 2 ? "births" : "population",
      reflections: true,
      gentle: seed % 3 !== 0,
      ...setting,
    });
    visited.add(s.country);
    s.stage = "living";
    let n = 0,
      control = seed >>> 0;
    const draw = () => {
      control = (Math.imul(control, 1664525) + 1013904223) >>> 0;
      return control / 2 ** 32;
    };
    while (s.stage === "living" && n++ < 200) {
      if (s.deep.reflection !== null)
        remember(s, draw() < 0.5 ? "" : "保留这一刻。");
      else if (s.pending) {
        const enabled=pendingDecision(s,countries).choices.map((c,i)=>c.disabled?null:i).filter(i=>i!==null);
        const choice = enabled[Math.floor(draw() * enabled.length)];
        choices.add(
          `${pendingDecision(s,countries).id || (s.pending === "scene" ? s.deep.pendingScene : s.pending)}:${choice}`,
        );
        assert.ok(choose(s, choice, countries));
      } else {
        s.focus = ["balanced", "health", "study", "work", "rest", "connection"][
          Math.floor(draw() * 6)
        ];
        const available = actionList(s, countries);
        const spending = consumptionOptions(s,countries).filter(i=>!i.disabled);
        if(spending.length&&draw()<.2)consume(s,spending[Math.floor(draw()*spending.length)].id,countries);
        if (available.length && draw() < 0.65)
          actions += performAction(
            s,
            available[Math.floor(draw() * available.length)].id,
            countries,
          ).ok
            ? 1
            : 0;
        if (s.age >= 18 && s.money > 100 && draw() < 0.35)
          transact(
            s,
            draw() < 0.5 ? "bonds" : "stocks",
            Math.round(s.money * 0.03),
            countries,
          );
        if (s.age >= 18 && s.age <= 75 && draw() < 0.025)
          moves += migrate(
            s,
            pool[Math.floor(draw() * pool.length)].id,
            countries,
          ).ok
            ? 1
            : 0;
        step(s, countries);
      }
      assert.ok(
        validateLife(s, countries),
        `seed ${seed}, age ${s.age}, pending ${s.pending}`,
      );
      if (s.age % 10 === 0) s = JSON.parse(JSON.stringify(s));
    }
    assert.equal(s.stage, "ended", `stuck life ${seed}`);
    ends++;
  }
  for(const [id,count] of [['temperament',4],['hobby',3],['secondary',2],['highschool',3],['major',5],['first-job',5]])
    for(let i=0;i<count;i++)assert.ok(choices.has(`${id}:${i}`),`missing ${id}:${i}`);
  assert.equal(visited.size, countries.length);
  assert.ok(moves > 100);
  assert.ok(actions > 10000);
  console.log(
    JSON.stringify({
      stressLives: ends,
      birthCountries: visited.size,
      coveredChoiceBranches: choices.size,
      successfulMoves: moves,
      successfulActions: actions,
    }),
  );
});
