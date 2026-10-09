// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { Army, Province } from '../../types';
import { countries, provincesData } from '../../data/map';
import { UNIT_DEFINITIONS } from '../../data/units';
import { army, relation, war, date } from './helpers/southAmericaAudit';
import { processAI } from '../aiEngine/aiMovement';
import * as ai from '../aiEngine';
import { advanceRecentDefeat, canInitiateOffensive, getRequiredAttackRatio, RECENT_DEFEAT_DAYS } from '../aiEngine/militaryRecovery';
import { calculateArmyOrganization, hasEquivalentMovementOrder, issueMoveCommand, recoverArmy, mergeArmies, splitArmy } from '../military';
import { processMovementTick } from '../../hooks/gameLoop/movementTick';
import { startContinuousBattle, processBattleDay } from '../combat';
import { orderArmyGroup } from '../../hooks/app/armyGroupCommands';
import { useArmyActions } from '../../hooks/app/useArmyActions';
import { saveGame, loadGame } from '../saveSystem';
import { createInitialTechState } from '../technology';
import { activationTickParams } from './helpers/simulationActivationWorld';
import { processAiTick } from '../../hooks/gameLoop/aiTick';
import { buildSimulationActivation } from '../simulationActivation';
import { shouldUseDefensiveWarPosture } from '../diplomacy/warResolution';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function fixture(org = 70) {
  const provinces: Province[] = ['home', 'assuncao', 'chaco'].map((id, index) => ({
    ...structuredClone(provincesData[0]), id, name: id, owner: index ? 'BRA' : 'PRY', originalOwner: index ? 'BRA' : 'PRY',
    development: 100, defense: 0, terrain: 'plains', buildings: [], neighbors: index ? ['home'] : ['assuncao', 'chaco'],
  }));
  const own = army('PRY', 'home', 4, 'pry');
  own.regiments = own.regiments.map(r => ({ ...r, organization: UNIT_DEFINITIONS[r.type].maxOrganization * org / 100 }));
  return { provinces, own, relations: [relation('PRY', 'BRA')], wars: [war('PRY', 'BRA')] };
}
function decide(f: ReturnType<typeof fixture>, armies = [f.own]) { return processAI('PRY', armies, f.provinces, f.relations, f.wars); }
const memory = { provinceId: 'assuncao', battleId: 'lost', daysRemaining: RECENT_DEFEAT_DAYS };

describe('Military AI 3.1 offensive readiness and local power', () => {
  it.each([0, 20, 49])('%s percent organization holds safely without offensive orders', org => {
    const f = fixture(org); expect(canInitiateOffensive(f.own)).toBe(false);
    expect(decide(f)[0]).toBe(f.own);
  });
  it.each([50, 70])('%s percent can initiate a valid offensive', org => {
    const f = fixture(org); expect(canInitiateOffensive(f.own)).toBe(true); expect(decide(f)[0].destination).toBeTruthy();
  });
  it('uses canonical strength-weighted normalized organization', () => {
    const f = fixture(0); f.own.regiments[0].strength = 3000;
    f.own.regiments[0].organization = UNIT_DEFINITIONS.infantry.maxOrganization;
    expect(calculateArmyOrganization(f.own)).toBe(50); expect(canInitiateOffensive(f.own)).toBe(true);
  });
  it('retreat protection blocks every new order even at full organization', () => {
    const f = fixture(100); f.own.retreatProtectionDays = 2;
    expect(canInitiateOffensive(f.own)).toBe(false); expect(decide(f)[0]).toBe(f.own);
  });
  it('broken armies can defensively reposition from hostile territory', () => {
    const f = fixture(20); f.own.location = 'assuncao'; expect(decide(f)[0].destination).toBe('home');
  });
  it('does not send broken capital defenders into hostile stacks', () => {
    const f = fixture(20); const invader = army('BRA', 'home', 1, 'enemy');
    expect(decide(f, [f.own, invader])[0].destination).toBeNull();
  });
  it('player movement commands remain available below the offensive threshold', () => {
    const f = fixture(0); expect(issueMoveCommand(f.own, 'assuncao', f.provinces, f.relations)?.destination).toBe('assuncao');
  });
  it('territorial fallback cannot bypass the sum of local defenders', () => {
    const f = fixture(70); const defenders = Array.from({ length: 4 }, (_, i) => army('BRA', 'assuncao', 4, `enemy-${i}`));
    f.provinces = f.provinces.slice(0, 2); f.provinces[0].neighbors = ['assuncao'];
    expect(decide(f, [f.own, ...defenders])[0].destination).toBeNull();
  });
  it('is deterministic across repeated identical inputs', () => {
    const f = fixture(); expect(decide(f)).toEqual(decide(structuredClone(f)));
  });
});

