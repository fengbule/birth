import observations from './data/mortality.json' with {type:'json'};
const cache=new Map();
const clip=(n,a,b)=>Math.min(b,Math.max(a,n));

// Interpolation of period indicators, not the reference site's life tables.
// Adult mortality is a cumulative 15-to-60 probability, never a yearly hazard.
export function mortalityCurve(country,sex='男',world='today',year=2023) {
  const sourceYear=world==='past'?year:2023;
  const key=[country.id,sex,sourceYear,country.life,world].join(':');
  if(cache.has(key))return cache.get(key);
  const row=observations.countries[country.id]?.[sourceYear]||{};
  const female=sex==='女',estimated=[];
  const value=(field,fallback)=>{
    if(Number.isFinite(row[field]))return row[field];
    estimated.push(field);
    const median=observations.regionalMedians[country.region]?.[sourceYear]?.[field]?.median;
    return Number.isFinite(median)?median:fallback;
  };
  const target=world==='future'?country.life:value(female?'lifeFemale':'lifeMale',country.life);
  const infant=clip(value('infant',Math.max(1,100*Math.exp((55-target)/14)))/1000,0,.999);
  const u5=clip(value('u5',infant*1400)/1000,infant,.999);
  const adult=clip(value(female?'adultFemale':'adultMale',clip(450-(target-50)*13,30,600))/1000,0,.9999);
  const early=Array(60).fill(0);
  early[0]=infant;
  const child=1-((1-u5)/(1-infant))**.25;
  for(let age=1;age<5;age++)early[age]=child;
  // These six WDI indicators do not observe 5–14. Keep the assumption explicit.
  for(let age=5;age<15;age++)early[age]=clip((u5-infant)*.035+.00008,.00005,.006);
  const setAdultShape=shape=>{
    const weights=Array.from({length:45},(_,i)=>Math.exp(i*shape));
    const h=-Math.log(1-adult)/weights.reduce((a,b)=>a+b,0);
    for(let age=15;age<60;age++)early[age]=1-Math.exp(-h*weights[age-15]);
  };
  setAdultShape(.035);
  const make=scale=>{
    const q=[...early],survival=[1];
    let remaining=1,mean=0;
    for(let age=0;age<=110;age++){
      if(age>=60)q[age]=age===110?1:1-Math.exp(-scale*Math.exp((age-60)*.09));
      mean+=age*remaining*q[age];
      remaining*=1-q[age];survival.push(remaining);
    }
    return {q,survival,mean};
  };
  // Historical high-mortality periods can require adult deaths concentrated
  // earlier than an increasing Gompertz curve, while retaining the 15–60 anchor.
  if(make(100).mean>target){
    let low=-.5,high=.035;
    for(let i=0;i<40;i++){
      const shape=(low+high)/2;setAdultShape(shape);
      if(make(100).mean>target-.2)high=shape;else low=shape;
    }
    setAdultShape((low+high)/2);
  }
  let lo=.000000001,hi=100;
  for(let i=0;i<48;i++){
    const mid=(lo+hi)/2;
    if(make(mid).mean>target)lo=mid;else hi=mid;
  }
  const curve={...make((lo+hi)/2),target,sourceYear,estimated,model:'WDI anchors with interpolated age hazards'};
  cache.set(key,curve);return curve;
}

export function sampleLifetime(country,sex,draw,world='today',year=2023) {
  const curve=mortalityCurve(country,sex,world,year);
  for(let age=0;age<=110;age++)if(draw>=curve.survival[age+1])return age;
  return 110;
}
