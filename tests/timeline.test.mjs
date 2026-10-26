import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLife,step,choose,pendingDecision,validateLife} from '../public/engine.js';
import {advanceClock,visibleRecords,decisionReady,newestFirst} from '../public/timeline-clock.js';
const countries=JSON.parse(readFileSync(new URL('../public/data/countries.json',import.meta.url))).countries;
const fresh=()=>{const s=createLife(countries,{seed:22,reflections:false});s.stage='living';s.deathAge=90;return s;};

test('birth, within-year entries and a choice appear at distinct moments, and survive reload',()=>{
 let s=fresh();assert.equal(visibleRecords(s).length,1);
 advanceClock(s,.23);assert.equal(visibleRecords(s).length,1);
 advanceClock(s,.02);assert.equal(visibleRecords(s).length,2);
 advanceClock(s,.75);step(s,countries);assert.equal(s.age,1);
 assert.equal(visibleRecords(s).filter(e=>e.age===1).length,0);
 advanceClock(s,.03);assert.equal(visibleRecords(s).filter(e=>e.age===1).length,1);
 advanceClock(s,.4);assert.equal(visibleRecords(s).filter(e=>e.age===1).length,2);
 advanceClock(s,.57);step(s,countries);assert.equal(s.age,2);
 advanceClock(s,.39);assert.equal(decisionReady(s),false);
 s=JSON.parse(JSON.stringify(s));assert.ok(validateLife(s,countries));
 advanceClock(s,.02);assert.equal(decisionReady(s),true);
 const fraction=s.clock.fraction;assert.ok(choose(s,0,countries));
 assert.equal(s.clock.fraction,fraction);assert.equal(s.age,2);
 assert.ok(visibleRecords(s).some(e=>e.type==='decision'));
});
test('within-year records stay in temporal order around manual choice results',()=>{
 const s=fresh();s.events=[{id:0,age:7,phase:.1},{id:1,age:7,phase:.8},{id:2,age:7,phase:.4},{id:3,age:6,phase:.9}];
 assert.deepEqual(newestFirst(s.events).map(e=>e.id),[1,2,0,3]);
});
test('interest choices are three specific activities and lead to an enduring interest',()=>{
 const sets=new Set();
 for(let seed=11;seed<41;seed++){
   const s=createLife(countries,{seed,reflections:false});s.stage='living';s.deathAge=90;
   while(s.age<7){if(s.pending)choose(s,0,countries);else step(s,countries);}
   const d=pendingDecision(s,countries);assert.equal(d.id,'hobby');assert.equal(d.choices.length,3);
   assert.ok(d.choices.every(c=>typeof c.hobby==='string'));
   sets.add(d.choices.map(c=>c.hobby).join(','));assert.ok(choose(s,1,countries));
   assert.equal(s.deep.experience.hobby,d.choices[1].hobby);assert.ok(validateLife(s,countries));
 }
 assert.ok(sets.size>3);
});
test('import rejects impossible time fractions and hidden entries',()=>{
 for(const edit of [s=>s.clock.fraction=Infinity,s=>s.clock.age=1,s=>s.clock.moments[0].at=-1,s=>s.clock.moments[0].id=99999,s=>s.profile.month=13,s=>s.events[0].phase=null,s=>s.events[0].phase=2]){
   const s=fresh();edit(s);assert.equal(validateLife(s,countries),false);
 }
});
