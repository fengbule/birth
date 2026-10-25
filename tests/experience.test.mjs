import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLife,step,choose,pendingDecision,validateLife} from '../public/engine.js';
import {experience,lifeReview} from '../public/experience.js';
import {consumptionOptions,consume} from '../public/life-events.js';
import {mortalityCurve,sampleLifetime} from '../public/mortality.js';
import {deathRecordMarkup,endingFrames} from '../public/life-record.js';
import {focusOptions,autoChoiceIndex} from '../public/playback.js';
const countries=JSON.parse(readFileSync(new URL('../public/data/countries.json',import.meta.url))).countries;
const data=JSON.parse(readFileSync(new URL('../public/data/mortality.json',import.meta.url)));
const country=countries.find(c=>c.id==='CHN');
const fresh=()=>createLife([country],{seed:100,createdAt:1});
const adult=()=>{
  const s=fresh();s.stage='living';s.age=25;s.income=20000;s.money=100000;s.education='高中';return s;
};

test('observed childhood sequence offers four temperaments at two, a record at four, interests at seven',()=>{
  const s=fresh();s.stage='living';s.deathAge=90;
  while(!s.pending)step(s,countries);
  assert.equal(s.age,2);assert.equal(pendingDecision(s,countries).choices.length,4);
  assert.ok(choose(s,3,countries));
  while(s.age<4)step(s,countries);
  assert.ok(s.events.some(e=>e.age===4&&e.type==='childhood'));
  while(!s.pending)step(s,countries);
  assert.equal(s.age,7);assert.equal(pendingDecision(s,countries).choices.length,3);
  assert.equal(focusOptions({...s,age:8}).length,5);
  assert.equal(focusOptions({...s,age:8,education:'未曾上学'}).length,4);
  assert.equal(autoChoiceIndex({...s,focus:'balanced'},{choices:[1,2,3,4]},()=>.99),3);
});

test('consumption is bounded credit, per-item cooldowns and delayed work, not immediate stat-only work',()=>{
  const s=adult(),x=experience(s);
  const training=consumptionOptions(s,countries).find(i=>i.id==='train-technical');
  assert.ok(consume(s,training.id,countries).ok);
  assert.ok(consumptionOptions(s,countries).filter(i=>i.group==='training').every(i=>i.remaining===2&&i.disabled));
  assert.ok(consume(s,'jobhunt',countries).ok);
  assert.notEqual(s.occupation,'维修技师');
  step(s,countries);
  assert.equal(s.pending,null);
  step(s,countries);
  if(s.pending&&s.pending!=='life-event')choose(s,0,countries);
  assert.equal(s.pending,'life-event');assert.equal(pendingDecision(s,countries).choices.length,2);
  assert.ok(choose(s,0,countries));assert.equal(s.occupation,'维修技师');
  assert.ok(validateLife(s,countries));
  const t=adult(),cost=consumptionOptions(t,countries).find(i=>i.id==='checkup').cost;
  t.money=cost-44;
  assert.ok(consume(t,'checkup',countries).ok);assert.equal(t.money,-44);
  assert.equal(consume(t,'checkup',countries).ok,false);
  t.money=-1e6;
  assert.ok(consumptionOptions(t,countries).every(i=>i.disabled));
  const student=adult();student.education='大学在读';student.income=0;student.money=0;
  assert.equal(consumptionOptions(student,countries).find(i=>i.id==='dinner').disabled,true);
});

test('queued events at the same age require separate choices and survive reload',()=>{
  let s=adult();s.income=0;consume(s,'jobhunt',countries);consume(s,'match',countries);step(s,countries);
  const age=s.age;
  s=JSON.parse(JSON.stringify(s));
  assert.ok(validateLife(s,countries));
  choose(s,1,countries);
  assert.equal(s.age,age);assert.equal(s.pending,'life-event');
  assert.equal(pendingDecision(s,countries).choices.length,4);
  choose(s,0,countries);
  assert.ok(s.partner);assert.equal(s.pending,null);assert.ok(validateLife(s,countries));
});

