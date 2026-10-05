// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { Army, Country, GameDate, Province } from '../../types';
import { DEFAULT_LAWS } from '../../constants/laws';
import { UNIT_DEFINITIONS } from '../../data/units';
import { normalizeMarket } from '../market';
import { createArmy, createRegiment, getArmySupply, calculateArmySize } from '../military';
import { checkAllProvinceCombats, findRetreatProvince, processBattleDay, startContinuousBattle } from '../combat';
import { processMovementTick } from '../../hooks/gameLoop/movementTick';
import { checkRebelTerritoryReturn } from '../rebellions';
import { loadGame, saveGame } from '../saveSystem';
import { createInitialTechState } from '../technology';
import {
  advanceObjective, advanceRebellionProgress, applyRebellionAction, calculateRebellionStrength, calculateUnrest,
  createObjective, createRebelArmy, groupRebellion, migrateLegacyRebels, normalizeRebellion,
  normalizeSavedFactions, normalizeSavedRebellion, planRebelMovement, processProvincialPressure,
  processRebellionObjectives, rebellionDay, rebellionEconomicImpact, REBELLION_BALANCE as B,
  respondToRebellions, selectRebelType, spawnRebellions,
  recoverRebelArmies,
} from '../rebellion';
const date: GameDate = { day: 1, month: 1, year: 1444 };
const province = (overrides: Partial<Province> = {}): Province => ({ id: 'p', name: 'Província', owner: 'A', color: '#fff', neighbors: [],
  population: { total: 10000, growthRate: .002, employed: 5000, unemployed: 0, satisfaction: 60 }, maxPopulation: 50000,
  development: 5, buildings: [], defense: 0, center: { x: 0, y: 0 }, path: '', unrest: 0, ...overrides });
const country = (overrides: Partial<Country> = {}): Country => ({ tag: 'A', name: 'País', adjective: 'País', color: '#fff', colorLight: '#fff', provinces: ['p'],
  flag: 'A', activeLaws: { ...DEFAULT_LAWS }, resources: { gold: 5000, manpower: 5000, maxManpower: 10000, stability: 70, prestige: 0 },
  economy: { goldIncome: 10, goldExpense: 5, manpowerGain: 10, manpowerExpense: 0 }, ...overrides });
const army = (owner = 'A', location = 'p', troops = 1000): Army => ({ ...createArmy(owner, owner, location), id: `${owner}_${location}`, regiments: [{ ...createRegiment('infantry'), strength: troops }] });
const ready = (overrides: Partial<Province> = {}) => province({ unrest: 95, rebellion: { ...normalizeRebellion(), progress: 100 }, ...overrides });
const spawn = (p = ready(), c = country()) => spawnRebellions([p], [c], [], [], [], date);

