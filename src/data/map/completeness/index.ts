import type { Country } from '../../../types';
import type { MapRegion } from '../types';
import { DEFAULT_LAWS } from '../../../constants/laws';
import { createProvinceGameplay } from '../provinceGameplay';
import { definitions, countryDefinitions } from './definitions';
import { geometry } from './geometry';
import { supplementalLandmasses } from './topology';
export { completenessConnections } from './topology';

// Gameplay entities are scenario representations, not statements of real-world sovereignty.
const countries: Country[] = countryDefinitions.map(([tag,name,capitalId],i) => {
  const color = `hsl(${(i*137)%360}, 35%, 45%)`;
  const holdings = definitions.filter(d=>d[2]===tag);
  const population = holdings.reduce((sum,d)=>sum+d[3],0);
  const manpower = Math.round(population*.09);
  return {
    tag,name,adjective:name,color,colorLight:`hsl(${(i*137)%360}, 35%, 65%)`,capitalId,flag:'\uD83C\uDF10',
    provinces:holdings.map(d=>d[0]),
    resources:{gold:1540,manpower,maxManpower:manpower*3,stability:80,prestige:40},
    economy:{goldIncome:0,goldExpense:0,manpowerGain:0,manpowerExpense:0},activeLaws:{...DEFAULT_LAWS},
  };
});

/** Extend the six existing regions; a global country is defined only once. */
export function withCompleteness(region: MapRegion): MapRegion {
  const rows = definitions.filter(d=>d[6]===region.id);
  const ids = new Set(rows.map(d=>d[0]));
  const national = countries.filter(c=>countryDefinitions.find(d=>d[0]===c.tag)![4]===region.id);
  const additionalHoldings: Record<string,string[]> = {};
  for (const [id,,owner] of rows) {
    if (!countries.some(c=>c.tag===owner)) (additionalHoldings[owner] ??= []).push(id);
  }
  const provinces = rows.map(([id,name,owner,population,development,terrain])=>
    createProvinceGameplay([id,name,owner,population,development],terrain,
      countries.find(c=>c.tag===owner)?.color ?? region.countries.find(c=>c.tag===owner)?.color ?? '#718399'));
  return {
    ...region,countries:[...region.countries,...national],provinces:[...region.provinces,...provinces],
    geometry:[...region.geometry,...geometry.filter(g=>ids.has(g.id))],
    topology:[...region.topology,...rows.map(([id])=>({id,neighbors:[]}))],
    capitals:{...region.capitals,...Object.fromEntries(national.map(c=>[c.tag,c.capitalId!]))},
    additionalHoldings,
    landmasses:[...(region.landmasses ?? []),...supplementalLandmasses.filter(l=>l.provinceIds.some(id=>ids.has(id))).map(l=>({...l,provinceIds:l.provinceIds.filter(id=>ids.has(id))}))],
  };
}
