// Refresh exact-year WDI observations. Missing observations remain null.
import {readFile,writeFile} from 'node:fs/promises';
const dest=new URL('../public/data/mortality.json',import.meta.url);
const existing=JSON.parse(await readFile(dest,'utf8'));
const {countries}=JSON.parse(await readFile(new URL('../public/data/countries.json',import.meta.url),'utf8'));
const output={...existing,retrievedAt:new Date().toISOString(),countries:{},regionalMedians:{}};
for(const c of countries){
  output.countries[c.id]={};
  for(const year of existing.years)output.countries[c.id][year]=Object.fromEntries(Object.keys(existing.indicators).map(key=>[key,null]));
}
for(const [field,indicator] of Object.entries(existing.indicators)){
  for(const year of existing.years){
    const url=`https://api.worldbank.org/v2/country/all/indicator/${indicator.code}?source=2&date=${year}&format=json&per_page=20000`;
    const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
    if(!response.ok)throw Error(`WDI ${field} ${year}: HTTP ${response.status}`);
    const payload=await response.json();
    if(!Array.isArray(payload)||payload[0]?.pages!==1||!Array.isArray(payload[1]))throw Error('WDI pagination or response changed');
    for(const row of payload[1]){
      if(Number(row.date)!==year)throw Error('WDI returned a different observation year');
      if(!output.countries[row.countryiso3code])continue;
      if(row.value!==null&&(!Number.isFinite(row.value)||row.value<0))throw Error('Invalid WDI observation');
      output.countries[row.countryiso3code][year][field]=row.value;
    }
    console.log(`Fetched ${field} ${year}`);
  }
}
for(const region of [...new Set(countries.map(c=>c.region))].sort()){
  output.regionalMedians[region]={};
  for(const year of existing.years){
    const row={};
    for(const field of Object.keys(existing.indicators)){
      const values=countries.filter(c=>c.region===region).map(c=>output.countries[c.id][year][field]).filter(v=>v!==null).sort((a,b)=>a-b);
      const mid=Math.floor(values.length/2);
      row[field]={median:!values.length?null:values.length%2?values[mid]:(values[mid-1]+values[mid])/2,observedCountries:values.length};
    }
    output.regionalMedians[region][year]=row;
  }
}
await writeFile(dest,JSON.stringify(output)+'\n');
console.log(`Saved exact WDI observations for ${countries.length} regions; review data differences before release.`);
