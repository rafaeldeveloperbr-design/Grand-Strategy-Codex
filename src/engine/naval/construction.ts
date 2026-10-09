import type { Country, Province, War } from '../../types';
import type { NavalConstructionState, NavalState, NavalUnitType } from '../../types/naval';
import { NAVAL_AI_CONSTRUCTION as AI, NAVAL_BUILD_CONFIG, NAVAL_QUEUE_LIMIT, SHIPYARD_SPEED, SHIPYARD_UPGRADES, type NavalConstructionCost } from '../../data/navalConstruction';
import { createNavalUnit } from '../../data/navalUnits';
import { navalPorts, portByProvince } from './world';

export const emptyNavalConstruction = (): NavalConstructionState => ({ shipyards: [], builds: [], upgrades: [], nextId: 1 });
export function createInitialShipyards(countries: readonly Country[], provinces: readonly Province[]): NavalConstructionState {
  const byProvince = new Map(provinces.map(p => [p.id, p])), byCountry = new Map(countries.map(c => [c.tag, c]));
  const shipyards = navalPorts.flatMap(port => {
    const p = byProvince.get(port.provinceId), c = p && byCountry.get(p.owner);
    if (!p || !c || c.isAnnexed) return [];
    // Initial income can be zero before the first economy tick; treasury is the fallback.
    const economicCapacity=Math.max(c.economy.goldIncome,c.resources.gold/100);
    const level = port.level===3 && p.development>=6 && economicCapacity>=5 ? 2
      : port.level>=2 && p.development>=4 ? 1 : port.level===1 && p.development>=8 && economicCapacity>=10 ? 1 : 0;
    return level ? [{ provinceId: p.id, level }] : [];
  });
  for (const tag of ['USA','GBR','JPN','FRA','ITA','DEU','BRA','CHN','RUS','IND','AUS']) {
    if (shipyards.some(s => byProvince.get(s.provinceId)?.owner === tag)) continue;
    const port = navalPorts.filter(s => byProvince.get(s.provinceId)?.owner === tag).sort((a,b) => b.level-a.level || a.provinceId.localeCompare(b.provinceId))[0];
    if (port) shipyards.push({ provinceId: port.provinceId, level: 1 });
  }
  return { ...emptyNavalConstruction(), shipyards: shipyards.sort((a,b) => a.provinceId.localeCompare(b.provinceId)) };
}
export const shipyardLevel = (state: NavalState, provinceId: string) => state.construction?.shipyards.find(s => s.provinceId === provinceId)?.level ?? 0;
export function navalConstructionBlockReason(state: NavalState, province: Province, country: Country, actor: string, type: NavalUnitType | 'UPGRADE'): string | null {
  if (!portByProvince.has(province.id)) return 'Requer porto operacional.';
  if (province.owner !== actor || country.tag !== actor || country.isAnnexed) return 'Requer porto próprio.';
  const level = shipyardLevel(state, province.id), construction = state.construction;
  if (construction?.upgrades.some(u => u.provinceId === province.id)) return 'Shipyard em upgrade; produção pausada.';
  if (type === 'UPGRADE' && level >= 3) return 'Shipyard no nível máximo.';
  if (type !== 'UPGRADE' && level < NAVAL_BUILD_CONFIG[type].level) return `Requer shipyard nível ${NAVAL_BUILD_CONFIG[type].level}.`;
  if (type !== 'UPGRADE' && (construction?.builds.filter(b => b.provinceId === province.id).length ?? 0) >= NAVAL_QUEUE_LIMIT) return 'Fila naval cheia (5).';
  const cost = type === 'UPGRADE' ? SHIPYARD_UPGRADES[level] : NAVAL_BUILD_CONFIG[type];
  if (country.resources.gold < cost.gold) return 'Ouro insuficiente.';
  if ((province.market?.goods.iron.stock ?? 0) < cost.iron) return 'IRON local insuficiente.';
  if ((province.market?.goods.tools.stock ?? 0) < cost.tools) return 'TOOLS local insuficiente.';
  return null;
}
export function payLocalProductionCost(provinces: Province[], countries: Country[], provinceId: string, tag: string, cost: NavalConstructionCost) {
  return {
    countries: countries.map(c => c.tag === tag ? { ...c, resources: { ...c.resources, gold: c.resources.gold-cost.gold } } : c),
    provinces: provinces.map(p => p.id === provinceId && p.market ? { ...p, market: { ...p.market, goods: { ...p.market.goods,
      iron: { ...p.market.goods.iron, stock: p.market.goods.iron.stock-cost.iron }, tools: { ...p.market.goods.tools, stock: p.market.goods.tools.stock-cost.tools },
    } } } : p),
  };
}
export function startNavalConstruction(naval: NavalState, provinces: Province[], countries: Country[], actor: string, provinceId: string, type: NavalUnitType | 'UPGRADE', day: number, targetFleetId?: string) {
  const p = provinces.find(p => p.id === provinceId), country = countries.find(c => c.tag === actor);
  const error = !p || !country ? 'Porto ou país inexistente.' : navalConstructionBlockReason(naval, p, country, actor, type);
  if (error || !p || !country) return { naval, provinces, countries, error };
  const state = naval.construction ?? emptyNavalConstruction(), level = shipyardLevel(naval, provinceId);
  const config = type === 'UPGRADE' ? SHIPYARD_UPGRADES[level] : NAVAL_BUILD_CONFIG[type];
  const id = `naval-build-${state.nextId}`, base = { id, countryTag: actor, provinceId, progress: 0, requiredProgress: config.days, startedAt: day };
  const construction: NavalConstructionState = type === 'UPGRADE'
    ? { ...state, nextId: state.nextId+1, upgrades: [...state.upgrades, { ...base, targetLevel: level+1 }] }
    : { ...state, nextId: state.nextId+1, builds: [...state.builds, { ...base, unitType: type, ...(targetFleetId && naval.fleets.some(f => f.id === targetFleetId && f.countryTag === actor) ? { targetFleetId } : {}) }] };
  return { naval: { ...naval, construction }, ...payLocalProductionCost(provinces,countries,provinceId,actor,config), error: null };
}
/** Cancel paid orders/upgrades with zero refund, including queued items. */
export function cancelNavalConstruction(naval: NavalState, id: string, actor: string): NavalState {
  if (!naval.construction) return naval;
  return { ...naval, construction: { ...naval.construction,
    builds: naval.construction.builds.filter(b => b.id !== id || b.countryTag !== actor),
    upgrades: naval.construction.upgrades.filter(b => b.id !== id || b.countryTag !== actor),
  } };
}
export function processNavalConstructionTick(naval: NavalState, provinces: readonly Province[], countries: readonly Country[]) {
  const counters = { activeNavalBuilds: 0, queuedNavalBuilds: 0, completedShips: 0, shipyardUpgrades: 0 };
  if (!naval.construction) return { naval, counters };
  const state = naval.construction, provinceById = new Map(provinces.map(p => [p.id,p])), countryByTag = new Map(countries.map(c => [c.tag,c]));
  const valid = (b: { provinceId: string; countryTag: string }) => provinceById.get(b.provinceId)?.owner === b.countryTag && !countryByTag.get(b.countryTag)?.isAnnexed && countryByTag.has(b.countryTag) && portByProvince.has(b.provinceId);
  const levels = new Map(state.shipyards.filter(s => portByProvince.has(s.provinceId) && provinceById.has(s.provinceId)).map(s => [s.provinceId,s.level]));
  const upgrading = new Set(state.upgrades.filter(valid).map(u => u.provinceId));
  const upgrades = state.upgrades.filter(valid).flatMap(u => {
    const progress = u.progress+1;
    if (progress < u.requiredProgress) return [{ ...u, progress }];
    levels.set(u.provinceId,u.targetLevel); counters.shipyardUpgrades++; return [];
  });
  const fleets = [...naval.fleets], byPort = new Map<string, typeof fleets>();
  for (const f of fleets) if (f.status === 'DOCKED' && f.portProvinceId) { const list = byPort.get(f.portProvinceId) ?? []; list.push(f); byPort.set(f.portProvinceId,list); }
  let nextId = state.nextId;
  const active = new Set<string>();
  const builds = state.builds.filter(valid).flatMap(order => {
    if (upgrading.has(order.provinceId) || active.has(order.provinceId) || !levels.get(order.provinceId)) { counters.queuedNavalBuilds++; return [order]; }
    active.add(order.provinceId); counters.activeNavalBuilds++;
    const progress = order.progress+SHIPYARD_SPEED[levels.get(order.provinceId)!];
    if (progress < order.requiredProgress) return [{ ...order, progress }];
    const unit = createNavalUnit(`ship-${order.id}`,order.unitType);
    const candidates = (byPort.get(order.provinceId) ?? []).filter(f => f.countryTag === order.countryTag).sort((a,b) => a.id.localeCompare(b.id));
    const target = candidates.find(f => f.id === order.targetFleetId) ?? candidates[0];
    if (target) {
      const updated = { ...target, units: [...target.units,unit] }; fleets[fleets.findIndex(f => f.id === target.id)] = updated;
      byPort.set(order.provinceId,(byPort.get(order.provinceId) ?? []).map(f => f.id === target.id ? updated : f));
    } else {
      let id = `fleet-built-${nextId++}`; while (fleets.some(f => f.id === id)) id = `fleet-built-${nextId++}`;
      const ordinal = fleets.filter(f => f.countryTag === order.countryTag).reduce((max,f) => Math.max(max,Number(f.name.match(/(\d+)ª Frota/)?.[1] ?? 0)),0)+1;
      const created = { id, countryTag: order.countryTag, name: `${countryByTag.get(order.countryTag)!.name} · ${ordinal}ª Frota`, units: [unit], portProvinceId: order.provinceId, route: [], movementProgress: 0, status: 'DOCKED' as const };
      fleets.push(created); const list = byPort.get(order.provinceId) ?? []; list.push(created); byPort.set(order.provinceId,list);
    }
    counters.completedShips++; return [];
  });
  return { naval: { ...naval, fleets, construction: { shipyards: [...levels].map(([provinceId,level]) => ({provinceId,level})), builds, upgrades, nextId } }, counters };
}
/** At most one paid order per FULL country/day; player and PASSIVE never initiate. */
export function navalConstructionAI(naval: NavalState, provinces: Province[], countries: Country[], full: Set<string>, player: string, wars: readonly War[], day: number) {
  let result = { naval, provinces, countries };
  const countryByTag = new Map(countries.map(c => [c.tag,c])), provinceById = new Map(provinces.map(p => [p.id,p]));
  const fleetsByCountry = new Map<string, number>(); for (const f of naval.fleets) fleetsByCountry.set(f.countryTag,(fleetsByCountry.get(f.countryTag) ?? 0)+f.units.length);
  const buildsByCountry = new Map<string,number>(); for (const b of naval.construction?.builds ?? []) buildsByCountry.set(b.countryTag,(buildsByCountry.get(b.countryTag) ?? 0)+1);
  const yardsByCountry = new Map<string,string[]>(); for (const s of navalPorts) { const tag = provinceById.get(s.provinceId)?.owner; if (tag) {const list=yardsByCountry.get(tag)??[];list.push(s.provinceId);yardsByCountry.set(tag,list);} }
  const busyPorts = new Set([...(naval.construction?.builds ?? []),...(naval.construction?.upgrades ?? [])].map(b=>b.provinceId));
  const levelsByProvince = new Map((naval.construction?.shipyards ?? []).map(s=>[s.provinceId,s.level]));
  const atWar = new Set(wars.flatMap(w => [w.attacker,w.defender]));
  for (const tag of [...full].sort()) {
    const c = countryByTag.get(tag); if (tag===player || !c || c.isAnnexed || c.resources.gold<AI.reserve || c.economy.goldIncome<=c.economy.goldExpense) continue;
    const count=(fleetsByCountry.get(tag)??0)+(buildsByCountry.get(tag)??0), cap=atWar.has(tag)?AI.warShips:AI.peaceShips;
    const budget=Math.min(c.resources.gold*AI.dailyGoldFraction,c.resources.gold-AI.reserve);
    for (const provinceId of (yardsByCountry.get(tag)??[]).sort()) {
      if (busyPorts.has(provinceId)) continue;
      const level=levelsByProvince.get(provinceId)??0;
      const type: NavalUnitType|'UPGRADE' = level===0 ? 'UPGRADE' : count===0 || atWar.has(tag) || level>=2 ? 'DESTROYER' : 'UPGRADE';
      if (type!=='UPGRADE'&&count>=cap || type==='UPGRADE'&&(atWar.has(tag)||level>=2)) continue;
      const cost=type==='UPGRADE'?SHIPYARD_UPGRADES[level]:NAVAL_BUILD_CONFIG[type]; if(cost.gold>budget)continue;
      const started=startNavalConstruction(result.naval,result.provinces,result.countries,tag,provinceId,type,day);
      if(!started.error){result=started;busyPorts.add(provinceId);break;}
    }
  }
  return result;
}