describe('Recent defeat strategic memory', () => {
  it('normal, cautious and recent-defeat thresholds combine centrally', () => {
    const f = fixture(); expect(getRequiredAttackRatio(f.own, 'assuncao')).toBe(1.2);
    expect(getRequiredAttackRatio(f.own, 'assuncao', true)).toBe(1.5);
    f.own.recentDefeat = memory;
    expect(getRequiredAttackRatio(f.own, 'assuncao')).toBe(1.5);
    expect(getRequiredAttackRatio(f.own, 'assuncao', true)).toBe(1.6);
    expect(getRequiredAttackRatio(f.own, 'chaco')).toBe(1.2);
  });
  it('recent defeat rejects a marginal retry while another valid target stays available', () => {
    const f = fixture(100); const enemy = army('BRA', 'assuncao', 4, 'enemy');
    enemy.regiments.forEach(r => { r.strength *= .85; });
    const normal = decide(f, [f.own, enemy])[0]; expect(normal.targetDestination).toBe('assuncao');
    f.own.recentDefeat = memory; expect(decide(f, [f.own, enemy])[0].targetDestination).toBe('chaco');
  });
  it('clear superiority permits a same-province retry', () => {
    const f = fixture(100); f.own.recentDefeat = memory;
    expect(decide(f, [f.own, army('BRA', 'assuncao', 1, 'enemy')])[0].targetDestination).toBe('assuncao');
  });
  it('organization remains mandatory even with overwhelming superiority', () => {
    const f = fixture(20); f.own.recentDefeat = memory;
    expect(decide(f, [f.own, army('BRA', 'assuncao', 1, 'enemy')])[0].destination).toBeNull();
  });
  it('expires after ten daily ticks independent of AI invocations', () => {
    const f = fixture(); let a = { ...f.own, recentDefeat: memory } as Army;
    for (let i = 0; i < 9; i++) a = advanceRecentDefeat(a, new Set(f.provinces.map(p => p.id)), new Set(['PRY']));
    expect(a.recentDefeat?.daysRemaining).toBe(1);
    a = advanceRecentDefeat(a, new Set(['assuncao']), new Set(['PRY'])); expect(a.recentDefeat).toBeUndefined();
  });
  it.each(['destroyed', 'invalid province', 'missing country'])('cleans memory: %s', kind => {
    const f = fixture(); f.own.recentDefeat = memory;
    if (kind === 'destroyed') f.own.regiments = [];
    expect(advanceRecentDefeat(f.own, new Set(kind === 'invalid province' ? [] : ['assuncao']), new Set(kind === 'missing country' ? [] : ['PRY'])).recentDefeat).toBeUndefined();
  });
  it('splitting and merging cannot erase active recovery memory', () => {
    const f = fixture(); f.own.recentDefeat = memory;
    expect(splitArmy(f.own, [0], 'split')?.recentDefeat).toEqual(memory);
    expect(mergeArmies(army('PRY', 'home', 1, 'primary'), f.own).recentDefeat).toEqual(memory);
  });
  it('cautious posture remains active when territory loss drives surrender', () => {
    const f = fixture(); const cs = ['PRY', 'BRA'].map(tag => ({ ...structuredClone(countries.find(c => c.tag === tag)!), capitalId: tag === 'PRY' ? 'assuncao' : 'chaco', provinces: [tag === 'PRY' ? 'assuncao' : 'chaco'] }));
    f.provinces[1].originalOwner = 'PRY';
    expect(shouldUseDefensiveWarPosture('PRY', f.wars, f.provinces, cs, [f.own])).toBe(true);
    f.own.recentDefeat = memory; expect(getRequiredAttackRatio(f.own, 'assuncao', true)).toBe(1.6);
  });
});

