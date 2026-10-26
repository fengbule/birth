import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLife, step, choose, validateLife } from '../public/engine.js';
import { initSystems, performAction } from '../public/systems.js';
import { places, townActivities, performTownActivity, routeBetween, routinePlace } from '../public/town-activities.js';
import { TownScene } from '../public/town-scene.js';
const countries=JSON.parse(readFileSync(new URL('../public/data/countries.json',import.meta.url))).countries;
const life=(age=0)=>{const s=createLife(countries,{seed:88,reflections:false});s.stage='living';s.age=age;return s;};

test('locations and actions unlock with age; pending stories block all activities',()=>{
  for(const age of [0,2,6,7,12,18,65]){
    const s=life(age);
    for(const p of places)assert.equal(townActivities(s,p.id,countries).length>0,age>=p.age);
    s.pending='temperament';
    for(const p of places)assert.ok(townActivities(s,p.id,countries).every(a=>a.disabled));
  }
});
test('town and family activities share a three-action budget and survive save validation',()=>{
  const s=life(28);s.money=1000000;initSystems(s).annual={age:28,actions:[],income:0,expenses:0,returns:0};
  assert.ok(performTownActivity(s,'home','town-home',countries).ok);
  assert.equal(performTownActivity(s,'home','town-home',countries).ok,false);
  assert.ok(performAction(s,'exercise',countries).ok);
  assert.ok(performTownActivity(s,'school','town-read',countries).ok);
  assert.equal(performTownActivity(s,'lake','town-lake',countries).ok,false);
  assert.ok(validateLife(JSON.parse(JSON.stringify(s)),countries));
  s.deep.annual.age=27;
  assert.ok(performTownActivity(s,'home','town-home',countries).ok);
  assert.deepEqual(s.deep.annual.actions,['town-home']);
});
test('activity completion revalidates affordability and eligibility',()=>{
  const s=life(28);s.money=1e6;
  const item=townActivities(s,'market',countries).find(a=>a.id==='dinner');
  assert.ok(item&&!item.disabled);
  s.pending='temperament';const before=structuredClone(s);
  assert.equal(performTownActivity(s,'market','dinner',countries).ok,false);
  assert.deepEqual(s,before);
  s.pending=null;s.stage='ended';
  assert.equal(performTownActivity(s,'home','town-home',countries).ok,false);
});
test('every destination has a finite road route ending at its entry',()=>{
  for(const from of places)for(const to of places){
    const route=routeBetween(from,to);
    if(from.id===to.id)assert.deepEqual(route,[]);
    else {assert.deepEqual(route.at(-1),{x:to.x,y:to.y});assert.ok(route.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));}
  }
  assert.equal(routinePlace(life()).id,'home');
  const child=life(6);child.focus='work';assert.equal(routinePlace(child).id,'school');
});
test('walking and dwell finish once; pause and cancellation cannot finish an activity',()=>{
  const scene=new TownScene();scene.node={isConnected:true,dataset:{},setAttribute(){}};scene.draw=()=>{};
  let completed=0;
  scene.move('school','读书',{duration:1800,complete:()=>completed++});
  const origin={...scene.position};scene.tick(5000,true);assert.deepEqual(scene.position,origin);
  assert.equal(completed,0);
  scene.tick(300);assert.notDeepEqual(scene.position,origin);assert.equal(completed,0);
  for(let i=0;i<200;i++)scene.tick(50);
  assert.equal(completed,1);assert.equal(scene.position.x,735);
  scene.tick(5000);assert.equal(completed,1);
  scene.move('home','回家',{complete:()=>completed++});scene.tick(300);scene.cancel();scene.tick(20000);
  assert.equal(completed,1);
});
test('500 full lives with town activities retain valid bounded saves',()=>{
  let actions=0;
  for(let seed=70001;seed<70501;seed++){
    const s=createLife(countries,{seed,reflections:false});s.stage='living';
    for(let n=0;n<200&&s.stage==='living';n++){
      if(s.pending){choose(s,seed%2,countries);continue;}
      for(const place of places){
        const option=townActivities(s,place.id,countries).find(a=>a.kind==='town'&&!a.disabled);
        if(option){assert.ok(performTownActivity(s,place.id,option.id,countries).ok);actions++;}
      }
      assert.ok(validateLife(JSON.parse(JSON.stringify(s)),countries));
      step(s,countries);
    }
    assert.equal(s.stage,'ended');
  }
  assert.ok(actions>10000);
});
