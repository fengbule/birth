import test from 'node:test';
import assert from 'node:assert/strict';
import {publicStatistics,referenceCountry} from '../public/reference-data.js';
import coverage from '../public/data/reference-coverage.json' with {type:'json'};

test('public country facts retain displayed population units and sex-specific life expectancy',()=>{
  const entries=Object.entries(publicStatistics);
  assert.equal(entries.length,172);
  assert.deepEqual(new Set(coverage.countryIds),new Set(entries.map(([id])=>id)));
  let population=0,birthShare=0;
  for(const [id,c] of entries){
    assert.ok(Number.isFinite(c.population)&&c.population>=10000&&c.population<=1.6e9,id);
    assert.ok(c.birthShare>=0&&c.birthShare<=20,id);
    assert.ok(c.lifeMale>40&&c.lifeFemale<95&&c.lifeFemale>c.lifeMale,id);
    assert.ok(c.infant>=0&&c.u5>=c.infant,id);
    population+=c.population;birthShare+=c.birthShare;
  }
  assert.ok(population>8e9&&population<8.2e9);
  assert.ok(birthShare>99&&birthShare<101);
  assert.equal(publicStatistics.CHN.population,1422580000);
  assert.equal(publicStatistics.IND.population,1438070000);
  assert.equal(publicStatistics.USA.population,343480000);
  assert.equal(referenceCountry({id:'CAF'},'女').life,59.4);
  assert.equal(referenceCountry({id:'CAF'},'男').life,55.4);
});