describe('Rebellion V2 pressure and organization', () => {
  it('explains food, poverty, stability and tax pressure with bounded completed-building relief', () => {
    const market = normalizeMarket(); market.purchasingPower = 10; market.goods.food.shortage = 100; market.goods.food.demand = 100;
    const p = ready({ market, buildings: [{ type: 'housing', level: 5, daysRemaining: 0 }] });
    const c = country({ resources: { ...country().resources, stability: 10 }, activeLaws: { ...DEFAULT_LAWS, taxation: 'taxation_high' } });
    const result = calculateUnrest(p, date, [], c);
    expect(result.total).toBeGreaterThan(70);
    expect(result.modifiers.map(m => m.source)).toEqual(expect.arrayContaining(['food_shortage','poverty','stability','taxation','housing']));
    expect(result.modifiers.find(m => m.source === 'housing')?.value).toBe(-B.maxHousingRelief);
    expect(calculateUnrest({ ...p, buildings: [{ type: 'housing', level: 5, daysRemaining: 20 }] }, date, [], c).total).toBeGreaterThan(result.total);
  });
  it('conquest pressure decays and does not mutate the province', () => {
    const p = province({ lastConquestDate: rebellionDay(date), originalOwner: 'B' });
    const early = calculateUnrest(p, date).total;
    expect(calculateUnrest(p, { ...date, year: date.year + 2 }).total).toBeLessThan(early);
    expect(p.lastConquestDate).toBe(rebellionDay(date));
  });
  it('zero-unrest provinces can accumulate unrest under famine', () => {
    const p = province({ population: { ...province().population, satisfaction: 0 } });
    expect(processProvincialPressure([p], date, [], [country()]).updatedProvinces[0].unrest).toBeGreaterThan(0);
  });
  it('high unrest grows organization, low unrest decays, tension nearly holds', () => {
    expect(advanceRebellionProgress(40, 95)).toBeGreaterThan(40);
    expect(advanceRebellionProgress(40, 10)).toBeLessThan(40);
    expect(advanceRebellionProgress(40, 40)).toBeCloseTo(39.9);
    expect(advanceRebellionProgress(100, 100)).toBe(100);
  });
  it('military size reduces progress with a cap, while social pressure remains', () => {
    const p = ready(); const c = country({ resources: { ...country().resources, stability: 0 } });
    const noArmy = processProvincialPressure([p], date, [], [c]).updatedProvinces[0];
    const garrison = processProvincialPressure([p], date, [army()], [c]).updatedProvinces[0];
    expect(garrison.unrest).toBeGreaterThan(80);
    expect(garrison.unrest).toBeLessThan(noArmy.unrest!);
    expect(advanceRebellionProgress(50, 95, 1)).toBeLessThan(advanceRebellionProgress(50, 95));
    expect(advanceRebellionProgress(50, 95, 10)).toBe(advanceRebellionProgress(50, 95, 1));
  });
  it('high unrest alone does not spawn; full progress does', () => {
    expect(spawnRebellions([province({ unrest: 100 })], [country()], [], [], [], date).armies).toHaveLength(0);
    expect(spawn().armies).toHaveLength(1);
  });
  it('economic penalties are gradual and progress/autonomy/relief have revenue tradeoffs', () => {
    expect(rebellionEconomicImpact(50).goldMultiplier).toBeGreaterThan(rebellionEconomicImpact(100).goldMultiplier);
    expect(rebellionEconomicImpact(50, 80).productionMultiplier).toBeLessThan(rebellionEconomicImpact(50).productionMultiplier);
    expect(rebellionEconomicImpact(50, 80, 50, 180).goldMultiplier).toBeLessThan(rebellionEconomicImpact(50, 80).goldMultiplier);
  });
  it('threshold feedback respects cooldowns and does not spam per tick', () => {
    const p = ready({ unrest: 69.99, population: { ...province().population, satisfaction: 0 } });
    const c = country({ resources: { ...country().resources, stability: 0 } });
    const first = processProvincialPressure([p], date, [], [c]);
    expect(first.logs).toHaveLength(1);
    expect(processProvincialPressure(first.updatedProvinces, { ...date, day: 2 }, [], [c]).logs).toHaveLength(0);
  });
});