test('introductions stop at three; foreign inquiry leads through work and residency in later years',()=>{
  const s=adult();consume(s,'match',countries);step(s,countries);
  for(let i=1;i<=3;i++){
    assert.equal(s.deep.experience.activeEvent.attempt,i);
    assert.ok(choose(s,3,countries));
    assert.equal(s.age,26);
  }
  assert.equal(s.pending,null);assert.equal(s.deep.experience.queued.length,0);
  const t=adult();t.money=1e7;t.knowledge=90;
  assert.ok(consume(t,'foreign',countries).ok);step(t,countries);
  assert.ok(choose(t,0,countries));assert.equal(t.deep.residence,'AUS');
  assert.equal(t.deep.experience.residency.status,'work');
  for(let i=0;i<15&&t.deep.experience.residency.status!=='permanent';i++){
    if(t.pending)choose(t,0,countries);else step(t,countries);
  }
  assert.equal(t.deep.experience.residency.status,'permanent');
  assert.ok(t.events.some(e=>e.title==='在新地方寻找工作'));
  assert.ok(validateLife(t,countries));
});

test('year records produce a conditional full record; malformed new archive fields are rejected',()=>{
  const s=fresh();s.stage='living';s.deathAge=0;step(s,countries);
  assert.equal(s.age,0);assert.equal(s.stage,'ended');assert.ok(validateLife(s,countries));
  const markup=deathRecordMarkup(s,countries);
  assert.ok(markup.includes('死亡纪录'));assert.ok(!markup.includes('class="record-texture"'));
  assert.ok(lifeReview(s).happiest);
  assert.ok(endingFrames(s,countries).some(f=>f.kind==='cause'));
  const legacy=fresh();delete legacy.deep.experience;assert.ok(validateLife(legacy,countries));
  for(const patch of [{queued:[{type:'jobhunt',age:999,id:'x'}]},{temperament:[25,25,25,Infinity]},{activeEvent:{id:'x',type:'jobhunt',age:0}}]){
    const invalid=fresh();Object.assign(invalid.deep.experience,patch);assert.equal(validateLife(invalid,countries),false);
  }
});

test('age hazards respect WDI infant, under-five and cumulative adult anchors across all 217 regions',()=>{
  let checked=0,estimated=0;
  for(const c of countries)for(const year of data.years)for(const sex of ['男','女']){
    const curve=mortalityCurve(c,sex,year===2023?'today':'past',year),row=data.countries[c.id][year];
    assert.ok(curve.q.every(q=>Number.isFinite(q)&&q>=0&&q<=1));
    assert.ok(Math.abs(curve.mean-curve.target)<.05,`${c.id} ${year} ${sex} mean`);
    if(row.infant!==null)assert.ok(Math.abs(curve.survival[1]-(1-row.infant/1000))<1e-10);
    if(row.u5!==null)assert.ok(Math.abs(curve.survival[5]-(1-row.u5/1000))<1e-10);
    const amr=row[sex==='女'?'adultFemale':'adultMale'];
    if(amr!==null)assert.ok(Math.abs(curve.survival[60]/curve.survival[15]-(1-amr/1000))<1e-10);
    estimated+=curve.estimated.length;checked++;
  }
  console.log(JSON.stringify({mortalityCurves:checked,estimatedAnchorSlots:estimated,age5to14:'explicit model assumption'}));
});

test('300000 sampled lifespans include infant, juvenile and adult tails with the configured mean',()=>{
  const results=[];
  for(const id of ['CHN','COD','CAF']){
    const c=countries.find(c=>c.id===id),curve=mortalityCurve(c,'女');
    let rng=18437,sum=0,u5=0,juvenile=0;
    for(let i=0;i<100000;i++){
      rng=(Math.imul(rng,1664525)+1013904223)>>>0;
      const age=sampleLifetime(c,'女',rng/2**32);sum+=age;if(age<5)u5++;if(age<18)juvenile++;
    }
    assert.ok(Math.abs(sum/100000-curve.target)<.35);
    assert.ok(Math.abs(u5/100000-(1-curve.survival[5]))<.003);
    assert.ok(juvenile>0);results.push({id,samples:100000,mean:sum/100000,under5:u5,juvenile});
  }
  console.log(JSON.stringify({lifespanSamples:results}));
});
