import type { ActiveBattle, Army, DiplomaticRelation, Province, War } from '../../types';
import type { AmphibiousCounters, Fleet, InvasionOrder, NavalState } from '../../types/naval';
import { applyTroopLoss, calculateArmySize } from '../combat/combatCalculations';
import { applyMilitaryCasualties } from '../population';
import { buildNavalHostility, canUseNavalPort, orderFleetMove } from './index';
import { isCoastalProvince, portByProvince } from './world';

export const TRANSPORT_CAPACITY = 5000;
export const LANDING_DAYS = 3;
export const fleetTransportCapacity = (fleet: Fleet): number => fleet.units.reduce((sum, unit) => sum + (unit.type === 'TRANSPORT' && unit.strength > 0 ? TRANSPORT_CAPACITY : 0), 0);
export const fleetTransportUsed = (armies: readonly Army[]): number => armies.reduce((sum, army) => sum + calculateArmySize(army), 0);
export function buildTransportIndexes(armies: readonly Army[]) {
  const byId = new Map<string, Army>(), byFleet = new Map<string, Army[]>();
  for (const army of armies) if (army.embarkedFleetId) {
    byId.set(army.id, army);
    const bucket = byFleet.get(army.embarkedFleetId) ?? [];
    bucket.push(army); byFleet.set(army.embarkedFleetId, bucket);
  }
  return { byId, byFleet };
}
type TransportContext = { armies: Army[]; naval: NavalState; provinces: Province[]; wars: War[]; relations: DiplomaticRelation[]; actor: string; activeBattles?: readonly ActiveBattle[] };
export function embarkArmy(ctx: TransportContext, armyId: string, fleetId: string): { armies: Army[]; error?: string } {
  const army = ctx.armies.find(a => a.id === armyId), fleet = ctx.naval.fleets.find(f => f.id === fleetId);
  const fail = (error: string) => ({ armies: ctx.armies, error });
  if (!army || army.owner !== ctx.actor) return fail('Selecione um Army próprio.');
  if (army.embarkedFleetId) return fail('Army já está embarcado.');
  if (!fleet || fleet.countryTag !== army.owner) return fail('Army e Fleet devem pertencer ao mesmo Country.');
  if (army.inCombat || ctx.activeBattles?.some(b => b.participantArmyIds.includes(armyId))) return fail('Army está em batalha.');
  const province = ctx.provinces.find(p => p.id === army.location);
  if (!province || !portByProvince.has(province.id)) return fail('Army não está em porto operacional.');
  if (fleet.status !== 'DOCKED' || fleet.portProvinceId !== province.id) return fail('Fleet não está DOCKED no mesmo porto.');
  if (!canUseNavalPort(ctx.actor, province, ctx.relations, buildNavalHostility(ctx.wars))) return fail('Acesso ao porto inválido.');
  const capacity = fleetTransportCapacity(fleet), used = fleetTransportUsed(buildTransportIndexes(ctx.armies).byFleet.get(fleet.id) ?? []), troops = calculateArmySize(army);
  if (!capacity) return fail('Fleet sem Transport suficiente.');
  if (troops <= 0) return fail('Army sem tropas.');
  if (troops > capacity - used) return fail(`Army grande demais: precisa de ${troops} vagas; disponível ${capacity - used} / ${capacity}.`);
  return { armies: ctx.armies.map(a => a.id === armyId ? { ...a, embarkedFleetId: fleetId, location: null, destination: null, targetDestination: null, path: [], movementPlan: undefined, movementProgress: 0, position: null, targetArmyId: null, targetProvinceId: null } : a) };
}
export function disembarkArmy(ctx: TransportContext, armyId: string): { armies: Army[]; error?: string } {
  const army = ctx.armies.find(a => a.id === armyId), fleet = ctx.naval.fleets.find(f => f.id === army?.embarkedFleetId);
  const fail = (error: string) => ({ armies: ctx.armies, error });
  if (!army || army.owner !== ctx.actor || !fleet || fleet.countryTag !== ctx.actor) return fail('Army não está embarcado em Fleet própria.');
  const province = ctx.provinces.find(p => p.id === fleet.portProvinceId);
  if (fleet.status !== 'DOCKED' || !province) return fail('Fleet precisa estar DOCKED para desembarcar.');
  if (ctx.naval.invasions?.some(o => o.fleetId === fleet.id)) return fail('Cancele a invasão antes de desembarcar.');
  if (!canUseNavalPort(ctx.actor, province, ctx.relations, buildNavalHostility(ctx.wars))) return fail('Acesso ao porto inválido: desembarque exige porto próprio, aliado ou military access.');
  return { armies: ctx.armies.map(a => a.id === armyId ? { ...a, embarkedFleetId: undefined, location: province.id } : a) };
}
export function planInvasion(ctx: TransportContext, fleetId: string, armyIds: string[], targetProvinceId: string): { naval: NavalState; error?: string } {
  const fail = (error: string) => ({ naval: ctx.naval, error });
  const fleet = ctx.naval.fleets.find(f => f.id === fleetId), target = ctx.provinces.find(p => p.id === targetProvinceId);
  if (!fleet || fleet.countryTag !== ctx.actor) return fail('Selecione uma Fleet própria.');
  if (fleet.status === 'COMBAT' || fleet.status === 'RETREATING') return fail('Fleet em combate ou retirada.');
  if (ctx.naval.invasions?.some(o => o.fleetId === fleetId)) return fail('Fleet já está comprometida com invasão.');
  if (!target || !isCoastalProvince(target.id)) return fail('Alvo não costeiro.');
  const port = portByProvince.get(target.id);
  if (!port) return fail('V1 exige costa com conexão naval de porto validada.');
  if (!buildNavalHostility(ctx.wars).get(ctx.actor)?.has(target.owner)) return fail('Não está em guerra com o owner do alvo.');
  const cargo = buildTransportIndexes(ctx.armies), selected = [...new Set(armyIds)];
  if (!selected.length || selected.some(id => cargo.byId.get(id)?.embarkedFleetId !== fleetId || cargo.byId.get(id)?.owner !== ctx.actor)) return fail('Selecione Armies embarcados nesta Fleet.');
  if (fleetTransportUsed(cargo.byFleet.get(fleetId) ?? []) > fleetTransportCapacity(fleet)) return fail('Fleet sem Transport suficiente.');
  const moved = orderFleetMove(fleet, port.seaNodeId, ctx.actor);
  if (!moved) return fail('Sem rota marítima até o alvo.');
  const order: InvasionOrder = { fleetId, armyIds: selected, targetProvinceId, targetOwner: target.owner, seaNodeId: port.seaNodeId, status: 'SAILING', landingDays: 0 };
  return { naval: { ...ctx.naval, fleets: ctx.naval.fleets.map(f => f.id === fleetId ? moved : f), invasions: [...(ctx.naval.invasions ?? []), order] } };
}
/** Naval formulas stay untouched. Call immediately after damage, before repair. */
export function resolveTransportLosses(naval: NavalState, armies: Army[], provinces: Province[]) {
  const cargo = buildTransportIndexes(armies), fleets = new Map(naval.fleets.map(f => [f.id, f]));
  const updates = new Map<string, Army>(), messages: Array<{ owner: string; message: string }> = [];
  const fleetLosses = new Map<string, number>();
  let troopLossesAtSea = 0;
  for (const [id, bucket] of cargo.byFleet) {
    const fleet = fleets.get(id), capacity = fleet ? fleetTransportCapacity(fleet) : 0, used = fleetTransportUsed(bucket);
    if (used <= capacity) continue;
    // Allocate surviving integer soldiers proportionally, in stable Army ID order.
    const sorted = [...bucket].sort((a, b) => a.id.localeCompare(b.id));
    let remaining = capacity, remainingTroops = used, lost = 0;
    for (const army of sorted) {
      const troops = calculateArmySize(army), keep = remainingTroops ? Math.floor(troops * remaining / remainingTroops) : 0;
      const damaged = applyTroopLoss(army, troops - keep);
      // The canonical loss helper can clamp a remainder in a tiny first regiment.
      // Finish any residual excess through the same helper, without changing its formula.
      let trimmed = damaged;
      while (calculateArmySize(trimmed) > keep) trimmed = applyTroopLoss(trimmed, calculateArmySize(trimmed) - keep);
      updates.set(army.id, trimmed); remaining -= keep; remainingTroops -= troops; lost += troops - calculateArmySize(trimmed);
    }
    fleetLosses.set(id, lost); troopLossesAtSea += lost;
    messages.push({ owner: bucket[0].owner, message: `${lost.toLocaleString()} tropas perdidas no mar em ${fleet?.name ?? id}${!fleet ? ' — Fleet destruída' : ''}.` });
  }
  if (!updates.size) return { naval, armies, provinces, troopLossesAtSea: 0, messages };
  const result = armies.map(a => updates.get(a.id) ?? a).filter(a => !a.embarkedFleetId || calculateArmySize(a) > 0);
  const affectedBefore = [...cargo.byId.values()].filter(a => updates.has(a.id)), affectedAfter = result.filter(a => updates.has(a.id));
  const latestBattle = new Map<string, typeof naval.battles[number]>(), battleLosses = new Map<string, number>();
  for (const battle of naval.battles) for (const id of [...battle.sideA, ...battle.sideB]) {
    if (fleetLosses.has(id) && battle.days > 0 && (!latestBattle.has(id) || latestBattle.get(id)!.startedAt <= battle.startedAt)) latestBattle.set(id, battle);
  }
  for (const [id, loss] of fleetLosses) { const battle = latestBattle.get(id); if (battle) battleLosses.set(battle.id, (battleLosses.get(battle.id) ?? 0) + loss); }
  const battles = naval.battles.map(b => battleLosses.has(b.id) ? { ...b, embarkedTroopLosses: (b.embarkedTroopLosses ?? 0) + battleLosses.get(b.id)! } : b);
  return { naval: { ...naval, battles }, armies: result, provinces: updates.size ? applyMilitaryCasualties(provinces, affectedBefore, affectedAfter) : provinces, troopLossesAtSea, messages };
}
/** Landing yields ordinary terrestrial arrival events; never writes territory ownership. */
export function amphibiousTick(naval: NavalState, armies: Army[], provinces: Province[], wars: War[], engagedThisTick: ReadonlySet<string> = new Set(), advance = true) {
  const cargo = buildTransportIndexes(armies);
  if (!naval.invasions?.length) return { naval, armies, arrivals: [] as Army[], messages: [] as Array<{ owner: string; message: string }>, counters: { embarkedArmies: cargo.byId.size, transportedTroops: fleetTransportUsed([...cargo.byId.values()]), activeLandings: 0, completedLandings: 0, troopLossesAtSea: 0 } };
  const fleets = new Map(naval.fleets.map(f => [f.id, f])), provinceById = new Map(provinces.map(p => [p.id, p])), hostility = buildNavalHostility(wars);
  const invasions: InvasionOrder[] = [], arrivals: Army[] = [], landed = new Set<string>();
  const messages: Array<{ owner: string; message: string }> = [];
  let completedLandings = 0;
  for (const original of naval.invasions ?? []) {
    const fleet = fleets.get(original.fleetId), target = provinceById.get(original.targetProvinceId);
    const canceled = !fleet || !target || target.owner !== original.targetOwner || !hostility.get(fleet.countryTag)?.has(target.owner)
      || fleet.status === 'COMBAT' || fleet.status === 'RETREATING'
      || engagedThisTick.has(original.fleetId)
      || original.armyIds.some(id => cargo.byId.get(id)?.embarkedFleetId !== original.fleetId);
    if (canceled) { messages.push({ owner: fleet?.countryTag ?? cargo.byId.get(original.armyIds[0])?.owner ?? '', message: 'Landing cancelado: combate naval, tropas ausentes, guerra encerrada ou owner do alvo alterado. Tropas sobreviventes permanecem embarcadas.' }); continue; }
    let order = original;
    if (advance && fleet.locationSeaNodeId === order.seaNodeId && fleet.movementProgress === 0 && fleet.status === 'HOLDING' && !fleet.portProvinceId) {
      order = { ...order, status: 'LANDING', landingDays: order.landingDays + 1 };
      if (order.landingDays >= LANDING_DAYS) {
        for (const id of order.armyIds) { const army = cargo.byId.get(id)!; arrivals.push({ ...army, embarkedFleetId: undefined, location: target.id }); landed.add(id); }
        completedLandings++;
        messages.push({ owner: fleet.countryTag, message: `Desembarque concluído em ${target.name}.` });
        continue;
      }
    } else if (order.status === 'LANDING' && (fleet.locationSeaNodeId !== order.seaNodeId || fleet.status !== 'HOLDING' || fleet.movementProgress !== 0 || !!fleet.portProvinceId)) { messages.push({ owner: fleet.countryTag, message: 'Landing cancelado: Fleet deixou o ponto de desembarque.' }); continue; }
    invasions.push(order);
  }
  const counters: AmphibiousCounters = { embarkedArmies: cargo.byId.size - landed.size, transportedTroops: [...cargo.byId.values()].filter(a => !landed.has(a.id)).reduce((sum, a) => sum + calculateArmySize(a), 0), activeLandings: invasions.filter(o => o.status === 'LANDING').length, completedLandings, troopLossesAtSea: 0 };
  return { naval: { ...naval, invasions }, armies: landed.size ? armies.filter(a => !landed.has(a.id)) : armies, arrivals, messages, counters };
}
