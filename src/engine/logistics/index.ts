import type { Country, DiplomaticRelation, Province, War } from '../../types';
import { getBuildingLevel } from '../../data/buildings';
import { hasMilitaryAccess } from '../diplomacy/diplomacySelectors';
import { isTerrainType } from '../terrain';
import { LOGISTICS_BALANCE as B } from './balance';
export { LOGISTICS_BALANCE } from './balance';

export interface LogisticsContext {
  provinces: Province[];
  countries: Country[];
  relations: DiplomaticRelation[];
  wars?: War[];
}
export interface LogisticsInfo {
  connected: boolean;
  originId: string | null;
  distance: number | null;
  efficiency: number;
  terrainModifier: number;
  infrastructureModifier: number;
  distanceModifier: number;
  occupationModifier: number;
  /** Own controlled provinces downstream in the deterministic BFS tree. */
  dependentProvinces: number;
}
export interface CountryLogisticsNetwork {
  tag: string;
  originId: string | null;
  provinces: Map<string,LogisticsInfo>;
}
export interface LogisticsSnapshot {
  networks: Map<string,CountryLogisticsNetwork>;
  provinceById: Map<string,Province>;
  hostile: Map<string,Set<string>>;
  allowedOwners: Map<string,Set<string>>;
  occupied: Set<string>;
}
const finitePositive = (value: number): number => Number.isFinite(value) ? Math.max(0,value) : 0;
const terrainModifier = (p: Province) => B.terrainLogisticsModifiers[isTerrainType(p.terrain) ? p.terrain : 'plains'];
export function logisticsInfrastructureModifier(p: Province): number {
  return Math.min(B.maximumInfrastructureModifier,1+finitePositive(getBuildingLevel(p,'infrastructure'))*B.infrastructureBonusPerLevel);
}
export function logisticsDistanceModifier(distance: number): number {
  if (!Number.isFinite(distance) || distance < 0) return B.distanceBands[B.distanceBands.length-1].modifier;
  return B.distanceBands.find(band => distance <= band.maxDistance)!.modifier;
}
/** Actual provincial controller is authoritative, including conquest/restoration.
 * No UI state or guessed map capital is needed. */
export function resolveLogisticsOrigin(country: Country | undefined,provinces: Province[]): Province | undefined {
  if (!country || country.isAnnexed || country.tag.startsWith('rebel_')) return;
  const controlled = provinces.filter(p => p.owner === country.tag);
  const capital = controlled.find(p => p.id === (country.capitalId ?? country.capital));
  if (capital) return capital;
  return controlled.sort((a,b) => logisticsInfrastructureModifier(b)-logisticsInfrastructureModifier(a)
    || finitePositive(b.development)-finitePositive(a.development) || a.id.localeCompare(b.id))[0];
}
function info(p: Province,originId: string | null,distance: number | null,routeTerrain: number,occupation: number): LogisticsInfo {
  const connected = distance !== null,infrastructureModifier = logisticsInfrastructureModifier(p);
  const distanceModifier = connected ? logisticsDistanceModifier(distance) : 1;
  const efficiency = Math.max(B.minimumLogisticsEfficiency,Math.min(B.maximumLogisticsEfficiency,
    (connected ? 1 : B.disconnectedSupplyModifier)*distanceModifier*routeTerrain*infrastructureModifier*occupation));
  return {connected,originId,distance,efficiency,terrainModifier: routeTerrain,infrastructureModifier,distanceModifier,occupationModifier: occupation,dependentProvinces: 0};
}