describe('Equivalent orders and group dispatch', () => {
  it.each(['destination', 'targetDestination', 'path', 'targetProvinceId'] as const)('recognizes %s without reconstructing a route', field => {
    const f = fixture(); const a = { ...f.own, [field]: field === 'path' ? ['assuncao', 'chaco'] : 'chaco', movementProgress: .45 };
    expect(hasEquivalentMovementOrder(a, 'chaco')).toBe(true);
    expect(issueMoveCommand(a, 'chaco', f.provinces, f.relations)).toBe(a);
    const result = orderArmyGroup([a.id], [a], 'PRY', 'chaco', f.provinces, f.relations);
    expect(result.updates.size).toBe(0); expect(result.failures).toEqual([]); expect(result.armies[0]).toBe(a);
  });
  it('orders only the army that needs a new group order', () => {
    const f = fixture(); const a = issueMoveCommand(f.own, 'chaco', f.provinces, f.relations)!;
    const second = { ...f.own, id: 'second' };
    const result = orderArmyGroup([a.id, second.id], [a, second], 'PRY', 'chaco', f.provinces, f.relations);
    expect([...result.updates.keys()]).toEqual(['second']); expect(result.armies[0]).toBe(a);
  });
  it('two armies already marching to Chaco remain stable over repeated AI ticks', () => {
    const f = fixture(); let armies = [f.own, { ...f.own, id: 'second' }].map(a => issueMoveCommand(a, 'chaco', f.provinces, f.relations)!);
    const original = armies;
    for (let i = 0; i < 8; i++) armies = decide(f, armies);
    expect(armies[0]).toBe(original[0]); expect(armies[1]).toBe(original[1]); expect(armies[0].path).toBe(original[0].path);
  });
  it('an explicit different target can replace a route', () => {
    const f = fixture(); const a = issueMoveCommand(f.own, 'chaco', f.provinces, f.relations)!;
    expect(issueMoveCommand(a, 'assuncao', f.provinces, f.relations)?.targetDestination).toBe('assuncao');
  });
  it('duplicate UI group orders produce no log, toast or state update', () => {
    const f = fixture(); const marching = [f.own, { ...f.own, id: 'second' }].map(a => issueMoveCommand(a, 'chaco', f.provinces, f.relations)!);
    const addLog = vi.fn(), addToast = vi.fn(), setArmies = vi.fn();
    const { result } = renderHook(() => useArmyActions({ selectedArmy: f.own.id, selectedArmyIds: marching.map(a => a.id),
      setSelectedArmy: vi.fn(), setSelectedProvince: vi.fn(), setIsPanelOpen: vi.fn(), provincesRef: { current: f.provinces },
      armiesRef: { current: marching }, diplomaticRelationsRef: { current: f.relations }, playerCountryTag: 'PRY', setArmies,
      addLog, addToast, splitSelection: new Set(), setSplitSelection: vi.fn(), setShowSplitModal: vi.fn() }));
    for (let i = 0; i < 5; i++) act(() => result.current.handleProvinceRightClick('chaco'));
    expect(addLog).not.toHaveBeenCalled(); expect(addToast).not.toHaveBeenCalled(); expect(setArmies).not.toHaveBeenCalled();
  });
});