describe('Rebellion V2 factions and objectives', () => {
  it('groups connected provinces with the same cause, excluding other owners and disconnected provinces', () => {
    const origin = ready({ neighbors: ['q', 'foreign'] });
    const provinces = [origin, ready({ id: 'q', neighbors: ['p'] }), ready({ id: 'far' }), ready({ id: 'foreign', owner: 'B' })];
    expect(groupRebellion(origin, provinces, country()).map(p => p.id)).toEqual(['p','q']);
    const result = spawnRebellions(provinces.slice(0, 2), [country()], [], [], [], date);
    expect(result.armies).toHaveLength(1);
    expect(result.countries[0].rebellions?.[0].involvedProvinces).toEqual(['p','q']);
    expect(spawnRebellions(result.provinces, result.countries, result.armies, result.wars, result.relations, date).armies).toHaveLength(1);
  });
  it('scales forces with population, development, type, army strength and involved provinces', () => {
    const small = ready({ population: { ...province().population, total: 1000 } });
    expect(calculateRebellionStrength([ready()], 'peasants')).toBeGreaterThan(calculateRebellionStrength([small], 'peasants'));
    expect(calculateRebellionStrength([ready(), ready({ id: 'q' })], 'peasants')).toBeGreaterThan(calculateRebellionStrength([ready()], 'peasants'));
    expect(calculateRebellionStrength([ready()], 'pretenders', 10000)).toBeGreaterThan(calculateRebellionStrength([ready()], 'peasants'));
    expect(calculateRebellionStrength([ready({ population: { ...province().population, total: 1000000000 } })], 'pretenders')).toBe(B.maxTroops);
  });
  it('selects supported types from actual conquest and government data', () => {
    expect(selectRebelType(ready({ originalOwner: 'B', lastConquestDate: rebellionDay(date) }), country())).toBe('separatists');
    const c = country({ resources: { ...country().resources, stability: 10, prestige: -10 } });
    expect(selectRebelType(ready(), c)).toBe('pretenders');
    expect(selectRebelType(ready(), { ...c, activeLaws: { ...c.activeLaws, governance: 'governance_centralized' } })).toBe('revolutionaries');
    expect(selectRebelType(ready(), country())).toBe('peasants');
  });
  it('capital objectives use the existing country capital fallback', () => {
    expect(createObjective('pretenders', [ready({ id: 'q' })], country(), [province(), ready({ id: 'q', development: 10 })]).targets).toEqual(['p']);
  });
  it('unopposed rebels occupy territory and are not automatically liberated by legacy movement', () => {
    const result = spawn();
    const occupied = processRebellionObjectives(result.provinces, result.countries, result.armies, result.wars, result.relations, date);
    expect(occupied.provinces[0].owner).toBe(result.armies[0].owner);
    expect(occupied.countries[0].provinces).toEqual([]);
    const moved = processMovementTick({ ...occupied, addLog: () => undefined });
    expect(moved.provinces[0].owner).toBe(result.armies[0].owner);
    expect(checkRebelTerritoryReturn(result.armies[0])).toBeNull();
  });
  it('control must be uninterrupted; military defeat ends the faction', () => {
    const result = spawn(), f = result.countries[0].rebellions![0];
    const held = advanceObjective(f, [province({ owner: f.id })], result.armies);
    expect(held.objective.heldDays).toBe(1);
    expect(advanceObjective(held, [province()], result.armies).objective.heldDays).toBe(0);
    expect(advanceObjective(f, [province()], []).status).toBe('defeated');
    const defeat = processRebellionObjectives([province({ rebellion: result.provinces[0].rebellion })], result.countries, [], result.wars, result.relations);
    expect(defeat.provinces[0].owner).toBe('A');
    expect(defeat.countries[0].rebellions![0].status).toBe('defeated');
    expect(defeat.wars).toHaveLength(0);
    expect(defeat.provinces[0].rebellion?.factionId).toBeUndefined();
  });
  it('peasant victory changes taxation and clears the rebellion', () => {
    const result = spawn(), f = result.countries[0].rebellions![0];
    f.objective.heldDays = f.objective.requiredDays - 1;
    const victory = processRebellionObjectives([province({ owner: f.id, rebellion: result.provinces[0].rebellion })], result.countries, result.armies, result.wars, result.relations);
    expect(victory.countries[0].activeLaws.taxation).toBe('taxation_low');
    expect(victory.armies).toHaveLength(0);
    expect(victory.provinces[0].owner).toBe('A');
    expect(victory.countries[0].rebellions![0].status).toBe('victorious');
  });
  it('separatists restore a recorded country, revive annexed status and assign correct territory', () => {
    const result = spawn(ready({ originalOwner: 'B', lastConquestDate: rebellionDay(date) }));
    const restored = country({ tag: 'B', provinces: [], isAnnexed: true });
    const f = result.countries[0].rebellions![0]; f.objective.heldDays = f.objective.requiredDays - 1;
    const victory = processRebellionObjectives([province({ owner: f.id, rebellion: result.provinces[0].rebellion })], [...result.countries, restored], result.armies, result.wars, result.relations);
    expect(victory.provinces[0].owner).toBe('B');
    expect(victory.countries.find(c => c.tag === 'B')).toMatchObject({ isAnnexed: false, provinces: ['p'] });
    expect(victory.countries[0].provinces).toEqual([]);
  });
  it.each(['pretenders', 'revolutionaries'] as const)('%s victory reforms existing government laws', type => {
    const result = spawn(), f = result.countries[0].rebellions![0];
    f.type = type; f.objective = createObjective(type, result.provinces, result.countries[0], result.provinces);
    f.objective.heldDays = f.objective.requiredDays - 1;
    const victory = processRebellionObjectives([{ ...result.provinces[0], owner: f.id }], result.countries, result.armies, result.wars, result.relations);
    expect(victory.countries[0].activeLaws.governance).toBe(type === 'pretenders' ? 'governance_balanced' : 'governance_decentralized');
    expect(victory.countries[0].resources.stability).toBe(B.victoryStability);
  });
  it('contested control prevents victory even on the last objective day', () => {
    const result = spawn(), f = result.countries[0].rebellions![0]; f.objective.heldDays = f.objective.requiredDays - 1;
    const contested = advanceObjective(f, [{ ...result.provinces[0], owner: f.id }], [...result.armies, army()]);
    expect(contested.status).toBe('active');
    expect(contested.objective.heldDays).toBe(0);
  });
  it('unopposed occupation cancels former-owner recruitment and construction through transferProvince', () => {
    const result = spawn();
    const occupied = processRebellionObjectives(result.provinces, result.countries, result.armies, result.wars, result.relations, date,
      [{ id: 'recruit', provinceId: 'p', owner: 'A', unitType: 'infantry', daysRemaining: 10, count: 1 }],
      [{ id: 'build', provinceId: 'p', owner: 'A', buildingType: 'farm', daysRemaining: 10, totalDays: 20, cost: 100 }]);
    expect(occupied.recruitments).toHaveLength(0);
    expect(occupied.constructions).toHaveLength(0);
  });
});

