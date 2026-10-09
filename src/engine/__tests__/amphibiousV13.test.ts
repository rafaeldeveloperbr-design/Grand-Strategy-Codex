// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Army, DiplomaticRelation } from '../../types';
import { countries } from '../../data/map';
import { transportFixture } from './transportFixture';
import { AMPHIBIOUS_FRIENDLY_BEACH_LANDING_DAYS, cancelFriendlyBeachLanding, disembarkArmiesAtProvince, friendlyBeachLandingTick, startFriendlyBeachLanding } from '../naval/friendlyBeachLanding';
import { amphibiousAITick, amphibiousTick, buildTransportIndexes, disembarkArmy, embarkArmy, planInvasion, resolveTransportLosses } from '../naval/transport';
import { beachExtractionTick } from '../naval/beachExtraction';
import { navalAITick, navalMovementTick, portByProvince, resolveAmphibiousLandingSeaNode, seaNodes } from '../naval';
import { createNavalUnit } from '../../data/navalUnits';
import { calculateArmySize } from '../combat/combatCalculations';
import { validateTransportSave } from '../naval/transportSave';
import { processBattleArrival } from '../../hooks/gameLoop/battleArrivalTick';
import { createInitialTechState } from '../technology';
import { loadGame, saveGame } from '../saveSystem';
import * as territory from '../territoryTransfer';

