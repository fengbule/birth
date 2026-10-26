import { initSystems } from './systems.js';
import { consumptionOptions, consume } from './life-events.js';
import { recordYear } from './experience.js';
import { appendRecord } from './records.js';

export const places = [
  {id:'home',name:'家',x:205,y:320,age:0,focus:'connection',verb:'陪伴家人'},
  {id:'park',name:'公园',x:430,y:350,age:2,focus:'health',verb:'在树荫下活动'},
  {id:'school',name:'学校',x:735,y:270,age:6,focus:'study',verb:'读书与学习'},
  {id:'farm',name:'小菜园',x:115,y:565,age:6,focus:'help',verb:'照料菜园'},
  {id:'lake',name:'湖边',x:815,y:605,age:7,focus:'rest',verb:'在湖边放松'},
  {id:'cafe',name:'小馆',x:610,y:550,age:12,focus:'connection',verb:'与朋友相处'},
  {id:'work',name:'工作坊',x:775,y:465,age:18,focus:'work',verb:'专心工作'},
  {id:'market',name:'杂货铺',x:245,y:505,age:18,focus:'balanced',verb:'安排日常生活'},
  {id:'clinic',name:'诊所',x:510,y:190,age:18,focus:'health',verb:'照顾身体'},
];
const clamp=n=>Math.max(0,Math.min(100,n));
const freeActivities=[
  {id:'town-home',place:'home',age:0,title:'和家人待一会儿',verb:'听家人说话',text:'熟悉的声音与陪伴，让今天多了一点安心。',effects:{relationships:3,happiness:2}},
  {id:'town-rest',place:'home',age:0,title:'好好休息',verb:'在家里休息',text:'没有赶路的这段时间，你慢慢恢复了精神。',effects:{health:2,happiness:2}},
  {id:'town-play',place:'park',age:2,title:'在公园里玩一会儿',verb:'在公园活动',text:'阳光从树叶间漏下来。你活动身体，也把烦恼暂时放在一边。',effects:{health:3,happiness:3}},
  {id:'town-read',place:'school',age:6,title:'读一点感兴趣的书',verb:'安静地读书',text:'翻过几页之后，一个原本不懂的问题，渐渐有了答案。',effects:{knowledge:4,happiness:1}},
  {id:'town-garden',place:'farm',age:6,title:'帮忙照料小菜园',verb:'浇水与照料',text:'你给菜苗浇水，拔去杂草。看着一点点长大的绿色，心情也轻松起来。',effects:{relationships:2,happiness:3}},
  {id:'town-lake',place:'lake',age:7,title:'去湖边散散心',verb:'坐在湖边放松',text:'水面轻轻晃动。这一小段安静的时光，只属于你自己。',effects:{happiness:4,health:1}},
  {id:'town-friend',place:'cafe',age:12,title:'和朋友聊聊天',verb:'与朋友聊天',text:'从最近的小事聊到未来的打算，你们又多了解了彼此一点。',effects:{relationships:4,happiness:2}},
  {id:'town-work',place:'work',age:18,title:'认真做好手头的工作',verb:'在工作坊忙碌',text:'你把手边的事情一件件完成。熟练不是一瞬间发生的，而是这样积累起来的。',effects:{knowledge:2,happiness:-1}},
];
const shopActions={market:['dinner','bicycle','television'],clinic:['checkup'],school:['train-technical','certificate'],cafe:['match'],work:['jobhunt','foreign']};

export function placeById(id){return places.find(p=>p.id===id);}
export function routinePlace(s){
  if(s.age<2)return placeById('home');
  if(s.age<6)return placeById('park');
  const mapping={study:'school',jobprep:'school',work:s.age>=18?'work':'school',connection:s.age>=12?'cafe':'home',help:'farm',health:'park',rest:'lake',balanced:'home'};
  const target=placeById(mapping[s.focus]||'home');
  return s.age>=target.age?target:placeById('park');
}
export function townActivities(s,placeId,countries){
  const d=initSystems(s),available=placeById(placeId);
  if(!available||s.age<available.age)return [];
  const blocked=s.stage!=='living'||!!s.pending||d.reflection!==null;
  const base=freeActivities.filter(a=>a.place===placeId&&s.age>=a.age&&!(a.id==='town-work'&&s.retired)).map(a=>{
    const actions=d.annual.age===s.age?d.annual.actions:[];
    const used=actions.includes(a.id),full=actions.length>=3;
    return {...a,kind:'town',cost:0,disabled:blocked||used||full,reason:used?'今年已经做过':full?'今年的三次活动已安排完':blocked?'先完成眼前的故事':''};
  });
  const paid=consumptionOptions(s,countries).filter(a=>(shopActions[placeId]||[]).includes(a.id)).map(a=>({...a,kind:'consume',place:placeId,verb:a.title,reason:a.reason||'',text:a.description}));
  return [...base,...paid];
}
export function performTownActivity(s,placeId,id,countries){
  const item=townActivities(s,placeId,countries).find(a=>a.id===id);
  if(!item||item.disabled)return {ok:false,message:item?.reason||'现在还不能安排这件事。'};
  if(item.kind==='consume')return consume(s,id,countries);
  const d=initSystems(s);
  if(d.annual.age!==s.age)d.annual={age:s.age,actions:[],income:0,expenses:0,returns:0};
  d.annual.actions.push(id);
  for(const [key,value] of Object.entries(item.effects))s[key]=clamp(s[key]+value);
  if(id==='town-home')for(const parent of d.parents)if(parent.alive)parent.closeness=clamp(parent.closeness+4);
  if(id==='town-work')d.career.experience++;
  appendRecord(s,item.title,item.text,'action');
  recordYear(s);
  return {ok:true,message:item.text,title:item.title};
}

export function routeBetween(from,to){
  if(Math.hypot(from.x-to.x,from.y-to.y)<2)return [];
  const points=[];
  // Main street y=350 connects the north; the south uses the x=490 spine.
  if(from.y<350){points.push({x:from.x,y:350});}
  else if(from.y>350&&from.x!==490){points.push({x:490,y:from.y});}
  points.push({x:490,y:350});
  if(to.y<350)points.push({x:to.x,y:350});
  else points.push({x:490,y:to.y});
  points.push({x:to.x,y:to.y});
  let previous=from;
  return points.filter(p=>{const keep=Math.hypot(p.x-previous.x,p.y-previous.y)>1;previous=p;return keep;});
}
