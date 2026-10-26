import observations from './data/reference-statistics.json' with {type:'json'};
export const publicStatistics=observations.countries;
export function referenceCountry(c,sex) {
  const data=publicStatistics[c.id];
  if(!data)return c;
  return {...c,...data,reference:data,birthRate:131930000*data.birthShare/100/data.population*1000,
    life:sex=== '女'?data.lifeFemale:sex==='男'?data.lifeMale:data.life};
}
export function withReferenceCountries(countries) {
  return countries.some(c=>c.id==='TWN')?countries:[...countries,{id:'TWN',code:'TW',name:'台湾',en:'Taiwan',capital:'台北',region:'East Asia & Pacific',income:'HIC',lat:25.03,lon:121.56,...publicStatistics.TWN,birthRate:5.8}];
}