const beachId = 'sa_arg_restored_1', date = { year: 1444, month: 11, day: 1 };
function setup(troops = 3600) {
  const s = transportFixture(troops);
  if (troops > 5000) s.ctx.naval.fleets[0].units.push(createNavalUnit('initial-extra', 'TRANSPORT'));
  s.ctx.armies = embarkArmy(s.ctx, s.army.id, s.fleet.id).armies;
  s.ctx.wars = [];
  s.target = s.ctx.provinces.find(p => p.id === beachId)!; s.target.owner = 'BRA';
  s.ctx.naval.fleets = [{ ...s.fleet, status: 'HOLDING', portProvinceId: undefined, locationSeaNodeId: resolveAmphibiousLandingSeaNode(beachId)!.id }];
  return s;
}
function start(s = setup(), ids = [s.army.id], target = beachId) {
  const result = startFriendlyBeachLanding(s.ctx, ids, target);
  expect(result.error).toBeUndefined(); s.ctx.armies = result.armies; return s;
}
function tick(s: ReturnType<typeof setup>, days = 1) {
  let result = friendlyBeachLandingTick(s.ctx); s.ctx.armies = result.armies;
  for (let day = 1; day < days; day++) { result = friendlyBeachLandingTick(s.ctx); s.ctx.armies = result.armies; }
  return result;
}
function access(s: ReturnType<typeof setup>, alliance = false) {
  s.target.owner = 'CHL';
  s.ctx.relations = [{ countryA: 'BRA', countryB: 'CHL', status: 'peace', alliance: alliance ? { since: 0 } : undefined, opinion: 0, trust: 50, militaryAccess: alliance ? [] : ['CHL'] }] as DiplomaticRelation[];
}
function saveRefs(s: ReturnType<typeof setup>) {
  return { dateRef: { current: date }, provincesRef: { current: s.ctx.provinces }, countriesRef: { current: structuredClone(countries) }, armiesRef: { current: s.ctx.armies }, warsRef: { current: s.ctx.wars }, diplomaticRelationsRef: { current: s.ctx.relations }, recruitmentsRef: { current: [] }, buildingConstructionsRef: { current: [] }, activeBattlesRef: { current: [] }, playerTechStateRef: { current: createInitialTechState('BRA') }, botTechStatesRef: { current: new Map() }, navalStateRef: { current: s.ctx.naval } };
}
function enemy(s: ReturnType<typeof setup>, owner = 'ARG'): Army {
  return { ...s.army, id: 'hostile-stack', owner, location: beachId, embarkedFleetId: undefined };
}
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('Explicit friendly beach landing V1.3', () => {
  it('accepts own real Tierra del Fuego beach with no war, deterministically resolving the V1.1 node', () => {
    const s = start(); expect(s.ctx.armies[0].friendlyBeachLanding).toEqual({ provinceId: beachId, seaNodeId: resolveAmphibiousLandingSeaNode(beachId)!.id, elapsedDays: 0 });
    expect(s.ctx.naval.invasions).toBeUndefined(); expect(startFriendlyBeachLanding({ ...setup().ctx, armies: [...setup().ctx.armies].reverse() }, [s.army.id], beachId).armies[0].friendlyBeachLanding).toEqual(s.ctx.armies[0].friendlyBeachLanding);
  });
  it.each([true, false])('accepts CHL alliance=%s through existing peaceful access without changing ownership', alliance => {
    const s = setup(), transfer = vi.spyOn(territory, 'transferProvince'); access(s, alliance); start(s); tick(s, 5);
    expect(s.ctx.armies[0].location).toBe(beachId); expect(s.target.owner).toBe('CHL'); expect(transfer).not.toHaveBeenCalled();
  });
  it.each([false, true])('real no-Port CHL coast with access revoked=%s keeps owner and cargo contracts', revoked => {
    const s = setup(), target = s.ctx.provinces.find(p => p.owner === 'CHL' && !portByProvince.has(p.id) && resolveAmphibiousLandingSeaNode(p.id))!;
    expect(target).toBeDefined(); s.target = target; access(s);
    s.ctx.naval.fleets[0].locationSeaNodeId = resolveAmphibiousLandingSeaNode(target.id)!.id;
    const transfer = vi.spyOn(territory, 'transferProvince'); start(s, [s.army.id], target.id); tick(s, 2);
    if (revoked) s.ctx.relations = [];
    tick(s, 3); expect(target.owner).toBe('CHL'); expect(transfer).not.toHaveBeenCalled();
    expect(s.ctx.armies[0].location).toBe(revoked ? null : target.id);
    expect(s.ctx.armies[0].embarkedFleetId).toBe(revoked ? s.fleet.id : undefined);
    expect(s.ctx.armies[0].friendlyBeachLanding).toBeUndefined();
  });
  it('peaceful target command does not bypass a hostile stack at a docked port', () => {
    const s = transportFixture(); s.ctx.armies = embarkArmy(s.ctx, s.army.id, s.fleet.id).armies;
    s.ctx.armies.push({ ...s.army, id: 'enemy-port', owner: 'ARG' });
    expect(disembarkArmiesAtProvince(s.ctx, [s.army.id], s.fleet.portProvinceId!).error).toMatch(/hostil presente/);
    expect(s.ctx.armies[0].embarkedFleetId).toBe(s.fleet.id);
  });
  it('rejects neutral coast with no access', () => {
    const s = setup(); s.target.owner = 'CHL'; expect(startFriendlyBeachLanding(s.ctx, [s.army.id], beachId).error).toMatch(/acesso/);
  });
  it('rejects hostile coast but still accepts the distinct invasion flow', () => {
    const s = setup(); s.target.owner = 'ARG'; s.ctx.wars = transportFixture().ctx.wars;
    expect(startFriendlyBeachLanding(s.ctx, [s.army.id], beachId).error).toMatch(/hostil/);
    expect(planInvasion(s.ctx, s.fleet.id, [s.army.id], beachId).error).toBeUndefined();
  });
  it('rejects war relation even if the war list has not updated yet', () => {
    const s = setup(); access(s); s.ctx.relations[0].status = 'war';
    expect(startFriendlyBeachLanding(s.ctx, [s.army.id], beachId).error).toMatch(/hostil/);
  });
  it('own coast remains usable during an unrelated war, without hostile local troops', () => {
    const s = setup(); s.ctx.wars = transportFixture().ctx.wars;
    s.ctx.relations = [{ countryA: 'BRA', countryB: 'ARG', status: 'war', opinion: 0, trust: 0 }]; start(s); tick(s, 5); expect(s.ctx.armies[0].location).toBe(beachId);
  });
  it.each(['sa_bra_mato_grosso', 'as_aze_baku'])('rejects inland/lake target %s', id => {
    const s = setup(); expect(startFriendlyBeachLanding(s.ctx, [s.army.id], id).error).toMatch(/costeir|interior|lago/i);
  });
  it('routes the Fleet to the canonical coastal SeaNode instead of using a nearby global node', () => {
    const s = setup();

    const canonicalNode =
      resolveAmphibiousLandingSeaNode(beachId)!.id;

    const otherNode = seaNodes.find(
      n => n.id !== canonicalNode
    )!;

    s.ctx.naval.fleets[0].locationSeaNodeId =
      otherNode.id;

    s.ctx.naval.fleets[0].status = 'HOLDING';
    s.ctx.naval.fleets[0].portProvinceId = undefined;
    s.ctx.naval.fleets[0].route = [];
    s.ctx.naval.fleets[0].movementProgress = 0;

    const result = startFriendlyBeachLanding(
      s.ctx,
      [s.army.id],
      beachId
    );

    expect(result.error).toBeUndefined();

    const fleet = result.naval.fleets[0];

    expect(fleet.status).toBe('MOVING');
    expect(fleet.destinationSeaNodeId).toBe(
      canonicalNode
    );

    const army = result.armies.find(
      a => a.id === s.army.id
    )!;

    expect(
      army.friendlyBeachLanding
    ).toEqual({
      provinceId: beachId,
      seaNodeId: canonicalNode,
      elapsedDays: 0,
    });
  });
  it('preserves instant docked port disembark and prefers it in the target command', () => {
    const s = transportFixture(); s.ctx.armies = embarkArmy(s.ctx, s.army.id, s.fleet.id).armies;
    const result = disembarkArmiesAtProvince(s.ctx, [s.army.id], s.fleet.portProvinceId!);
    expect(result.error).toBeUndefined(); expect(result.armies[0]).toMatchObject({ location: s.fleet.portProvinceId, embarkedFleetId: undefined, friendlyBeachLanding: undefined });
    expect(disembarkArmy(s.ctx, s.army.id).armies).toEqual(result.armies);
  });
  it('allows a port province from its offshore SeaNode without making a docking point', () => {
    const s = setup(), port = s.fleet.portProvinceId!;
    s.ctx.naval.fleets[0].locationSeaNodeId = resolveAmphibiousLandingSeaNode(port)!.id;
    start(s, [s.army.id], port); tick(s, 5); expect(s.ctx.armies[0].location).toBe(port); expect(s.ctx.naval.fleets[0].status).toBe('HOLDING');
  });
  it('takes five days, keeps cargo until completion, then clears all land order state without mutation', () => {
    const s = start(), fleetBefore = structuredClone(s.ctx.naval.fleets[0]), before = structuredClone(s.ctx.provinces), transfer = vi.spyOn(territory, 'transferProvince');
    expect(AMPHIBIOUS_FRIENDLY_BEACH_LANDING_DAYS).toBe(5);
    for (let day = 1; day < 5; day++) { tick(s); expect(s.ctx.armies[0]).toMatchObject({ location: null, embarkedFleetId: s.fleet.id, friendlyBeachLanding: { elapsedDays: day } }); }
    tick(s); expect(s.ctx.armies).toHaveLength(1); expect(s.ctx.armies[0]).toMatchObject({ location: beachId, embarkedFleetId: undefined, friendlyBeachLanding: undefined, destination: null, targetDestination: null, path: [], movementProgress: 0, position: null, movementPlan: undefined, targetArmyId: null, targetProvinceId: null });
    expect(s.ctx.naval.fleets[0]).toEqual(fleetBefore); expect(s.ctx.provinces).toEqual(before); expect(portByProvince.has(beachId)).toBe(false); expect(transfer).not.toHaveBeenCalled();
  });
  it('returns no battle/occupation arrival and keeps the invasion list empty', () => {
    const s = start(); const result = tick(s, 5); expect(result).not.toHaveProperty('arrivals'); expect(s.ctx.naval.invasions ?? []).toEqual([]);
  });
  it.each(['COMBAT', 'RETREATING'] as const)(
    'rejects Fleet status %s',
    status => {
      const s = setup();

      s.ctx.naval.fleets[0].status = status;

      expect(
        startFriendlyBeachLanding(
          s.ctx,
          [s.army.id],
          beachId
        ).error
      ).toBeTruthy();
    }
  );
  it('accepts a DOCKED Fleet and prepares it for the landing coast', () => {
    const s = setup();

    const targetNode =
      resolveAmphibiousLandingSeaNode(beachId)!.id;

    const result = startFriendlyBeachLanding(
      s.ctx,
      [s.army.id],
      beachId
    );

    expect(result.error).toBeUndefined();

    const fleet = result.naval.fleets[0];

    expect(
      ['MOVING', 'HOLDING']
    ).toContain(fleet.status);

    if (fleet.status === 'MOVING') {
      expect(
        fleet.destinationSeaNodeId
      ).toBe(targetNode);
    } else {
      expect(
        fleet.locationSeaNodeId
      ).toBe(targetNode);
    }

    const army = result.armies.find(
      a => a.id === s.army.id
    )!;

    expect(
      army.friendlyBeachLanding?.seaNodeId
    ).toBe(targetNode);
  });
  it('accepts a DOCKED Fleet and orders it toward the landing coast', () => {
    const s = setup();

    const targetNode =
      resolveAmphibiousLandingSeaNode(beachId)!.id;

    const result = startFriendlyBeachLanding(
      s.ctx,
      [s.army.id],
      beachId
    );

    expect(result.error).toBeUndefined();

    const fleet = result.naval.fleets[0];

    expect(['MOVING', 'HOLDING']).toContain(fleet.status);

    if (fleet.status === 'MOVING') {
      expect(fleet.destinationSeaNodeId).toBe(targetNode);
    } else {
      expect(fleet.locationSeaNodeId).toBe(targetNode);
    }
    expect(
      result.armies.find(a => a.id === s.army.id)?.friendlyBeachLanding
    ).toEqual({
      provinceId: beachId,
      seaNodeId: targetNode,
      elapsedDays: 0,
    });
  });
  it.each(['MOVING', 'COMBAT', 'RETREATING', 'DOCKED'] as const)('cancels Fleet status change to %s without landing or teleporting', status => {
    const s = start(); tick(s, 2); s.ctx.naval.fleets[0].status = status; tick(s);
    expect(s.ctx.armies[0]).toMatchObject({ location: null, embarkedFleetId: s.fleet.id, friendlyBeachLanding: undefined });
  });
  it.each(['route', 'seaNode', 'coast', 'nodeMetadata', 'access', 'war', 'owner'] as const)('cancels changed %s safely and never converts to invasion', reason => {
    const s = setup(); access(s); start(s); tick(s, 2);
    if (reason === 'route') s.ctx.naval.fleets[0].route = ['next'];
    if (reason === 'seaNode') s.ctx.naval.fleets[0].locationSeaNodeId = 'wrong';
    if (reason === 'coast') s.ctx.provinces = s.ctx.provinces.filter(p => p.id !== beachId);
    if (reason === 'nodeMetadata') s.ctx.armies[0].friendlyBeachLanding!.seaNodeId = 'wrong';
    if (reason === 'access') s.ctx.relations = [];
    if (reason === 'war') s.ctx.wars = [{ ...transportFixture().ctx.wars[0], defender: 'CHL' }];
    if (reason === 'owner') s.target.owner = 'USA';
    expect(tick(s).messages[0].message).toMatch(/cancelado/);
    expect(s.ctx.armies[0]).toMatchObject({ location: null, embarkedFleetId: s.fleet.id, friendlyBeachLanding: undefined }); expect(s.ctx.naval.invasions ?? []).toEqual([]);
  });
  it('cancels a naval engagement that resolves in the same tick', () => {
    const s = start(); const result = friendlyBeachLandingTick(s.ctx, new Set([s.fleet.id])); expect(result.armies[0].friendlyBeachLanding).toBeUndefined(); expect(result.armies[0].embarkedFleetId).toBe(s.fleet.id);
  });
  it('explicit cancellation checks controller and leaves surviving cargo intact', () => {
    const s = start(); expect(cancelFriendlyBeachLanding(s.ctx.armies, [s.army.id], 'ARG')[0].friendlyBeachLanding).toBeDefined();
    const canceled = cancelFriendlyBeachLanding(s.ctx.armies, [s.army.id], 'BRA'); expect(canceled[0].friendlyBeachLanding).toBeUndefined(); expect(canceled[0].embarkedFleetId).toBe(s.fleet.id);
  });
  it('rejects hostile stack in an otherwise own province', () => {
    const s = setup(); s.ctx.wars = transportFixture().ctx.wars; s.ctx.armies.push(enemy(s));
    expect(startFriendlyBeachLanding(s.ctx, [s.army.id], beachId).error).toMatch(/hostil presente/);
  });
  it('fifth-day hostile arrival cancels while owner remains friendly', () => {
    const s = start(); tick(s, 4); s.ctx.wars = transportFixture().ctx.wars; s.ctx.armies.push(enemy(s)); tick(s);
    expect(s.ctx.armies[0].friendlyBeachLanding).toBeUndefined(); expect(s.ctx.armies[0].location).toBeNull(); expect(s.ctx.armies[0].embarkedFleetId).toBe(s.fleet.id);
  });
  it('uses Battle V3 rebellion hostility, even without a naval war', () => {
    const s = setup(); s.ctx.armies.push({ ...enemy(s, 'rebel_v2_BRA_1'), originalOwner: 'BRA' }); expect(startFriendlyBeachLanding(s.ctx, [s.army.id], beachId).error).toMatch(/hostil presente/);
  });
  it('permits friendly land forces alongside arriving friendly cargo', () => {
    const s = setup(); s.ctx.armies.push(enemy(s, 'BRA')); start(s); tick(s, 5); expect(s.ctx.armies.filter(a => a.location === beachId)).toHaveLength(2);
  });
  it('groups multiple armies without duplicating cargo and rejects a group atomically', () => {
    const s = setup(2000), second = { ...s.ctx.armies[0], id: 'second' }; s.ctx.armies.push(second);
    const failed = startFriendlyBeachLanding(s.ctx, [s.army.id, 'missing'], beachId); expect(failed.error).toBeTruthy(); expect(failed.armies).toBe(s.ctx.armies);
    start(s, [s.army.id, second.id, s.army.id]); tick(s, 5); expect(s.ctx.armies).toHaveLength(2); expect(s.ctx.armies.every(a => a.location === beachId && !a.embarkedFleetId && !a.friendlyBeachLanding)).toBe(true);
  });
  it('allows individual landing while other cargo remains aboard', () => {
    const s = setup(2000); s.ctx.armies.push({ ...s.ctx.armies[0], id: 'second' }); start(s); tick(s, 5);
    expect(s.ctx.armies[0].location).toBe(beachId); expect(s.ctx.armies[1].embarkedFleetId).toBe(s.fleet.id);
  });
  it('rejects foreign controller, land army, zero cargo and repeat order', () => {
    const s = setup(); expect(startFriendlyBeachLanding({ ...s.ctx, actor: 'ARG' }, [s.army.id], beachId).error).toBeTruthy();
    expect(startFriendlyBeachLanding(s.ctx, [], beachId).error).toBeTruthy();
    expect(startFriendlyBeachLanding({ ...s.ctx, armies: [s.army] }, [s.army.id], beachId).error).toBeTruthy();
    start(s); expect(startFriendlyBeachLanding(s.ctx, [s.army.id], beachId).error).toMatch(/cancele/);
  });
  it('rejects conflicting invasion, then permits a separately ordered invasion after war cancellation', () => {
    const s = start(); expect(planInvasion(s.ctx, s.fleet.id, [s.army.id], beachId).error).toMatch(/Cancele/);
    s.target.owner = 'ARG'; s.ctx.wars = transportFixture().ctx.wars; tick(s);
    expect(s.ctx.naval.invasions ?? []).toEqual([]); expect(planInvasion(s.ctx, s.fleet.id, [s.army.id], beachId).error).toBeUndefined();
  });
  it('refuses concurrent extraction and friendly landing on the same fleet', () => {
    const s = setup(2000), land = { ...s.army, id: 'land', location: beachId }; s.ctx.armies.push(land); start(s);
    expect(embarkArmy(s.ctx, land.id, s.fleet.id).error).toMatch(/comprometida/);
    s.ctx.armies = cancelFriendlyBeachLanding(s.ctx.armies, [s.army.id], 'BRA'); s.ctx.armies = embarkArmy(s.ctx, land.id, s.fleet.id).armies;
    expect(startFriendlyBeachLanding(s.ctx, [s.army.id], beachId).error).toMatch(/incompat/);
  });
  it('existing cargo-loss mechanism trims transport overload and lets surviving landing continue', () => {
    const s = setup(7000); start(s); tick(s, 2);
    s.ctx.naval.fleets[0].units = s.ctx.naval.fleets[0].units.filter(u => u.id !== 'initial-extra');
    const loss = resolveTransportLosses(s.ctx.naval, s.ctx.armies, s.ctx.provinces); s.ctx.armies = loss.armies; s.ctx.naval = loss.naval; s.ctx.provinces = loss.provinces;
    expect(loss.troopLossesAtSea).toBe(2000); expect(calculateArmySize(s.ctx.armies[0])).toBe(5000); expect(s.ctx.armies[0].friendlyBeachLanding?.elapsedDays).toBe(2);
    tick(s, 3); expect(s.ctx.armies[0].location).toBe(beachId);
  });
  it.each(['fleet', 'transport', 'army'])('destroyed %s cleans cargo and landing through existing loss/army removal', reason => {
    const s = start();
    if (reason === 'fleet') s.ctx.naval.fleets = [];
    if (reason === 'transport') s.ctx.naval.fleets[0].units = [];
    if (reason === 'army') s.ctx.armies = [];
    s.ctx.armies = resolveTransportLosses(s.ctx.naval, s.ctx.armies, s.ctx.provinces).armies; tick(s);
    expect(s.ctx.armies).toEqual([]); expect(buildTransportIndexes(s.ctx.armies).friendlyLandingsByFleet.size).toBe(0);
  });
  it('cleanup never advances the countdown', () => {
    const s = start(); tick(s, 2); const result = friendlyBeachLandingTick(s.ctx, new Set(), false); expect(result.armies[0].friendlyBeachLanding?.elapsedDays).toBe(2);
  });
  it.each(['PASSIVE', 'FULL'])('%s keeps initiated progress and does not plan a conflicting invasion', mode => {
    const s = start(), full = new Set(mode === 'FULL' ? ['BRA'] : []);
    const ai = amphibiousAITick(s.ctx, full, 'CHL'); expect(ai.invasions ?? []).toEqual([]);
    const indexes = buildTransportIndexes(s.ctx.armies);
    const movement = navalAITick(ai.fleets, full, 'CHL', s.ctx.provinces, [], [], new Set(indexes.friendlyLandingsByFleet.keys()));
    expect(movement.fleets[0]).toEqual(s.ctx.naval.fleets[0]); tick(s, 5); expect(s.ctx.armies[0].location).toBe(beachId);
  });
});