describe('Battle defeat -> retreat -> recovery -> reconsideration', () => {
  it('reproduces PRY losing Assuncao occupied by BRA without an immediate attack loop', () => {
    const f = fixture(0); f.own.location = 'assuncao'; const defender = army('BRA', 'assuncao', 4, 'bra');
    const battle = startContinuousBattle([f.own], [defender], f.provinces[1], date, 'assuncao-loss');
    const ended = processBattleDay(battle, [f.own, defender], f.provinces[1], f.provinces);
    expect(ended.finished).toBe(true); expect(ended.winner).toBe('defender');
    let a = ended.armies.find(a => a.id === f.own.id)!;
    expect(a).toMatchObject({ location: 'home', retreatProtectionDays: 2, recentDefeat: { provinceId: 'assuncao', battleId: battle.id, daysRemaining: 10 } });
    let country = structuredClone(countries.find(c => c.tag === 'PRY')!); let home = f.provinces[0];
    for (let i = 0; i < 5; i++) {
      a = processMovementTick({ armies: [a], provinces: f.provinces, countries: [country], relations: f.relations, addLog: vi.fn() }).armies[0];
      const recovered = recoverArmy(a, country, home); a = recovered.army; country = recovered.country; home = recovered.province;
      expect(decide(f, [a, defender])[0].destination).toBeNull();
    }
    expect(calculateArmyOrganization(a)).toBeGreaterThan(0); expect(a.recentDefeat?.daysRemaining).toBe(5);
    for (let i = 0; i < 5; i++) a = advanceRecentDefeat(a, new Set(f.provinces.map(p => p.id)), new Set(['PRY']));
    a.regiments = a.regiments.map(r => ({ ...r, organization: UNIT_DEFINITIONS[r.type].maxOrganization }));
    defender.regiments = defender.regiments.slice(0, 1);
    expect(decide(f, [a, defender])[0].targetDestination).toBe('assuncao');
  });
  it('annihilated armies retain no strategic memory', () => {
    const f = fixture(0); f.own.location = 'assuncao'; f.own.recentDefeat = memory;
    const enemy = army('BRA', 'assuncao', 4, 'bra'); const map = [f.provinces[1]];
    const b = startContinuousBattle([f.own], [enemy], map[0], date, 'destroyed');
    expect(processBattleDay(b, [f.own, enemy], map[0], map).armies.find(a => a.id === f.own.id)?.recentDefeat).toBeUndefined();
  });
});

describe('Activation and additive Save V3', () => {
  it('PASSIVE creates no military decisions while daily memory still expires', () => {
    const p = activationTickParams(); const activation = buildSimulationActivation({ ...p, date: p.snapshot.date });
    const passive = p.countries.find(c => activation.tierByCountry.get(c.tag) === 'PASSIVE')!;
    const home = p.provinces.find(province => province.owner === passive.tag)!;
    const a = army(passive.tag, home.id, 1, 'passive'); a.recentDefeat = { provinceId: home.id, daysRemaining: 1 };
    const spy = vi.spyOn(ai, 'processAI');
    p.armies = [a]; const result = processAiTick(p); expect(result.armies.find(r => r.id === a.id)?.destination).toBeNull();
    expect(spy.mock.calls.some(call => call[0] === passive.tag)).toBe(false);
    expect(processMovementTick({ ...p, armies: result.armies, addLog: vi.fn() }).armies[0].recentDefeat).toBeUndefined();
  });
  it('FULL bot still receives normal military decisions', () => {
    const p = activationTickParams(); const activation = buildSimulationActivation({ ...p, date: p.snapshot.date });
    const full = p.countries.find(c => c.tag !== p.playerCountryTag && activation.tierByCountry.get(c.tag) === 'FULL')!;
    const home = p.provinces.find(province => province.owner === full.tag)!;
    p.armies = [army(full.tag, home.id, 1, 'full')];
    const spy = vi.spyOn(ai, 'processAI');
    const result = processAiTick(p); expect(result.armies.some(a => a.id === 'full')).toBe(true);
    expect(spy.mock.calls.some(call => call[0] === full.tag)).toBe(true);
    expect(activation.fullCountryTags.has(full.tag)).toBe(true);
  });
  it.each([true, false])('real save/load supports recentDefeat present=%s', withMemory => {
    const f = fixture(); if (withMemory) f.own.recentDefeat = memory;
    const cs = countries.filter(c => ['PRY', 'BRA'].includes(c.tag));
    const refs: Parameters<typeof saveGame>[0] = { dateRef: { current: date }, provincesRef: { current: f.provinces },
      countriesRef: { current: cs }, armiesRef: { current: [f.own] }, warsRef: { current: f.wars }, diplomaticRelationsRef: { current: f.relations },
      recruitmentsRef: { current: [] }, buildingConstructionsRef: { current: [] }, playerTechStateRef: { current: createInitialTechState('BRA') },
      botTechStatesRef: { current: new Map() }, activeBattlesRef: { current: [] } };
    expect(saveGame(refs, 'military-ai31')).toBe(true);
    const loaded = loadGame('military-ai31'); expect(loaded).not.toBeNull(); expect(loaded?.military.armies[0].recentDefeat).toEqual(withMemory ? memory : undefined);
  });
});