describe('Rebellion V2 responses, military and migration', () => {
  it('repression needs troops, reduces organization, adds resentment and casualties, and cannot be spammed', () => {
    const p = ready();
    expect(applyRebellionAction([p], [country()], [], 'A', 'p', 'repression', date).accepted).toBe(false);
    const result = applyRebellionAction([p], [country()], [army()], 'A', 'p', 'repression', date);
    expect(result.accepted).toBe(true);
    expect(result.provinces[0].rebellion?.progress).toBeLessThan(100);
    expect(result.provinces[0].rebellion?.resentment).toBeGreaterThan(0);
    expect(result.provinces[0].population.total).toBeLessThan(p.population.total);
    expect(applyRebellionAction(result.provinces, result.countries, result.armies, 'A', 'p', 'repression', date).accepted).toBe(false);
  });
  it.each(['concessions','tax_relief','autonomy','investment'] as const)('%s has a persistent benefit and a cost or revenue tradeoff', action => {
    const result = applyRebellionAction([ready()], [country()], [], 'A', 'p', action, date);
    expect(result.accepted).toBe(true);
    const p = result.provinces[0];
    expect(calculateUnrest(p, date, [], result.countries[0]).total).toBeLessThan(calculateUnrest(ready(), date, [], country()).total);
    expect(result.countries[0].resources.gold < country().resources.gold || rebellionEconomicImpact(50, p.rebellion?.progress, p.rebellion?.autonomy, p.rebellion?.reliefDays).goldMultiplier < rebellionEconomicImpact(50, p.rebellion?.progress).goldMultiplier).toBe(true);
  });
  it('negotiation demobilizes troops and returns occupied provinces with concessions', () => {
    const result = spawn(), id = result.armies[0].owner;
    const negotiated = applyRebellionAction([{ ...result.provinces[0], owner: id }], result.countries, result.armies, 'A', 'p', 'negotiate', date);
    expect(negotiated.accepted).toBe(true);
    expect(negotiated.armies).toHaveLength(0);
    expect(negotiated.provinces[0].owner).toBe('A');
    expect(negotiated.countries[0].rebellions![0].status).toBe('negotiated');
    expect(processRebellionObjectives(negotiated.provinces, negotiated.countries, negotiated.armies, result.wars, result.relations).wars).toHaveLength(0);
  });
  it('rebels have complete bounded Military V2 regiments and use existing supply and combat', () => {
    const result = spawn(), f = result.countries[0].rebellions![0];
    const rebel = createRebelArmy({ ...f, militaryStrength: 2501 }, ready());
    expect(calculateArmySize(rebel)).toBe(2501);
    expect(rebel.regiments).toHaveLength(3);
    for (const r of rebel.regiments) {
      expect(r.strength).toBeLessThanOrEqual(UNIT_DEFINITIONS[r.type].maxStrength);
      expect(r.maxStrength).toBe(UNIT_DEFINITIONS[r.type].maxStrength);
      expect(r.organization).toBeGreaterThan(0); expect(r.morale).toBeGreaterThan(0); expect(r.experience).toBe(0);
    }
    expect(getArmySupply(rebel, ready()).status).toBeDefined();
    const battles = checkAllProvinceCombats([rebel, army()], [province()], result.wars, date, []);
    expect(battles.newBattles).toHaveLength(1);
  });
  it('uses the same retreat routes as Military V2; encircled rebels have no route', () => {
    const f = spawn().countries[0].rebellions![0];
    const battleProvince = province({ neighbors: ['q'] });
    expect(findRetreatProvince(f.id, battleProvince, [battleProvince, province({ id: 'q', owner: f.id })])?.id).toBe('q');
    expect(findRetreatProvince(f.id, battleProvince, [battleProvince, province({ id: 'q' })])).toBeNull();
  });
  it.each([true, false])('Military V2 resolves a defeated rebel army with retreat route = %s', escape => {
    const result = spawn(), f = result.countries[0].rebellions![0];
    const p = province({ neighbors: escape ? ['q'] : [] });
    const rebel = createRebelArmy({ ...f, militaryStrength: 700 }, p);
    const defender = { ...army(), regiments: Array.from({ length: 2 }, () => createRegiment('infantry')) };
    const battle = { ...startContinuousBattle([rebel], [defender], p, date, 'rebellion_battle'), daysRemaining: 1 };
    const resolved = processBattleDay(battle, [rebel, defender], p, [p, province({ id: 'q', owner: f.id })]);
    expect(resolved.finished).toBe(true);
    const survivor = resolved.armies.find(a => a.id === rebel.id)!;
    expect(survivor.inCombat).toBe(false);
    if (escape) {
      expect(survivor.location).toBe('q');
      expect(calculateArmySize(survivor)).toBeGreaterThan(0);
      expect(resolved.retreatInfo?.retreated).toBe(true);
    } else expect(calculateArmySize(survivor)).toBe(0);
    expect(resolved.battle.attackerFinalCombatSnapshot).toBeDefined();
    expect(resolved.battle.endReason).toBeDefined();
  });
  it('rebel recovery uses supply and restores readiness without free reinforcement', () => {
    const result = spawn(), rebel = result.armies[0];
    const damaged = { ...rebel, regiments: [{ ...rebel.regiments[0], strength: 200, organization: 10, morale: 10 }] };
    const recovered = recoverRebelArmies([damaged], [{ ...result.provinces[0], owner: rebel.owner }], result.countries)[0];
    expect(calculateArmySize(recovered)).toBe(200);
    expect(recovered.regiments[0].organization).toBeGreaterThan(10);
    expect(result.countries[0].resources.gold).toBe(country().resources.gold);
  });
  it('occupied provinces with a defending army remain under their owner until combat resolves', () => {
    const result = spawn();
    const defended = processRebellionObjectives(result.provinces, result.countries, [...result.armies, army()], result.wars, result.relations);
    expect(defended.provinces[0].owner).toBe('A');
    expect(defended.countries[0].rebellions![0].objective.heldDays).toBe(0);
  });
  it('rebel AI avoids attacking a vastly stronger objective garrison', () => {
    const result = spawn(ready({ neighbors: ['q'] }));
    result.countries[0].rebellions![0].objective.targets = ['q'];
    const provinces = [...result.provinces, province({ id: 'q', neighbors: ['p'] })];
    const defender = { ...army('A','q'), regiments: Array.from({ length: 20 }, () => createRegiment('infantry')) };
    expect(planRebelMovement([...result.armies, defender], provinces, result.countries, result.relations)[0].destination).toBeNull();
  });
  it('AI negotiates when outmatched and honors the action cooldown', () => {
    const result = spawn();
    const response = respondToRebellions(result.provinces, result.countries, result.armies, result.relations, date, 'PLAYER');
    expect(response.countries[0].rebellions![0].status).toBe('negotiated');
    expect(response.logs).toHaveLength(1);
    expect(respondToRebellions(response.provinces, response.countries, response.armies, result.relations, date, 'PLAYER').logs).toHaveLength(0);
  });
  it('AI sends a superior force to an adjacent rebellion without issuing duplicate orders', () => {
    const result = spawn(ready({ neighbors: ['q'] }));
    const provinces = [...result.provinces, province({ id: 'q', neighbors: ['p'] })];
    const defender = { ...army('A', 'q'), regiments: Array.from({ length: 5 }, () => createRegiment('infantry')) };
    const response = respondToRebellions(provinces, result.countries, [...result.armies, defender], result.relations, date, 'PLAYER');
    expect(response.armies.find(a => a.id === defender.id)?.destination).toBe('p');
    const again = respondToRebellions(response.provinces, response.countries, response.armies, result.relations, date, 'PLAYER');
    expect(again.armies.find(a => a.id === defender.id)?.destination).toBe('p');
    expect(again.countries[0].rebellions![0].status).toBe('active');
    expect(again.logs).toHaveLength(0);
  });
  it('rebel AI pursues objectives and preserves an existing movement order', () => {
    const c = country({ provinces: ['q','p'] });
    const result = spawn(ready({ neighbors: ['q'] }), { ...c, resources: { ...c.resources, stability: 10, prestige: -10 } });
    const provinces = [...result.provinces, province({ id: 'q', neighbors: ['p'] })];
    // Target selected at formation is p if q was not yet supplied; use the objective API with the full map.
    result.countries[0].rebellions![0].objective.targets = ['q'];
    const planned = planRebelMovement(result.armies, provinces, result.countries, result.relations);
    expect(planned[0].destination).toBe('q');
    expect(planRebelMovement(planned, provinces, result.countries, result.relations)[0]).toEqual(planned[0]);
  });
  it('legacy and malformed province fields receive finite defaults; malformed factions are dropped', () => {
    expect(normalizeSavedRebellion(undefined).progress).toBe(0);
    expect(normalizeSavedRebellion({ progress: Infinity, autonomy: -50, reliefDays: 'bad' })).toMatchObject({ progress: 0, autonomy: 0, reliefDays: 0 });
    expect(normalizeSavedFactions([{ id: 'bad' }, null])).toEqual([]);
    const result = spawn(); expect(normalizeSavedFactions(JSON.parse(JSON.stringify(result.countries[0].rebellions)))).toHaveLength(1);
  });
  it('legacy rebels migrate without losing troops or overflowing regiments', () => {
    const legacy = { ...army('rebel_p'), originalOwner: 'A', regiments: [{ ...createRegiment('infantry'), strength: 5000 }] };
    const migrated = migrateLegacyRebels([province()], [country()], [legacy], date);
    expect(migrated.armies[0].rebellionFactionId).toBeDefined();
    expect(calculateArmySize(migrated.armies[0])).toBe(5000);
    expect(migrated.armies[0].regiments).toHaveLength(5);
    expect(migrateLegacyRebels(migrated.provinces, migrated.countries, migrated.armies, date)).toEqual(migrated);
  });
  it('several legacy armies belonging to one faction stay in one faction', () => {
    const legacy = { ...army('rebel_p'), originalOwner: 'A' };
    const migrated = migrateLegacyRebels([province()], [country()], [legacy, { ...legacy, id: 'second' }], date);
    expect(migrated.countries[0].rebellions).toHaveLength(1);
    expect(migrated.armies[0].owner).toBe(migrated.armies[1].owner);
    expect(migrated.countries[0].rebellions![0].militaryStrength).toBe(2000);
  });
  it('actual save/load preserves factions, objective days, action timers and army association', () => {
    const result = spawn(), faction = result.countries[0].rebellions![0];
    faction.objective.heldDays = 10;
    result.provinces[0].rebellion = { ...normalizeRebellion(result.provinces[0].rebellion), resentment: 15, autonomy: 25, reliefDays: 100, lastActionDay: rebellionDay(date) };
    saveGame({ dateRef: { current: date }, provincesRef: { current: result.provinces }, countriesRef: { current: result.countries }, armiesRef: { current: result.armies },
      warsRef: { current: result.wars }, diplomaticRelationsRef: { current: result.relations }, recruitmentsRef: { current: [] }, buildingConstructionsRef: { current: [] },
      activeBattlesRef: { current: [] }, playerTechStateRef: { current: createInitialTechState('A') }, botTechStatesRef: { current: new Map() } }, 'rebellion');
    const loaded = loadGame('rebellion');
    expect(loaded?.world.countries[0].rebellions).toEqual(result.countries[0].rebellions);
    expect(loaded?.world.provinces[0].rebellion).toEqual(result.provinces[0].rebellion);
    expect(loaded?.military.armies[0].rebellionFactionId).toBe(faction.id);
  });
  it('legacy save migration renames diplomatic and active battle identities consistently', () => {
    const rebel = { ...army('rebel_p'), originalOwner: 'A' }, defender = army();
    const battle = startContinuousBattle([rebel], [defender], province(), date, 'legacy_battle');
    localStorage.setItem('imperium_save_legacy_rebels', JSON.stringify({
      id: 'legacy_rebels', name: 'Legacy', timestamp: 1, date,
      provinces: [province()], countries: [country()], armies: [rebel, defender],
      wars: [{ id: 'war', attacker: 'rebel_p', defender: 'A', startDate: date, warScore: 0, attackerCasualties: 0, defenderCasualties: 0, occupiedByAttacker: [], occupiedByDefender: [] }],
      relations: [{ countryA: 'rebel_p', countryB: 'A', opinion: -50, status: 'war', pactDaysRemaining: 0 }],
      recruitments: [], constructions: [], playerTech: createInitialTechState('A'), botTechs: {}, activeBattles: [battle],
    }));
    const loaded = loadGame('legacy_rebels'), tag = loaded?.military.armies[0].owner;
    expect(tag).toMatch(/^rebel_v2_/);
    expect(loaded?.military.wars[0].attacker).toBe(tag);
    expect(loaded?.diplomacy.relations[0].countryA).toBe(tag);
    expect(loaded?.military.activeBattles[0].attackerCountryId).toBe(tag);
    expect(loaded?.military.activeBattles[0].attackerInitialSnapshot?.owner).toBe(tag);
  });
});