describe('Friendly landing additive Save V3', () => {
  it('preserves progress, target, SeaNode and existing cargo through real save/load', () => {
    const s = start(); tick(s, 2); expect(saveGame(saveRefs(s), 'friendly')).toBe(true); const loaded = loadGame('friendly')!;
    expect(loaded.military.armies[0].friendlyBeachLanding).toEqual(s.ctx.armies[0].friendlyBeachLanding);
    s.ctx.armies = loaded.military.armies; s.ctx.naval = loaded.naval!; s.ctx.provinces = loaded.world.provinces; tick(s, 3);
    expect(s.ctx.armies[0].location).toBe(beachId); expect(saveGame(saveRefs(s), 'landed')).toBe(true); expect(loadGame('landed')!.military.armies[0].embarkedFleetId).toBeUndefined();
  });
  it('old saves without new metadata remain valid', () => {
    const s = setup(); expect(saveGame(saveRefs(s), 'old')).toBe(true); expect(loadGame('old')!.military.armies[0].friendlyBeachLanding).toBeUndefined();
  });
  it.each(['null', 'negative', 'fraction', 'five', 'node', 'province', 'fleet', 'combat', 'movement', 'extraction', 'invasion', 'noCargo'])('rejects corrupt %s metadata/cross references', reason => {
    const s = start(), a = s.ctx.armies[0];
    if (reason === 'null') Object.assign(a, { friendlyBeachLanding: null });
    if (reason === 'negative') a.friendlyBeachLanding!.elapsedDays = -1;
    if (reason === 'fraction') a.friendlyBeachLanding!.elapsedDays = 1.5;
    if (reason === 'five') a.friendlyBeachLanding!.elapsedDays = 5;
    if (reason === 'node') a.friendlyBeachLanding!.seaNodeId = 'wrong';
    if (reason === 'province') a.friendlyBeachLanding!.provinceId = 'wrong';
    if (reason === 'fleet') s.ctx.naval.fleets = [];
    if (reason === 'combat') s.ctx.naval.fleets[0].status = 'COMBAT';
    if (reason === 'movement') a.destination = 'next';
    if (reason === 'extraction') a.beachExtraction = { fleetId: s.fleet.id, provinceId: beachId, seaNodeId: a.friendlyBeachLanding!.seaNodeId, elapsedDays: 0 };
    if (reason === 'invasion') s.ctx.naval.invasions = [{ fleetId: s.fleet.id, armyIds: [a.id], targetProvinceId: beachId, targetOwner: 'BRA', seaNodeId: a.friendlyBeachLanding!.seaNodeId, landingType: 'BEACH', status: 'LANDING', landingDays: 0 }];
    if (reason === 'noCargo') a.embarkedFleetId = undefined;
    expect(() => validateTransportSave(s.ctx.armies, s.ctx.naval, s.ctx.provinces)).toThrow();
  });
});

