import fs from 'node:fs';
import {createLife} from '../public/engine.js';
import {configureEras} from '../public/systems.js';
import {withReferenceCountries} from '../public/reference-data.js';
const countries=withReferenceCountries(JSON.parse(fs.readFileSync(new URL('../public/data/countries.json',import.meta.url))).countries);
configureEras(JSON.parse(fs.readFileSync(new URL('../public/data/eras.json',import.meta.url))));
const targets=['CHN','IND','NGA','COD','CAF','USA','JPN','BRA','DEU','IDN','PAK','BGD'];
const out=[];
for(let i=0;i<targets.length;i++){
 const setting=i%4===1?{world:'past',year:1990}:i%4===2?{world:'past',year:2010}:i%4===3?{world:'future',year:2050}:{world:'today',year:2026};
 for(let seed=1;seed<50000;seed++){
  const s=createLife(countries,{seed,...setting,reflections:false,duration:30});
  if(s.country===targets[i]&&s.deathAge>=35){out.push({seed,country:s.country,age:s.deathAge,...setting});break;}
 }
}
for(const [name,predicate] of [['infant',s=>s.deathAge===0],['juvenile',s=>s.deathAge>=8&&s.deathAge<=14]]){
 for(let seed=1;seed<10000;seed++){
  const s=createLife(countries,{seed,reflections:false,duration:30});
  if(predicate(s)){out.push({name,seed,country:s.country,age:s.deathAge,world:'today',year:2026});break;}
 }
}
console.log(JSON.stringify(out));
