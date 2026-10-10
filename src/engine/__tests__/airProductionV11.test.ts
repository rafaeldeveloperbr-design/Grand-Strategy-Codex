import { describe, expect, it } from 'vitest';
import { countries, provincesData } from '../../data/map';
import type { AirState, AircraftType } from '../../types/air';
import type { ActiveBattle, War } from '../../types';
import { AIR_PRODUCTION_CONFIG } from '../../data/aircraft';
import { airBases, createInitialAirState, startAirProduction, cancelAirProduction, processAirProductionTick, cleanupAirProduction, airProductionAI, airBaseOccupancy, rebaseAirWing, airMissionsTick, airCombatTick, resolveAirTarget, canStartAirTarget, airZoneByProvinceId, airZones, isAirZoneInRange } from '../air';
import { readAirSave } from '../air/save';
import { createGameLoopProfiler, type AirProductionCounters } from '../performance/gameLoopProfiler';

const initial = createInitialAirState(countries, provincesData);
const fighter = initial.wings.find(w => w.countryTag === 'BRA' && w.type === 'FIGHTER')!;
const baseId = fighter.baseProvinceId;
const otherBase = airBases.find(b => b.provinceId !== baseId && provincesData.find(p => p.id === b.provinceId)?.owner === 'BRA')!;
const types = Object.keys(AIR_PRODUCTION_CONFIG) as AircraftType[];
describe('air production profiler',()=>{
  it('reports separate phase/counters and resets each window',()=>{
    const reports: {airProduction:AirProductionCounters}[]=[];
    let now=0;const profiler=createGameLoopProfiler(true,{now:()=>now,reportEvery:1,report:r=>reports.push(r)});
    profiler.begin();now=5;profiler.endPhase('airProduction');
    profiler.recordAirProduction({activeAirBuilds:2,queuedAirBuilds:3,completedAirWings:1,waitingAirBuilds:1});profiler.finish(3,300);
    expect(reports[0].airProduction).toEqual({activeAirBuilds:2,queuedAirBuilds:3,completedAirWings:1,waitingAirBuilds:1});
    profiler.begin();profiler.finish(3,300);expect(reports[1].airProduction.activeAirBuilds).toBe(0);
  });
  it('disabled profiler is inert',()=>{let called=false;const profiler=createGameLoopProfiler(false,{reportEvery:1,report:()=>{called=true;}});profiler.begin();profiler.recordAirProduction({activeAirBuilds:2,queuedAirBuilds:0,completedAirWings:0,waitingAirBuilds:0});profiler.endPhase('airProduction');profiler.finish(3,300);expect(called).toBe(false);expect(profiler.phases).toEqual({});});
});
function setup() {
  const provinces = structuredClone(provincesData), cs = structuredClone(countries);
  const province = provinces.find(p => p.id === baseId)!, country = cs.find(c => c.tag === 'BRA')!;
  country.resources.gold = 10000; country.economy.goldIncome = 100; country.economy.goldExpense = 10;
  province.market!.goods.iron.stock = 1000; province.market!.goods.tools.stock = 1000;
  const state: AirState = { wings: [], engagements: [] };
  return { provinces, countries: cs, province, country, state, ctx: { provinces, countries: cs, wars: [] as War[], relations: [] } };
}
const start = (s: ReturnType<typeof setup>, type: AircraftType = 'FIGHTER', state = s.state) => startAirProduction(state, s.provinces, s.countries, 'BRA', baseId, type);
const finish = (s: ReturnType<typeof setup>, state: AirState) => { const head = state.production!.queues[baseId][0]; return processAirProductionTick({ ...state, production: { ...state.production!, queues: { ...state.production!.queues, [baseId]: [{ ...head, progress: head.requiredProgress - 1 }, ...state.production!.queues[baseId].slice(1)] } } }, s.provinces, s.countries); };

