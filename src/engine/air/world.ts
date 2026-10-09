import { mapRegions, provincesData, countries, mapCapitals } from '../../data/map';
import type { AirBase, AirState, AirWing, AirZone, AircraftType } from '../../types/air';
import type { Country, Province } from '../../types';
import { AIR_BALANCE } from '../../data/aircraft';

/** Regional projection cells are authored once at module load, never geometry in a tick. */
export const airZones: AirZone[] = mapRegions.flatMap(region => {
  const cells = new Map<string, Province[]>();
  for (const definition of region.provinces) {
    const p = provincesData.find(p => p.id === definition.id)!;
    const key = `${Math.floor(p.center.x / 600)}-${Math.floor(p.center.y / 450)}`;
    const bucket = cells.get(key) ?? []; bucket.push(p); cells.set(key, bucket);
  }
  return [...cells].sort(([a], [b]) => a.localeCompare(b)).map(([cell, ps]) => ({
    id: `air-${region.id}-${cell}`, name: `${region.id} · ${ps[0].name}`,
    provinceIds: ps.map(p => p.id).sort(),
    center: { x: ps.reduce((s,p) => s+p.center.x,0)/ps.length, y: ps.reduce((s,p) => s+p.center.y,0)/ps.length }, neighbors: [],
  }));
});
export const airZoneByProvinceId = new Map(airZones.flatMap(z => z.provinceIds.map(id => [id,z] as const)));
export const airZoneById = new Map(airZones.map(z => [z.id,z]));
for (const z of airZones) z.neighbors = [...new Set(z.provinceIds.flatMap(id => provincesData.find(p=>p.id===id)!.neighbors.map(id=>airZoneByProvinceId.get(id)?.id).filter((id): id is string => !!id && id!==z.id)))].sort();

export function createInitialAirBases(cs: readonly Country[], ps: readonly Province[]): AirBase[] {
  return [...cs].sort((a,b)=>a.tag.localeCompare(b.tag)).flatMap(c => {
    const owned = ps.filter(p=>p.owner===c.tag);
    const population = owned.reduce((s,p)=>s+p.population.total,0);
    // Scenario population is scaled gameplay data, not contemporary census counts.
    if (owned.length < 2 && population < 60000) return [];
    const capital = c.capitalId ?? c.capital ?? mapCapitals[c.tag];
    const ranked = [...owned].sort((a,b)=>Number(b.id===capital)-Number(a.id===capital) || b.development-a.development || b.population.total-a.population.total || a.id.localeCompare(b.id));
    const count = Math.min(3, Math.max(1, Math.ceil(owned.length/8)));
    return ranked.slice(0,count).map((p,i)=> {
      const level: 1 | 2 | 3 = i===0 && owned.length>=8 ? 3 : owned.length>=3 ? 2 : 1;
      return { provinceId:p.id, level, capacity:level*2 };
    });
  });
}
export const airBases = createInitialAirBases(countries, provincesData);
export const airBaseByProvinceId = new Map(airBases.map(b=>[b.provinceId,b]));
export function createInitialAirState(cs: readonly Country[], ps: readonly Province[]): AirState {
  const wings: AirWing[] = [];
  for (const c of [...cs].sort((a,b)=>a.tag.localeCompare(b.tag))) {
    const bases=airBases.filter(b=>ps.some(p=>p.id===b.provinceId && p.owner===c.tag));
    const owned=ps.filter(p=>p.owner===c.tag);
    const population=owned.reduce((s,p)=>s+p.population.total,0);
    const development=owned.reduce((s,p)=>s+p.development,0);
    if (!bases.length || population<60000 || development<12 || c.resources.maxManpower<10000) continue;
    const types: AircraftType[] = population>=200000 || owned.length>=8 ? ['FIGHTER','CAS','BOMBER'] : population>=110000 && development>=22 ? ['FIGHTER','CAS'] : ['FIGHTER'];
    types.slice(0,bases[0].capacity).forEach((type,i)=>wings.push({id:`air-${c.tag}-${i}`,countryTag:c.tag,name:`${c.tag} ${type} ${i+1}`,type,aircraftCount:AIR_BALANCE.wingSize,maxAircraft:AIR_BALANCE.wingSize,strength:100,organization:100,baseProvinceId:bases[0].provinceId,status:'READY'}));
  }
  return { wings, engagements: [] };
}