/** One indexed land BFS per country, never per army. Pure and not persisted. */
export function buildLogisticsNetworks(ctx: LogisticsContext): LogisticsSnapshot {
  const provinces = [...ctx.provinces].sort((a,b) => a.id.localeCompare(b.id));
  const provinceById = new Map(provinces.map(p => [p.id,p]));
  const neighbors = new Map(provinces.map(p => [p.id,[...p.neighbors].sort()]));
  const hostile = new Map<string,Set<string>>();
  const addWar = (a: string,b: string) => { const enemies = hostile.get(a) ?? new Set(); enemies.add(b); hostile.set(a,enemies); };
  for (const war of ctx.wars ?? []) { addWar(war.attacker,war.defender); addWar(war.defender,war.attacker); }
  for (const r of ctx.relations.filter(r => r.status === 'war')) { addWar(r.countryA,r.countryB); addWar(r.countryB,r.countryA); }
  const occupied = new Set(provinces.filter(p => p.originalOwner && p.originalOwner !== p.owner && hostile.get(p.owner)?.has(p.originalOwner)).map(p => p.id));
  // Accept active occupation records only when their occupier still controls it.
  // Stale war records cannot keep a reconquered corridor blocked.
  for (const war of ctx.wars ?? []) {
    for (const id of war.occupiedByAttacker) if (provinceById.get(id)?.owner === war.attacker) occupied.add(id);
    for (const id of war.occupiedByDefender) if (provinceById.get(id)?.owner === war.defender) occupied.add(id);
  }
  const networks = new Map<string,CountryLogisticsNetwork>(),allowedOwners = new Map<string,Set<string>>();
  const owners = [...new Set(provinces.map(p => p.owner))];
  for (const country of [...ctx.countries].sort((a,b) => a.tag.localeCompare(b.tag))) {
    if (country.tag.startsWith('rebel_')) continue;
    const origin = resolveLogisticsOrigin(country,provinces),network: CountryLogisticsNetwork = {tag: country.tag,originId: origin?.id ?? null,provinces: new Map()};
    networks.set(country.tag,network);
    const allowed = new Set(owners.filter(tag => !tag.startsWith('rebel_') && !hostile.get(country.tag)?.has(tag) && hasMilitaryAccess(ctx.relations,country.tag,tag)));
    allowedOwners.set(country.tag,allowed);
    if (!origin) continue;
    const queue = [origin.id],parents = new Map<string,string>();
    network.provinces.set(origin.id,info(origin,origin.id,0,terrainModifier(origin),occupied.has(origin.id) ? B.occupiedSupplyModifier : 1));
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const parent = network.provinces.get(queue[cursor])!;
      for (const id of neighbors.get(queue[cursor])!) {
        const p = provinceById.get(id);
        if (!p || network.provinces.has(id) || !allowed.has(p.owner)) continue;
        network.provinces.set(id,info(p,origin.id,parent.distance!+1,Math.min(parent.terrainModifier,terrainModifier(p)),
          Math.min(parent.occupationModifier,occupied.has(id) ? B.occupiedSupplyModifier : 1)));
        parents.set(id,queue[cursor]); queue.push(id);
      }
    }
    const descendants = new Map(queue.map(id => [id,provinceById.get(id)!.owner === country.tag ? 1 : 0]));
    for (const id of [...queue].reverse()) {
      const own = provinceById.get(id)!.owner === country.tag ? 1 : 0;
      network.provinces.get(id)!.dependentProvinces = descendants.get(id)!-own;
      const parent = parents.get(id);
      if (parent) descendants.set(parent,descendants.get(parent)!+descendants.get(id)!);
    }
  }
  return {networks,provinceById,hostile,allowedOwners,occupied};
}
/** Rebels deliberately retain local Military V2 supply instead of a national network. */
export function getProvinceLogistics(snapshot: LogisticsSnapshot | undefined,tag: string,provinceId: string): LogisticsInfo | undefined {
  if (!snapshot || tag.startsWith('rebel_')) return;
  const p = snapshot.provinceById.get(provinceId); if (!p) return;
  const network = snapshot.networks.get(tag),connected = network?.provinces.get(provinceId);
  return connected ?? info(p,network?.originId ?? null,null,terrainModifier(p),snapshot.occupied.has(provinceId) ? B.occupiedSupplyModifier : 1);
}

/** AI-only post-conquest estimate along its EXISTING movement path. No BFS,
 * territory mutation or permission to cross an unoccupied enemy at runtime. */
export function projectRouteLogistics(snapshot: LogisticsSnapshot,tag: string,fromId: string,path: string[]): LogisticsInfo | undefined {
  let current = getProvinceLogistics(snapshot,tag,fromId),previousId = fromId;
  for (const id of path) {
    const p = snapshot.provinceById.get(id),previous = snapshot.provinceById.get(previousId);
    if (!p || !previous?.neighbors.includes(id)) return;
    const known = getProvinceLogistics(snapshot,tag,id);
    if (known?.connected) current = known;
    else if (current?.connected && (snapshot.allowedOwners.get(tag)?.has(p.owner) || snapshot.hostile.get(tag)?.has(p.owner))) {
      current = info(p,current.originId,current.distance!+1,Math.min(current.terrainModifier,terrainModifier(p)),
        Math.min(current.occupationModifier,snapshot.hostile.get(tag)?.has(p.owner) ? B.occupiedSupplyModifier : 1));
    } else current = known;
    previousId = id;
  }
  return current;
}

export const LOGISTICS_CATEGORIES = [
  {id: 'strong',label: 'Conectado forte',color: '#238b45',minimum: 0.95},
  {id: 'moderate',label: 'Conectado moderado',color: '#8dcc72',minimum: 0.8},
  {id: 'distant',label: 'Distância alta',color: '#e6c547',minimum: 0.65},
  {id: 'weak',label: 'Rede fraca',color: '#e88b3a',minimum: 0},
  {id: 'disconnected',label: 'Desconectado',color: '#d64545',minimum: 0},
] as const;
export function logisticsCategory(logistics?: LogisticsInfo) {
  if (!logistics?.connected) return LOGISTICS_CATEGORIES[4];
  return LOGISTICS_CATEGORIES.slice(0,4).find(category => logistics.efficiency >= category.minimum)!;
}