describe('AirWing production V1.1', () => {
  it.each(types)('pays all costs atomically and delivers full %s wing', type => {
    const s = setup(), before = structuredClone(s), cost = AIR_PRODUCTION_CONFIG[type];
    const result = start(s, type);
    expect(result.error).toBeNull(); expect(result.countries.find(c => c.tag === 'BRA')!.resources.gold).toBe(10000 - cost.gold);
    expect(result.provinces.find(p => p.id === baseId)!.market!.goods.iron.stock).toBe(1000 - cost.iron);
    expect(result.provinces.find(p => p.id === baseId)!.market!.goods.tools.stock).toBe(1000 - cost.tools);
    expect(s).toEqual(before);
    const completed = finish(s, result.state);
    expect(completed.state.wings[0]).toMatchObject({ type, countryTag: 'BRA', baseProvinceId: baseId, aircraftCount: 24, maxAircraft: 24, strength: 100, organization: 100, status: 'READY' });
    expect(completed.state.wings[0].mission).toBeUndefined(); expect(completed.messages).toHaveLength(1);
  });
  it.each(['gold', 'iron', 'tools'] as const)('insufficient %s does not partially pay', resource => {
    const s = setup(); if (resource === 'gold') s.country.resources.gold = 0; else s.province.market!.goods[resource].stock = 0;
    const before = structuredClone(s), result = start(s);
    expect(result.error).toMatch(resource === 'gold' ? /Ouro/ : new RegExp(resource.toUpperCase()));
    expect(result.state).toBe(s.state); expect(result.provinces).toBe(s.provinces); expect(result.countries).toBe(s.countries); expect(s).toEqual(before);
  });
  it('rejects missing base', () => { const s = setup(); expect(startAirProduction(s.state, s.provinces, s.countries, 'BRA', 'missing', 'FIGHTER').error).toBeTruthy(); });
  it('rejects a province without a base', () => { const s = setup(), p = s.provinces.find(p => p.owner === 'BRA' && !airBases.some(b => b.provinceId === p.id))!; expect(startAirProduction(s.state, s.provinces, s.countries, 'BRA', p.id, 'FIGHTER').error).toMatch(/não possui AirBase/); });
  it('cannot use allied host stock for production', () => { const s = setup(); s.province.owner = 'ARG'; expect(start(s).error).toMatch(/controle próprio/); expect(s.province.market!.goods.iron.stock).toBe(1000); });
  it('annexed country cannot initiate', () => { const s = setup(); s.country.isAnnexed = true; expect(start(s).error).toBeTruthy(); });
  it('limits queue to five paid orders', () => {
    const s = setup(); let r = start(s); for (let i = 1; i < 5; i++) r = startAirProduction(r.state, r.provinces, r.countries, 'BRA', baseId, 'CAS');
    const blocked = startAirProduction(r.state, r.provinces, r.countries, 'BRA', baseId, 'BOMBER'); expect(blocked.error).toMatch(/cheia/); expect(blocked.countries).toBe(r.countries);
  });
  it('FIFO advances one head by one day', () => { const s = setup(), a = start(s), b = start(s, 'CAS', a.state); const r = processAirProductionTick(b.state, s.provinces, s.countries); expect(r.state.production!.queues[baseId].map(o => o.progress)).toEqual([1, 0]); expect(b.state.production!.queues[baseId][0].progress).toBe(0); });
  it('next FIFO item starts only on following day', () => { const s = setup(), a = start(s), b = start(s, 'CAS', a.state), r = finish(s, b.state); expect(r.state.production!.queues[baseId][0].type).toBe('CAS'); expect(r.state.production!.queues[baseId][0].progress).toBe(0); });
  it('different bases progress concurrently', () => { const s = setup(); const p = s.provinces.find(p => p.id === otherBase.provinceId)!; p.market!.goods.iron.stock = p.market!.goods.tools.stock = 1000; const a = start(s), b = startAirProduction(a.state, s.provinces, s.countries, 'BRA', p.id, 'FIGHTER'); const r = processAirProductionTick(b.state, s.provinces, s.countries); expect(r.counters.activeAirBuilds).toBe(2); expect(Object.values(r.state.production!.queues).map(q => q[0].progress)).toEqual([1, 1]); });
  it('deterministic IDs survive completed/destroyed wings', () => { const s = setup(), a = finish(s, start(s).state), b = start(s, 'FIGHTER', { ...a.state, wings: [] }), c = finish(s, b.state); expect(a.state.wings[0].id).toBe('wing-air-build-1'); expect(c.state.wings[0].id).toBe('wing-air-build-2'); });
  it('cancel has no refund and removes empty queue', () => { const s = setup(), r = start(s); const next = cancelAirProduction(r.state, 'air-build-1', 'BRA'); expect(next.production!.queues).toEqual({}); expect(r.countries.find(c => c.tag === 'BRA')!.resources.gold).toBe(9760); });
  it('foreign actor cannot cancel', () => { const s = setup(), r = start(s); expect(cancelAirProduction(r.state, 'air-build-1', 'ARG').production).toEqual(r.state.production); });
  it('capture cancels before completion without transfer/refund', () => { const s = setup(), r = start(s); s.province.owner = 'ARG'; const next = finish(s, r.state); expect(next.state.wings).toEqual([]); expect(next.state.production!.queues).toEqual({}); expect(next.messages[0].owner).toBe('BRA'); expect(next.messages[0].message).toMatch(/Sem reembolso/); expect(r.countries.find(c => c.tag === 'BRA')!.resources.gold).toBe(9760); });
  it('late cleanup cancels captured queues without advancing twice', () => { const s = setup(), r = start(s); s.province.owner = 'ARG'; expect(cleanupAirProduction(r.state, s.provinces, s.countries).state.production!.queues).toEqual({}); });
  it('completed production waits at capacity, then delivers once', () => {
    const s = setup(), r = start(s), capacity = airBases.find(b => b.provinceId === baseId)!.capacity;
    r.state.wings = Array.from({ length: capacity }, (_, i) => ({ ...fighter, id: `full-${i}` }));
    const waiting = finish(s, r.state); expect(waiting.counters.waitingAirBuilds).toBe(1); expect(waiting.state.wings).toHaveLength(capacity);
    const again = processAirProductionTick(waiting.state, s.provinces, s.countries); expect(again.state.production).toEqual(waiting.state.production);
    const free = { ...again.state, wings: again.state.wings.slice(1) }, delivered = processAirProductionTick(free, s.provinces, s.countries);
    expect(delivered.state.wings).toHaveLength(capacity); expect(delivered.state.production!.queues).toEqual({}); expect(processAirProductionTick(delivered.state, s.provinces, s.countries).state.wings).toHaveLength(capacity);
  });
  it('incoming rebase reservation blocks delivery', () => {
    const s = setup(), r = start(s), capacity = airBases.find(b => b.provinceId === baseId)!.capacity;
    r.state.wings = Array.from({ length: capacity - 1 }, (_, i) => ({ ...fighter, id: `full-${i}` }));
    const moving = { ...fighter, id: 'incoming', baseProvinceId: otherBase.provinceId };
    const rebase = rebaseAirWing(moving, baseId, r.state, s.ctx)!; expect(rebase).toBeTruthy(); r.state.wings.push(rebase);
    expect(airBaseOccupancy(r.state, baseId)).toBe(capacity); expect(finish(s, r.state).counters.waitingAirBuilds).toBe(1);
  });
  it('replacement consumes only replacement cost and preserves queue', () => { const s = setup(), r = start(s); r.state.wings = [{ ...fighter, aircraftCount: 17 }]; const result = airMissionsTick(r.state, { ...s.ctx, provinces: r.provinces, countries: r.countries }); expect(result.state.wings[0].aircraftCount).toBeGreaterThan(17); expect(result.state.production).toEqual(r.state.production); expect(result.provinces.find(p => p.id === baseId)!.market!.goods.iron.stock).toBe(976 - (result.state.wings[0].aircraftCount - 17) * 2); });
  it('combat preserves paid production/counter', () => { const s = setup(), r = start(s); expect(airCombatTick(r.state, s.ctx, 0).production).toEqual(r.state.production); });
  it('Save round-trip preserves queue, counter and exact progress', () => { const s = setup(), r = processAirProductionTick(start(s).state, s.provinces, s.countries), loaded = readAirSave(JSON.parse(JSON.stringify(r.state)), s.ctx); expect(loaded).toEqual(r.state); expect(processAirProductionTick(loaded, s.provinces, s.countries).state.production!.queues[baseId][0].progress).toBe(2); });
  it('load completed wing does not deliver it twice', () => { const s = setup(), done = finish(s, start(s).state).state, loaded = readAirSave(done, s.ctx); expect(processAirProductionTick(loaded, s.provinces, s.countries).state.wings).toHaveLength(1); });
  it('V1 saves retain missing optional production and empty queue semantics', () => { const s = setup(), loaded = readAirSave(s.state, s.ctx); expect(loaded.production).toBeUndefined(); expect(start(s, 'FIGHTER', loaded).state.production!.nextId).toBe(2); });
  it.each(['negative', 'excess', 'counter', 'type', 'duplicate', 'foreign', 'six', 'base'] as const)('rejects malformed save: %s', fault => {
    const s = setup(), r = start(s).state, p = r.production!, q = p.queues[baseId];
    if (fault === 'negative') q[0].progress = -1; if (fault === 'excess') q[0].progress = 121; if (fault === 'counter') p.nextId = 1;
    if (fault === 'type') q[0].type = 'DRONE' as AircraftType; if (fault === 'duplicate') q.push({ ...q[0] });
    if (fault === 'foreign') q[0].countryTag = 'ARG'; if (fault === 'six') for (let i = 2; i <= 6; i++) q.push({ ...q[0], id: `air-build-${i}` });
    if (fault === 'base') q[0].provinceId = 'missing'; expect(() => readAirSave(r, s.ctx)).toThrow(/Air save/);
  });
});

