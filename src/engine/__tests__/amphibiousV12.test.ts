// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Army, DiplomaticRelation } from '../../types';
import { countries } from '../../data/map';
import { createNavalUnit } from '../../data/navalUnits';
import { transportFixture } from './transportFixture';
import { AMPHIBIOUS_BEACH_EXTRACTION_DAYS, beachExtractionTick, cancelBeachExtraction, startBeachExtraction } from '../naval/beachExtraction';
import { amphibiousTick, buildTransportIndexes, disembarkArmy, embarkArmy, fleetTransportCapacity, fleetTransportUsed, planInvasion, resolveTransportLosses } from '../naval/transport';
import { navalMovementTick, navalPorts, orderFleetMove, orderFleetReturn, portByProvince, resolveAmphibiousLandingSeaNode, seaNodes } from '../naval';
import { validateTransportSave } from '../naval/transportSave';
import { clearMovementPlan, getArmyReorganizationBlockReason, issueMoveCommand, processArmyMovement } from '../military';
import { processBattleArrival } from '../../hooks/gameLoop/battleArrivalTick';
import { processBattleDay } from '../combat';
import { createInitialTechState } from '../technology';
import { loadGame, saveGame } from '../saveSystem';
import * as territory from '../territoryTransfer';

const beachId = 'sa_arg_restored_1';
const date = { year: 1444, month: 11, day: 1 };
function setup(troops = 3600) {
  const s = transportFixture(troops);
  s.target = s.ctx.provinces.find(p => p.id === beachId)!;
  s.target.owner = 'BRA'; // Fixture represents an already occupied coast.
  s.army.location = beachId;
  s.ctx.naval.fleets[0] = { ...s.fleet, portProvinceId: undefined, locationSeaNodeId: resolveAmphibiousLandingSeaNode(beachId)!.id, status: 'HOLDING' };
  return s;
}
function start(s = setup()) {
  const result = embarkArmy(s.ctx, s.army.id, s.fleet.id);
  expect(result.error).toBeUndefined(); s.ctx.armies = result.armies;
  return s;
}
function tick(s: ReturnType<typeof setup>, days = 1) {
  let result = beachExtractionTick(s.ctx);
  s.ctx.armies = result.armies;
  for (let i = 1; i < days; i++) { result = beachExtractionTick(s.ctx); s.ctx.armies = result.armies; }
  return result;
}
function saveRefs(s: ReturnType<typeof setup>) {
  return { dateRef: { current: date }, provincesRef: { current: s.ctx.provinces }, countriesRef: { current: structuredClone(countries) }, armiesRef: { current: s.ctx.armies }, warsRef: { current: s.ctx.wars }, diplomaticRelationsRef: { current: s.ctx.relations }, recruitmentsRef: { current: [] }, buildingConstructionsRef: { current: [] }, activeBattlesRef: { current: [] }, playerTechStateRef: { current: createInitialTechState('BRA') }, botTechStatesRef: { current: new Map() }, navalStateRef: { current: s.ctx.naval } };
}
function arrival(s: ReturnType<typeof setup>, incoming: Army[], existing = s.ctx.armies) {
  return processBattleArrival({ arrivedArmies: incoming, armies: existing, provinces: s.ctx.provinces, countries: structuredClone(countries), wars: s.ctx.wars, relations: s.ctx.relations, recruitments: [], buildingConstructions: [], currentActiveBattles: [], snapshot: { date }, playerCountryTag: 'BRA', allCountries: countries, activeBattlesRef: { current: [] }, addLog: vi.fn(), addToast: vi.fn(), setActiveBattles: vi.fn(), cancelProvinceActivities: (_id, _old, _new, rec, cons, provs) => ({ recruitments: rec, constructions: cons, provinces: provs }) });
}
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('Beach extraction V1.2', () => {
  it('preserves instant port embark and 5000 soldiers per TRANSPORT', () => {
    const s = transportFixture(), result = embarkArmy(s.ctx, s.army.id, s.fleet.id);
    expect(result.error).toBeUndefined(); expect(result.armies[0].embarkedFleetId).toBe(s.fleet.id);
    expect(result.armies[0].beachExtraction).toBeUndefined(); expect(fleetTransportCapacity(s.fleet)).toBe(5000);
  });
  it('starts on the canonical Tierra del Fuego node, without embarking immediately', () => {
    const s = start(), a = s.ctx.armies[0];
    expect(a.location).toBe(beachId); expect(a.embarkedFleetId).toBeUndefined();
    expect(a.beachExtraction).toEqual({ fleetId: s.fleet.id, provinceId: beachId, seaNodeId: resolveAmphibiousLandingSeaNode(beachId)!.id, elapsedDays: 0 });
  });
  it('keeps land presence for four days, completes on day five, and clears every land order', () => {
    const s = start(), fleet = structuredClone(s.ctx.naval.fleets[0]), provinces = structuredClone(s.ctx.provinces);
    expect(AMPHIBIOUS_BEACH_EXTRACTION_DAYS).toBe(5);
    for (let day = 1; day < 5; day++) {
      tick(s); expect(s.ctx.armies[0]).toMatchObject({ location: beachId, beachExtraction: { elapsedDays: day } });
      expect(s.ctx.armies[0].embarkedFleetId).toBeUndefined();
      expect(processArmyMovement(s.ctx.armies, s.ctx.provinces, s.ctx.relations).updatedArmies[0].location).toBe(beachId);
    }
    tick(s); expect(s.ctx.armies[0]).toMatchObject({ embarkedFleetId: s.fleet.id, location: null, destination: null, targetDestination: null, path: [], position: null, movementProgress: 0, targetArmyId: null, targetProvinceId: null });
    expect(s.ctx.armies[0].beachExtraction).toBeUndefined(); expect(s.ctx.armies[0].movementPlan).toBeUndefined();
    expect(s.ctx.naval.fleets[0]).toEqual(fleet); expect(s.ctx.provinces).toEqual(provinces);
    expect(portByProvince.has(beachId)).toBe(false);
    expect(tick(s).messages).toEqual([]);
  });
  it.each(['sa_bra_mato_grosso', 'as_aze_baku'])('rejects inland/lake-only province %s', id => {
    const s = setup(); s.army.location = id;
    expect(embarkArmy(s.ctx, s.army.id, s.fleet.id).error).toMatch(/não costeiro|lago\/interior/);
  });
  it('rejects a globally nearby/wrong node', () => {
    const s = setup(); s.ctx.naval.fleets[0].locationSeaNodeId = seaNodes.find(n => n.id !== resolveAmphibiousLandingSeaNode(beachId)!.id)!.id;
    expect(embarkArmy(s.ctx, s.army.id, s.fleet.id).error).toContain('SeaNode correto');
  });
  it.each(['COMBAT', 'RETREATING', 'MOVING'] as const)('rejects Fleet status %s', status => {
    const s = setup(); s.ctx.naval.fleets[0].status = status; expect(embarkArmy(s.ctx, s.army.id, s.fleet.id).error).toBeDefined();
  });
  it('rejects an Army in combat or active Battle even with a stale combat flag', () => {
    const s = setup(); s.army.inCombat = true; expect(embarkArmy(s.ctx, s.army.id, s.fleet.id).error).toContain('batalha');
    s.army.inCombat = false;
    const b = arrival(s, [{ ...s.army, id: 'hostile', owner: 'ARG' }]);
    expect(embarkArmy({ ...s.ctx, activeBattles: b.currentActiveBattles }, s.army.id, s.fleet.id).error).toContain('batalha');
  });
  it('rejects retreat protection and pending terrestrial movement', () => {
    const s = setup(); s.army.retreatProtectionDays = 2;
    expect(embarkArmy(s.ctx, s.army.id, s.fleet.id).error).toContain('retirada');
    s.army.retreatProtectionDays = 0; s.army.destination = 'other';
    expect(embarkArmy(s.ctx, s.army.id, s.fleet.id).error).toContain('movimento');
  });
  it('requires same owner/controller and actor', () => {
    const s = setup(); expect(startBeachExtraction({ ...s.ctx, actor: 'ARG' }, s.army.id, s.fleet.id).error).toBeDefined();
    s.ctx.naval.fleets[0].countryTag = 'ARG'; expect(embarkArmy(s.ctx, s.army.id, s.fleet.id).error).toContain('mesmo Country');
  });
  it('rejects inaccessible or hostile coasts', () => {
    const s = setup(); s.target.owner = 'CHL'; expect(embarkArmy(s.ctx, s.army.id, s.fleet.id).error).toContain('Acesso');
    s.target.owner = 'ARG'; expect(embarkArmy(s.ctx, s.army.id, s.fleet.id).error).toContain('Acesso');
  });
  it.each(['alliance', 'access'])('uses the existing %s access contract', mode => {
    const s = setup(); s.target.owner = 'CHL';
    s.ctx.relations = [{ countryA: 'BRA', countryB: 'CHL', status: 'peace', opinion: 0, trust: 50, ...(mode === 'alliance' ? { alliance: { since: 0 } } : { militaryAccess: ['CHL'] }) }];
    expect(embarkArmy(s.ctx, s.army.id, s.fleet.id).error).toBeUndefined();
  });
  it('rejects insufficient capacity without partial embark', () => {
    const s = setup(6000); expect(embarkArmy(s.ctx, s.army.id, s.fleet.id).error).toContain('insuficiente'); expect(s.army.location).toBe(beachId);
  });
  it('accounts for cargo already aboard when reserving extraction', () => {
    const s = setup(2000); s.ctx.armies.push({ ...s.army, id: 'aboard', embarkedFleetId: s.fleet.id, location: null, regiments: [{ type: 'infantry', strength: 4000, morale: 100 }] });
    expect(embarkArmy(s.ctx, s.army.id, s.fleet.id).error).toContain('insuficiente');
  });
  it('prevents overbooking between armies and releases reservation on player cancellation', () => {
    const s = start(setup(3000)), other = { ...s.army, id: 'second' }; s.ctx.armies.push(other);
    expect(embarkArmy(s.ctx, other.id, s.fleet.id).error).toContain('reservas');
    expect(buildTransportIndexes(s.ctx.armies).extractionsByFleet.get(s.fleet.id)).toHaveLength(1);
    s.ctx.armies = cancelBeachExtraction(s.ctx.armies, s.army.id, 'ARG'); expect(s.ctx.armies[0].beachExtraction).toBeDefined();
    s.ctx.armies = cancelBeachExtraction(s.ctx.armies, s.army.id, 'BRA');
    expect(embarkArmy(s.ctx, other.id, s.fleet.id).error).toBeUndefined();
  });
  it('completes multiple reservations deterministically without overbooking', () => {
    const s = start(setup(2000)), other = { ...s.army, id: 'second', regiments: [{ type: 'infantry' as const, strength: 3000, morale: 100 }] }; s.ctx.armies.push(other);
    s.ctx.armies = embarkArmy(s.ctx, other.id, s.fleet.id).armies;
    const reverse = { ...s.ctx, armies: [...s.ctx.armies].reverse() };
    let a = s.ctx.armies, b = reverse.armies;
    for (let i = 0; i < 5; i++) { a = beachExtractionTick({ ...s.ctx, armies: a }).armies; b = beachExtractionTick({ ...reverse, armies: b }).armies; }
    expect(a).toEqual(b.reverse()); expect(fleetTransportUsed(a)).toBe(5000); expect(a.every(a => a.embarkedFleetId === s.fleet.id)).toBe(true);
    expect(buildTransportIndexes(a).extractionsByFleet.size).toBe(0);
  });
  it('cancels all oversubscribed reservations after capacity loss, preserving terrestrial troops', () => {
    const s = setup(3000); s.ctx.naval.fleets[0].units.push(createNavalUnit('extra', 'TRANSPORT')); start(s);
    const other = { ...s.army, id: 'second' }; s.ctx.armies.push(other); s.ctx.armies = embarkArmy(s.ctx, other.id, s.fleet.id).armies;
    s.ctx.naval.fleets[0].units = s.ctx.naval.fleets[0].units.filter(u => u.id !== 'extra');
    const r = tick(s); expect(r.armies.every(a => !a.beachExtraction && a.location === beachId)).toBe(true); expect(fleetTransportUsed(r.armies)).toBe(6000);
    expect(buildTransportIndexes(r.armies).extractionsByFleet.size).toBe(0);
  });
  it('continues after capacity loss when remaining transports are sufficient', () => {
    const s = setup(); s.ctx.naval.fleets[0].units.push(createNavalUnit('extra', 'TRANSPORT')); start(s);
    s.ctx.naval.fleets[0].units = s.ctx.naval.fleets[0].units.filter(u => u.id !== 'extra');
    expect(tick(s).armies[0].beachExtraction?.elapsedDays).toBe(1);
  });
  it.each(['fleet_move', 'fleet_destroyed', 'invalid_coast', 'node_changed', 'access_revoked', 'war_changed', 'moving_army', 'combat_army', 'retreat', 'empty_army'] as const)('safely cancels %s', reason => {
    const s = start();
    if (reason === 'fleet_move') s.ctx.naval.fleets[0] = orderFleetMove(s.ctx.naval.fleets[0], seaNodes.find(n => n.id !== resolveAmphibiousLandingSeaNode(beachId)!.id)!.id, 'BRA')!;
    if (reason === 'fleet_destroyed') s.ctx.naval.fleets = [];
    if (reason === 'invalid_coast') s.ctx.provinces = s.ctx.provinces.filter(p => p.id !== beachId);
    if (reason === 'node_changed') s.ctx.armies[0].beachExtraction!.seaNodeId = 'missing';
    if (reason === 'access_revoked') s.target.owner = 'CHL';
    if (reason === 'war_changed') { s.target.owner = 'ARG'; }
    if (reason === 'moving_army') s.ctx.armies[0].destination = 'other';
    if (reason === 'combat_army') s.ctx.armies[0].inCombat = true;
    if (reason === 'retreat') s.ctx.armies[0].retreatProtectionDays = 2;
    if (reason === 'empty_army') s.ctx.armies[0].regiments = [];
    const result = tick(s); expect(result.armies[0].beachExtraction).toBeUndefined(); expect(result.armies[0].embarkedFleetId).toBeUndefined();
    expect(buildTransportIndexes(result.armies).extractionsByFleet.size).toBe(0); expect(result.messages[0].message).toContain('cancelada');
  });
  it('destroying an extracting Army leaves no reservation or Fleet cargo metadata', () => {
    const s = start(); s.ctx.armies = []; expect(tick(s).armies).toEqual([]); expect(buildTransportIndexes(s.ctx.armies).extractionsByFleet.size).toBe(0);
  });
  it('cancels a naval engagement that ended in the same tick, without naval troop losses', () => {
    const s = start(), result = beachExtractionTick(s.ctx, new Set([s.fleet.id]));
    expect(result.armies[0].beachExtraction).toBeUndefined();
    expect(resolveTransportLosses({ ...s.ctx.naval, fleets: [] }, result.armies, s.ctx.provinces).troopLossesAtSea).toBe(0);
  });
  it('does not advance twice during cleanup revalidation', () => {
    const s = start(); tick(s);
    expect(beachExtractionTick(s.ctx, new Set(), false).armies[0].beachExtraction?.elapsedDays).toBe(1);
  });
  it('clears metadata immediately on accepted movement/clear orders, but preserves it on rejected orders', () => {
    const s = start(), a = s.ctx.armies[0], destination = { ...s.target, id: 'other', neighbors: [beachId] }, source = { ...s.target, neighbors: ['other'] };
    expect(issueMoveCommand(a, 'missing', [source, destination], [])).toBeNull(); expect(a.beachExtraction).toBeDefined();
    expect(issueMoveCommand(a, 'other', [source, destination], [])!.beachExtraction).toBeUndefined();
    expect(clearMovementPlan(a).beachExtraction).toBeUndefined();
    expect(getArmyReorganizationBlockReason(a, { armies: s.ctx.armies, provinces: s.ctx.provinces, playerCountryTag: 'BRA' })).toContain('extração');
  });
  it('an enemy arrival on day five starts Battle V3 before extraction completion; the Army fights normally', () => {
    const s = start(); tick(s, 4);
    const transfer = vi.spyOn(territory, 'transferProvince');
    const result = arrival(s, [{ ...s.army, id: 'enemy', owner: 'ARG' }]);
    expect(result.currentActiveBattles).toHaveLength(1);
    const extraction = beachExtractionTick({ ...s.ctx, armies: result.armies, activeBattles: result.currentActiveBattles });
    const a = extraction.armies.find(a => a.id === s.army.id)!;
    expect(a.beachExtraction).toBeUndefined(); expect(a.embarkedFleetId).toBeUndefined(); expect(a.inCombat).toBe(true); expect(a.location).toBe(beachId);
    const fought = processBattleDay(result.currentActiveBattles[0], extraction.armies, s.target, s.ctx.provinces);
    expect(fought.battle.durationDays).toBeGreaterThan(0); expect(transfer).not.toHaveBeenCalled();
  });
  it('never writes ownership or calls transferProvince during extraction', () => {
    const s = start(), transfer = vi.spyOn(territory, 'transferProvince'), original = structuredClone(s.ctx.provinces);
    tick(s, 5); expect(transfer).not.toHaveBeenCalled(); expect(s.ctx.provinces).toEqual(original);
  });
  it('supports an AI actor through the same API without player-only restrictions', () => {
    const s = setup(); s.army.owner = 'ARG'; s.target.owner = 'ARG'; s.ctx.naval.fleets[0].countryTag = 'ARG'; s.ctx.actor = 'ARG';
    expect(startBeachExtraction(s.ctx, s.army.id, s.fleet.id).error).toBeUndefined();
  });
});