describe('Real conquered Tierra del Fuego friendly return', () => {
  it('port embark, real voyage, invasion, conquest, extraction and peaceful return without war or ownership mutation', () => {
    const s = transportFixture(), transfer = vi.spyOn(territory, 'transferProvince');
    s.ctx.armies = embarkArmy(s.ctx, s.army.id, s.fleet.id).armies;
    const planned = planInvasion(s.ctx, s.fleet.id, [s.army.id], beachId); expect(planned.error).toBeUndefined(); s.ctx.naval = planned.naval;
    for (let day = 0; day < 500 && s.ctx.naval.fleets[0].status === 'MOVING'; day++) s.ctx.naval.fleets = navalMovementTick(s.ctx.naval.fleets, s.ctx.provinces, [], s.ctx.wars);
    let landed = amphibiousTick(s.ctx.naval, s.ctx.armies, s.ctx.provinces, s.ctx.wars);
    for (let day = 1; day < 5; day++) landed = amphibiousTick(landed.naval, landed.armies, s.ctx.provinces, s.ctx.wars);
    const arrived = processBattleArrival({ arrivedArmies: landed.arrivals, armies: landed.armies, provinces: s.ctx.provinces, countries: structuredClone(countries), wars: s.ctx.wars, relations: [], recruitments: [], buildingConstructions: [], currentActiveBattles: [], snapshot: { date }, playerCountryTag: 'BRA', allCountries: countries, activeBattlesRef: { current: [] }, addLog: vi.fn(), addToast: vi.fn(), setActiveBattles: vi.fn(), cancelProvinceActivities: (_id, _old, _new, rec, cons, provs) => ({ recruitments: rec, constructions: cons, provinces: provs }) });
    s.ctx.naval = landed.naval; s.ctx.armies = arrived.armies; s.ctx.provinces = arrived.provinces; expect(transfer).toHaveBeenCalledOnce();
    s.ctx.wars = []; s.ctx.armies = embarkArmy(s.ctx, s.army.id, s.fleet.id).armies;
    for (let day = 0; day < 5; day++) s.ctx.armies = beachExtractionTick(s.ctx).armies;
    const result = startFriendlyBeachLanding(s.ctx, [s.army.id], beachId); expect(result.error).toBeUndefined(); s.ctx.armies = result.armies;
    for (let day = 0; day < 5; day++) s.ctx.armies = friendlyBeachLandingTick(s.ctx).armies;
    expect(s.ctx.armies).toHaveLength(1); expect(s.ctx.armies[0]).toMatchObject({ location: beachId, embarkedFleetId: undefined, friendlyBeachLanding: undefined, beachExtraction: undefined });
    expect(s.ctx.provinces.find(p => p.id === beachId)?.owner).toBe('BRA'); expect(transfer).toHaveBeenCalledOnce(); expect(arrived.currentActiveBattles).toEqual([]);
    expect(s.ctx.naval.invasions).toEqual([]); expect(s.ctx.naval.fleets[0]).toMatchObject({ status: 'HOLDING', locationSeaNodeId: resolveAmphibiousLandingSeaNode(beachId)!.id, portProvinceId: undefined }); expect(portByProvince.has(beachId)).toBe(false);
  });
});