describe('conservative FULL air production AI', () => {
  const ai = (s: ReturnType<typeof setup>, full = new Set(['BRA']), player = 'USA', wars: War[] = [], battles: ActiveBattle[] = []) => airProductionAI(s.state, s.provinces, s.countries, full, player, wars, battles);
  const war: War = { id: 'war', attacker: 'BRA', defender: 'ARG', startDate: { year: 1444, month: 11, day: 11 }, warScore: 0, attackerCasualties: 0, defenderCasualties: 0, occupiedByAttacker: [], occupiedByDefender: [] };
  it('FULL country rebuilds destroyed fighter force', () => { const s = setup(); const result = ai(s); expect(result.state.production!.queues[baseId][0].type).toBe('FIGHTER'); expect(Object.values(result.state.production!.queues).flat()).toHaveLength(1); });
  it('PASSIVE never initiates', () => { const s = setup(); expect(ai(s, new Set()).state).toBe(s.state); });
  it('player never controlled by AI', () => { const s = setup(); expect(ai(s, new Set(['BRA']), 'BRA').state).toBe(s.state); });
  it('PASSIVE paid production advances', () => { const s = setup(); s.state = start(s).state; const result = ai(s, new Set()); expect(processAirProductionTick(result.state, s.provinces, s.countries).state.production!.queues[baseId][0].progress).toBe(1); });
  it.each(['gold', 'iron', 'tools', 'income', 'reserve'] as const)('respects %s constraint', constraint => { const s = setup(); if (constraint === 'gold') s.country.resources.gold = 0; if (constraint === 'reserve') s.country.resources.gold = 1100; if (constraint === 'iron' || constraint === 'tools') s.provinces.filter(p=>p.owner==='BRA' && p.market).forEach(p=>{p.market!.goods[constraint].stock=0;}); if (constraint === 'income') s.country.economy.goldIncome = 0; expect(ai(s).state.production).toBeUndefined(); });
  it('does not spend whole treasury', () => { const s = setup(), result = ai(s); expect(result.countries.find(c => c.tag === 'BRA')!.resources.gold).toBeGreaterThan(9000); });
  it('national cap includes paid orders', () => { const s = setup(); s.state.wings = Array.from({ length: 6 }, (_, i) => ({ ...fighter, id: `cap-${i}` })); expect(ai(s).state.production).toBeUndefined(); });
  it('income limits national cap', () => { const s = setup(); s.country.economy.goldIncome = 11; s.state.wings = [{ ...fighter }, { ...fighter, id: 'second' }]; expect(ai(s).state.production).toBeUndefined(); });
  it('capacity includes incoming reservations', () => { const s = setup(); s.state.wings = airBases.filter(b => s.provinces.find(p => p.id === b.provinceId)?.owner === 'BRA').flatMap(b => Array.from({ length: b.capacity }, (_, i) => ({ ...fighter, id: `${b.provinceId}-${i}`, baseProvinceId: b.provinceId }))); expect(ai(s).state.production).toBeUndefined(); });
  it('peace prioritizes CAS after first fighter', () => { const s = setup(); s.state.wings = [fighter]; expect(ai(s).state.production!.queues[baseId][0].type).toBe('CAS'); });
  it('war prioritizes Fighter when losing superiority', () => { const s = setup(); s.state.wings = [fighter, { ...initial.wings.find(w=>w.countryTag==='ARG'&&w.type==='FIGHTER')!, id: 'hostile', status: 'MISSION', mission: 'AIR_SUPERIORITY', assignedAirZoneId: airZoneByProvinceId.get(baseId)!.id }]; expect(ai(s, new Set(['BRA']), 'USA', [war]).state.production!.queues[baseId][0].type).toBe('FIGHTER'); });
  it('war prioritizes CAS for land battles after fighter', () => { const s = setup(); s.state.wings = [fighter]; expect(ai(s, new Set(['BRA']), 'USA', [war], [{ attackerCountryId: 'BRA', defenderCountryId: 'ARG' } as ActiveBattle]).state.production!.queues[baseId][0].type).toBe('CAS'); });
  it('never produces Transport and limits bombers', () => { const s = setup(); s.state.wings = [{ ...fighter }, { ...fighter, id: 'f2' }, { ...fighter, id: 'cas', type: 'CAS' }, { ...fighter, id: 'bomber', type: 'BOMBER' }]; const result = ai(s); expect(Object.values(result.state.production!.queues).flat().every(o => o.type !== 'TRANSPORT_PLANE' && o.type !== 'BOMBER')).toBe(true); });
});