describe('Extraction Save V3', () => {
  it('preserves Fleet, coast and elapsed days and completes exactly once after load', () => {
    const s = start(); tick(s, 2);
    expect(saveGame(saveRefs(s), 'extraction')).toBe(true);
    const loaded = loadGame('extraction')!; expect(loaded.version).toBe(3);
    expect(loaded.military.armies[0].beachExtraction).toEqual(s.ctx.armies[0].beachExtraction);
    s.ctx.armies = loaded.military.armies; s.ctx.naval = loaded.naval!; s.ctx.provinces = loaded.world.provinces;
    tick(s, 2); expect(s.ctx.armies[0].beachExtraction?.elapsedDays).toBe(4);
    tick(s); expect(s.ctx.armies[0].embarkedFleetId).toBe(s.fleet.id);
    expect(saveGame(saveRefs(s), 'completed')).toBe(true); expect(loadGame('completed')!.military.armies[0].beachExtraction).toBeUndefined();
  });
  it('old saves with no extraction field remain compatible', () => {
    const s = setup(); expect(saveGame(saveRefs(s), 'old')).toBe(true);
    expect(loadGame('old')!.military.armies[0].beachExtraction).toBeUndefined();
  });
  it.each(['missing_fleet', 'foreign_fleet', 'wrong_node', 'missing_province', 'port', 'negative_days', 'five_days', 'fraction_days', 'null', 'combat', 'movement', 'embarked', 'capacity'] as const)('rejects corrupt %s extraction save', reason => {
    const s = start(), a = s.ctx.armies[0];
    if (reason === 'missing_fleet') a.beachExtraction!.fleetId = 'missing';
    if (reason === 'foreign_fleet') s.ctx.naval.fleets[0].countryTag = 'ARG';
    if (reason === 'wrong_node') a.beachExtraction!.seaNodeId = 'missing';
    if (reason === 'missing_province') a.beachExtraction!.provinceId = 'missing';
    if (reason === 'port') { a.beachExtraction!.provinceId = s.fleet.portProvinceId!; a.location = s.fleet.portProvinceId!; }
    if (reason === 'negative_days') a.beachExtraction!.elapsedDays = -1;
    if (reason === 'five_days') a.beachExtraction!.elapsedDays = 5;
    if (reason === 'fraction_days') a.beachExtraction!.elapsedDays = 1.5;
    if (reason === 'null') Object.assign(a, { beachExtraction: null });
    if (reason === 'combat') a.inCombat = true;
    if (reason === 'movement') a.destination = 'other';
    if (reason === 'embarked') a.embarkedFleetId = s.fleet.id;
    if (reason === 'capacity') s.ctx.naval.fleets[0].units = [];
    expect(() => validateTransportSave(s.ctx.armies, s.ctx.naval, s.ctx.provinces)).toThrow();
  });
});

