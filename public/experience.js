// Per-year observations belong to the fictional life, not the wall-clock player.
export function experience(s) {
  if (!s.deep.experience) {
    s.deep.experience = {
      version: 1,
      temperament: [25, 25, 25, 25],
      childhoodChoice: null,
      years: [],
      cooldowns: {},
      cause: null,
      queued: [],
      activeEvent: null,
    };
  }
  s.deep.experience.queued ??= [];
  s.deep.experience.activeEvent ??= null;
  return s.deep.experience;
}

export function recordYear(s) {
  const x = experience(s);
  const year = {
    age: s.age, country: s.deep.residence, health: s.health,
    happiness: s.happiness, knowledge: s.knowledge, relationships: s.relationships,
    money: s.money, income: s.income, focus: s.focus, occupation: s.occupation,
  };
  const index = x.years.findIndex(y => y.age === s.age);
  if (index < 0) x.years.push(year);
  else x.years[index] = year;
  return year;
}

export const temperaments = ["好奇而专注", "活泼而主动", "敏感而体贴", "安静而坚韧"];

export function temperamentName(s) {
  const values = experience(s).temperament;
  return temperaments[values.indexOf(Math.max(...values))];
}

export function lifeReview(s) {
  const x = experience(s), years = x.years;
  const best = key => years.length ? years.reduce((a,b) => b[key]>a[key] ? b : a) : null;
  const focuses = {};
  for (const y of years.filter(y=>y.age>=18 && y.age<s.age)) focuses[y.focus]=(focuses[y.focus]||0)+1;
  const adultYears = Object.values(focuses).reduce((a,b)=>a+b,0) || 1;
  const occupations = [...new Set(years.filter(y=>y.age>=18).map(y=>y.occupation))];
  return {
    happiest: best('happiness'), highestIncome: best('income'), focuses, occupations,
    axes: [
      {left:'陪伴',right:'工作',value:Math.round(100*(focuses.work||0)/adultYears)},
      {left:'根',right:'风',value:Math.min(100,s.deep.moves.length*22)},
      {left:'平静',right:'浪潮',value:Math.min(100,s.events.filter(e=>['decision','migration'].includes(e.type)).length*3)},
      {left:'今天',right:'明天',value:Math.round(100*((focuses.study||0)+(focuses.health||0))/adultYears)},
    ],
    remembered: s.events.filter(e=>e.star),
  };
}

export function validExperience(x, s, countries) {
  if (x === undefined) return true; // Archives made before these records remain importable.
  const finite = (n,min=0,max=100) => Number.isFinite(n)&&n>=min&&n<=max;
  const event = e => e && typeof e.id==='string'&&e.id.length<=80
    && ['jobhunt','match','foreign','foreign-work','foreign-residency'].includes(e.type)
    && Number.isInteger(e.age)&&finite(e.age,0,120)
    && (e.attempt===undefined||(Number.isInteger(e.attempt)&&finite(e.attempt,1,3)))
    && (e.country===undefined||countries.some(c=>c.id===e.country));
  return x && x.version===1 && Array.isArray(x.temperament) && x.temperament.length===4
    && x.temperament.every(v=>finite(v))
    && (x.childhoodChoice===null || (Number.isInteger(x.childhoodChoice)&&finite(x.childhoodChoice,0,3)))
    && (x.cause===null || (typeof x.cause==='string'&&x.cause.length<=100))
    && x.cooldowns && typeof x.cooldowns==='object' && !Array.isArray(x.cooldowns)
    && Object.keys(x.cooldowns).length<=30
    && Object.entries(x.cooldowns).every(([k,v])=>/^[a-z-]{1,40}$/.test(k)&&Number.isInteger(v)&&finite(v,0,120))
    && (x.specialty===undefined||['train-technical','train-service','train-care','train-office','certificate'].includes(x.specialty))
    && (x.residency===undefined||(x.residency&&countries.some(c=>c.id===x.residency.country)
      && ['work','permanent'].includes(x.residency.status)))
    && (x.queued===undefined||(Array.isArray(x.queued)&&x.queued.length<=30&&x.queued.every(event)))
    && (x.activeEvent===undefined||x.activeEvent===null||(event(x.activeEvent)&&s.pending==='life-event'&&x.activeEvent.age===s.age))
    && (s.pending!=='life-event'||!!x.activeEvent)
    && Array.isArray(x.years) && x.years.length<=111
    && x.years.every((y,i)=>y && Number.isInteger(y.age) && finite(y.age,0,s.age)
      && (i===0||y.age>x.years[i-1].age)
      && countries.some(c=>c.id===y.country)
      && ['health','happiness','knowledge','relationships'].every(k=>finite(y[k]))
      && ['money','income'].every(k=>finite(y[k],-1e10,1e10))
      && typeof y.focus==='string' && y.focus.length<=40
      && typeof y.occupation==='string' && y.occupation.length<=150);
}