describe('province-derived air targets', () => {
  it.each([['FIGHTER', 'AIR_SUPERIORITY'], ['FIGHTER', 'INTERCEPTION'], ['CAS', 'CLOSE_AIR_SUPPORT'], ['BOMBER', 'BOMBING']] as const)('%s dispatches %s to province AirZone', (type, mission) => { const s = setup(), w = { ...fighter, type }; s.state.wings = [w]; const result = resolveAirTarget(s.state, { wingId: w.id, kind: 'MISSION', mission }, baseId, 'BRA', s.ctx); expect(result.error).toBeNull(); expect(result.wing?.assignedAirZoneId).toBe(airZoneByProvinceId.get(baseId)!.id); expect(result.wing?.mission).toBe(mission); });
  it('neutral mission targets retain V1 permission', () => { const s = setup(); s.state.wings = [fighter]; const zone = airZones.find(z => isAirZoneInRange(fighter, z.id, s.provinces) && z.provinceIds.some(id => s.provinces.find(p => p.id === id)?.owner !== 'BRA'))!; expect(resolveAirTarget(s.state, { wingId: fighter.id, kind: 'MISSION', mission: 'AIR_SUPERIORITY' }, zone.provinceIds[0], 'BRA', s.ctx).error).toBeNull(); });
  it('out of range returns specific error and leaves wing untouched', () => { const s = setup(); s.state.wings = [fighter]; const zone = airZones.find(z => !isAirZoneInRange(fighter, z.id, s.provinces))!; expect(resolveAirTarget(s.state, { wingId: fighter.id, kind: 'MISSION', mission: 'AIR_SUPERIORITY' }, zone.provinceIds[0], 'BRA', s.ctx).error).toBe('AirZone fora do alcance desta AirWing.'); expect(s.state.wings[0]).toBe(fighter); });
  it('invalid mission never starts target mode', () => { expect(canStartAirTarget({ ...fighter, type: 'CAS' }, 'BRA', 'INTERCEPTION')).toBe(false); expect(canStartAirTarget({ ...fighter, type: 'TRANSPORT_PLANE' }, 'BRA', 'AIR_SUPERIORITY')).toBe(false); });
  it('rebasing and foreign wings cannot start target mode', () => { expect(canStartAirTarget({ ...fighter, status: 'REBASING' }, 'BRA')).toBe(false); expect(canStartAirTarget(fighter, 'ARG')).toBe(false); });
  it('direct own-base rebase preserves timing and save', () => { const s = setup(); s.state.wings = [fighter]; const result = resolveAirTarget(s.state, { wingId: fighter.id, kind: 'REBASE' }, otherBase.provinceId, 'BRA', s.ctx); expect(result.error).toBeNull(); expect(result.wing?.status).toBe('REBASING'); expect(result.wing?.rebase!.daysRemaining).toBeGreaterThan(0); expect(readAirSave({ ...s.state, wings: [result.wing!] }, s.ctx).wings[0].rebase).toEqual(result.wing?.rebase); });
  it.each(['alliance', 'militaryAccess'] as const)('rebase accepts %s granted by host', access => { const s = setup(); s.state.wings = [fighter]; s.provinces.find(p => p.id === otherBase.provinceId)!.owner = 'ARG'; const ctx = { ...s.ctx, relations: [{ countryA: 'BRA', countryB: 'ARG', status: 'peace' as const, opinion: 0, trust: 0, ...(access === 'alliance' ? { alliance: { since: 0 } } : { militaryAccess: ['ARG'] }) }] }; expect(resolveAirTarget(s.state, { wingId: fighter.id, kind: 'REBASE' }, otherBase.provinceId, 'BRA', ctx).error).toBeNull(); });
  it('enemy/inaccessible base blocked', () => { const s = setup(); s.state.wings = [fighter]; s.provinces.find(p => p.id === otherBase.provinceId)!.owner = 'ARG'; expect(resolveAirTarget(s.state, { wingId: fighter.id, kind: 'REBASE' }, otherBase.provinceId, 'BRA', s.ctx).error).toMatch(/Sem acesso/); });
  it('rebase never treats AirZone as base', () => { const s = setup(); s.state.wings = [fighter]; const noBase = s.provinces.find(p => !airBases.some(b => b.provinceId === p.id))!; expect(resolveAirTarget(s.state, { wingId: fighter.id, kind: 'REBASE' }, noBase.id, 'BRA', s.ctx).error).toMatch(/não possui AirBase/); });
  it('rebase returns capacity feedback', () => { const s = setup(); s.state.wings = [fighter, ...Array.from({ length: otherBase.capacity }, (_, i) => ({ ...fighter, id: `target-${i}`, baseProvinceId: otherBase.provinceId }))]; expect(resolveAirTarget(s.state, { wingId: fighter.id, kind: 'REBASE' }, otherBase.provinceId, 'BRA', s.ctx).error).toMatch(/sem capacidade/); });
});