describe('Real port → Tierra del Fuego → extraction → friendly Port C round trip', () => {
  it('uses real naval paths, occupation, extraction and port disembark with no stale state', () => {
    const s = transportFixture(), transfer = vi.spyOn(territory, 'transferProvince');
    const portA = s.fleet.portProvinceId!, beach = s.ctx.provinces.find(p => p.id === beachId)!; s.target = beach;
    s.ctx.armies = embarkArmy(s.ctx, s.army.id, s.fleet.id).armies;
    const invasion = planInvasion(s.ctx, s.fleet.id, [s.army.id], beachId); expect(invasion.error).toBeUndefined(); s.ctx.naval = invasion.naval;
    for (let i = 0; i < 500 && s.ctx.naval.fleets[0].status === 'MOVING'; i++) s.ctx.naval.fleets = navalMovementTick(s.ctx.naval.fleets, s.ctx.provinces, [], s.ctx.wars);
    expect(s.ctx.naval.fleets[0].locationSeaNodeId).toBe(resolveAmphibiousLandingSeaNode(beachId)!.id);
    let landing = amphibiousTick(s.ctx.naval, s.ctx.armies, s.ctx.provinces, s.ctx.wars);
    for (let day = 1; day < 5; day++) landing = amphibiousTick(landing.naval, landing.armies, s.ctx.provinces, s.ctx.wars);
    expect(landing.arrivals).toHaveLength(1); s.ctx.naval = landing.naval;
    const occupied = arrival(s, landing.arrivals, landing.armies); s.ctx.armies = occupied.armies; s.ctx.provinces = occupied.provinces;
    expect(s.ctx.provinces.find(p => p.id === beachId)!.owner).toBe('BRA'); expect(transfer).toHaveBeenCalledOnce();
    start(s); tick(s, 5); expect(s.ctx.armies[0].embarkedFleetId).toBe(s.fleet.id); expect(transfer).toHaveBeenCalledOnce();
    const portC = navalPorts.find(p => s.ctx.provinces.find(v => v.id === p.provinceId)?.owner === 'CHL')!;
    expect(portC.provinceId).not.toBe(portA);
    s.ctx.relations = [{ countryA: 'BRA', countryB: 'CHL', status: 'peace', opinion: 0, trust: 50, militaryAccess: ['CHL'] }] as DiplomaticRelation[];
    const returning = orderFleetReturn(s.ctx.naval.fleets[0], s.ctx.provinces, s.ctx.relations, s.ctx.wars, 'BRA', portC.provinceId);
    expect(returning).not.toBeNull(); s.ctx.naval.fleets = [returning!];
    for (let i = 0; i < 500 && s.ctx.naval.fleets[0].status === 'MOVING'; i++) s.ctx.naval.fleets = navalMovementTick(s.ctx.naval.fleets, s.ctx.provinces, s.ctx.relations, s.ctx.wars);
    expect(s.ctx.naval.fleets[0]).toMatchObject({ status: 'DOCKED', portProvinceId: portC.provinceId });
    const disembarked = disembarkArmy(s.ctx, s.army.id); expect(disembarked.error).toBeUndefined(); s.ctx.armies = disembarked.armies;
    expect(s.ctx.armies[0]).toMatchObject({ id: s.army.id, location: portC.provinceId, embarkedFleetId: undefined, beachExtraction: undefined });
    expect(s.ctx.naval.invasions).toEqual([]); expect(buildTransportIndexes(s.ctx.armies).byFleet.size).toBe(0);
    expect(buildTransportIndexes(s.ctx.armies).extractionsByFleet.size).toBe(0); expect(portByProvince.has(beachId)).toBe(false);
    expect(() => validateTransportSave(s.ctx.armies, s.ctx.naval, s.ctx.provinces)).not.toThrow();
  });
});
