// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildSimulationActivation, type SimulationActivationInput } from '../simulationActivation';
import { countries, provincesData } from '../../data/map';
import { activationTickParams } from './helpers/simulationActivationWorld';
import { war, army, relation } from './helpers/southAmericaAudit';
import { transferProvince } from '../territoryTransfer';
import { processAiTick } from '../../hooks/gameLoop/aiTick';
import { processAiTick as baselineAiTick } from './helpers/legacyActivationAiTick';
import * as ai from '../aiEngine';
import { processDiplomacyAI, collectProactiveProposalCandidates } from '../diplomacy/diplomacyAI';
import { processDiplomacyAI as baselineDiplomacy } from './helpers/legacyActivationDiplomacyAI';
import { createDiplomacyAIProfiler } from '../performance/diplomacyAIProfiler';
import { diplomacyWorld } from './helpers/diplomacyWorld';
import { processEconomyTick } from '../../hooks/gameLoop/economyTick';
import { processDiplomacyTechTick } from '../../hooks/gameLoop/diplomacyTechTick';
import { processMovementTick } from '../../hooks/gameLoop/movementTick';
import { appendWaypoint } from '../military';
import { createInitialTechState } from '../technology';
import { saveGame, loadGame, CURRENT_VERSION } from '../saveSystem';
import { buildCountrySelectionIndex } from '../countrySelection';
import { initializePolitics, processPoliticalTick, politicsDay, choosePoliticalPolicy } from '../politics';
import { createGameLoopProfiler } from '../performance/gameLoopProfiler';

afterEach(() => vi.restoreAllMocks());
const minimal = (playerCountryTag = 'AND'): SimulationActivationInput => ({ countries: structuredClone(countries), provinces: structuredClone(provincesData), armies: [], wars: [], relations: [], playerCountryTag, strategicPowerCount: 0 });
const full = (w: SimulationActivationInput, tag: string) => buildSimulationActivation(w).tierByCountry.get(tag);

describe('Simulation Activation V1 relevance and determinism', () => {
  it.each(['USA', 'BRA', 'AND', 'TUV', 'MCO'])('player %s is always FULL regardless of resources', tag => {
    const w = minimal(tag); const c = w.countries.find(c => c.tag === tag)!;
    c.resources.manpower = 0; c.economy.goldIncome = 0;
    expect(full(w, tag)).toBe('FULL');
  });
  it('activates real Andorra land neighbors France and Spain', () => {
    const w = minimal(); expect(full(w, 'FRA')).toBe('FULL'); expect(full(w, 'ESP')).toBe('FULL');
  });
  it('keeps distant neutral microstates passive without maritime links', () => {
    expect(full(minimal(), 'TUV')).toBe('PASSIVE'); expect(full(minimal('TUV'), 'AND')).toBe('PASSIVE');
  });
  it('selects 24 dynamic powers excluding player with deterministic ranking and tag ties', () => {
    const w = minimal('USA'); delete w.strategicPowerCount;
    const a = buildSimulationActivation(w); const b = buildSimulationActivation({ ...w, countries: [...w.countries].reverse() });
    expect(a.summary.strategicPowers).toBe(24); expect(a.strategicRanking).toEqual(b.strategicRanking);
    for (const c of a.strategicRanking.slice(0, 24)) expect(a.tierByCountry.get(c.tag)).toBe('FULL');
    const zero = { ...w, provinces: [], armies: [], countries: w.countries.map(c => ({ ...c, economy: { ...c.economy, goldIncome: 0 }, resources: { ...c.resources, manpower: 0 } })) };
    const tags = buildSimulationActivation(zero).strategicRanking.map(c => c.tag);
    expect(tags).toEqual([...tags].sort());
  });
  it('growing economy can activate a previously passive country', () => {
    const w = minimal(); w.strategicPowerCount = 1;
    expect(full(w, 'TUV')).toBe('PASSIVE'); w.countries.find(c => c.tag === 'TUV')!.economy.goldIncome = 1e12;
    expect(full(w, 'TUV')).toBe('FULL');
  });
  it('activates attacker, defender and campaign ally represented by war pairs', () => {
    const w = minimal(); w.wars = [{ ...war('TUV', 'MCO'), campaignId: 'campaign' }, { ...war('SMR', 'MCO'), campaignId: 'campaign' }];
    for (const tag of ['TUV', 'MCO', 'SMR']) expect(full(w, tag)).toBe('FULL');
  });
  it.each(['alliance', 'militaryAccess', 'guarantees', 'nonAggressionPact', 'proposal', 'call'] as const)('activates relevant player relation %s', kind => {
    const w = minimal(); const r = relation('AND', 'TUV', 'access', 70); delete r.militaryAccess;
    if (kind === 'alliance') r.alliance = { since: 0 };
    if (kind === 'militaryAccess') r.militaryAccess = ['TUV'];
    if (kind === 'guarantees') r.guarantees = ['AND'];
    if (kind === 'nonAggressionPact') r.nonAggressionPact = { since: 0, expiresAt: 1e9 };
    if (kind === 'proposal' || kind === 'call') r.proposals = [{ id: 'proposal', from: 'TUV', to: 'AND', kind: kind === 'call' ? 'call' : 'nap', createdAt: 0, expiresAt: 1e9 }];
    w.relations = [r]; expect(full(w, 'TUV')).toBe('FULL');
  });
  it('neutral opinion and empty agreements do not activate unrelated countries', () => {
    const w = minimal(); w.relations = [{ ...relation('AND', 'TUV', 'access', 100), militaryAccess: [], guarantees: [] }];
    expect(full(w, 'TUV')).toBe('PASSIVE');
  });
  it('ignores expired proposals and NAPs when date is supplied', () => {
    const w = minimal(); w.date = { year: 1444, month: 11, day: 11 };
    w.relations = [{ ...relation('AND', 'TUV', 'access'), militaryAccess: [], nonAggressionPact: { since: -1e9, expiresAt: -1e9 }, proposals: [{ id: 'expired', from: 'AND', to: 'TUV', kind: 'nap', createdAt: -1e9, expiresAt: -1e9 }] }];
    expect(full(w, 'TUV')).toBe('PASSIVE');
  });
  it('external proposal recipient is FULL before responding', () => {
    const w = minimal(); w.relations = [{ ...relation('MCO', 'TUV', 'access'), proposals: [{ id: 'external', from: 'MCO', to: 'TUV', kind: 'nap', createdAt: 0, expiresAt: 1e9 }] }];
    expect(full(w, 'TUV')).toBe('FULL');
  });
  it('activates active factions and rebel army host/original owner', () => {
    const w = minimal(); w.armies = [{ ...army('rebel_test', w.provinces.find(p => p.owner === 'TUV')!.id), originalOwner: 'MCO', rebellionFactionId: 'faction' }];
    expect(full(w, 'TUV')).toBe('FULL'); expect(full(w, 'MCO')).toBe('FULL');
    w.armies = []; w.countries.find(c => c.tag === 'TUV')!.rebellions = [{ id: 'f', type: 'peasants', originProvince: '', involvedProvinces: [], owner: 'rebel_test', originalCountry: 'TUV', support: 10, militaryStrength: 10, objective: { kind: 'reform', targets: [], requiredDays: 5, heldDays: 0 }, status: 'active', formedDay: 0 }];
    expect(full(w, 'TUV')).toBe('FULL');
    w.countries.find(c => c.tag === 'TUV')!.rebellions![0].status = 'defeated'; expect(full(w, 'TUV')).toBe('PASSIVE');
  });
  it('legacy rebel territory activates its original country without an army', () => {
    const w = minimal(); const p = w.provinces.find(p => p.owner === 'TUV')!; p.owner = 'rebel_legacy'; p.originalOwner = 'TUV';
    expect(full(w, 'TUV')).toBe('FULL');
  });
  it('new border and territory transfer recompute from current owners', () => {
    const w = minimal(); const p = w.provinces.find(p => p.owner === 'TUV')!; const m = w.provinces.find(p => p.owner === 'MCO')!;
    p.neighbors = [m.id]; m.neighbors = [p.id]; expect(full(w, 'MCO')).toBe('PASSIVE');
    const moved = transferProvince({ ...w, recruitments: [], constructions: [] }, p.id, 'AND');
    expect(full({ ...w, ...moved }, 'MCO')).toBe('FULL'); expect(full(w, 'MCO')).toBe('PASSIVE');
  });
  it('does not mutate any inputs, remove countries/provinces or alter territory', () => {
    const w = minimal(); const before = structuredClone(w); const a = buildSimulationActivation(w);
    expect(w).toEqual(before); expect(w.countries).toHaveLength(201); expect(w.provinces).toHaveLength(494); expect(a.tierByCountry.size).toBe(201);
  });
  it('Country Selection index retains every selectable country after activation', () => {
    const w = minimal('TUV'); buildSimulationActivation(w);
    const index = buildCountrySelectionIndex(w.countries, w.provinces, []);
    expect(index.sorted).toHaveLength(201); expect(full(w, 'TUV')).toBe('FULL');
  });
});

describe('Simulation Activation V1 strategic decision integration', () => {
  it('only FULL bots run economic and military AI, preserving world and owners', () => {
    const p = activationTickParams('AND'); const expected = buildSimulationActivation(p);
    const economic = vi.spyOn(ai, 'processAIEconomicDecisions'), military = vi.spyOn(ai, 'processAI');
    const result = processAiTick(p);
    const tags = p.countries.filter(c => c.tag !== 'AND' && expected.fullCountryTags.has(c.tag)).map(c => c.tag);
    expect(economic.mock.calls.map(call => call[0].tag)).toEqual(tags); expect(military.mock.calls.map(call => call[0])).toEqual(tags);
    expect(result.countries).toHaveLength(201); expect(result.provinces.map(pr => [pr.id, pr.owner])).toEqual(p.provinces.map(pr => [pr.id, pr.owner]));
    expect(p.profiler!.last).toMatchObject({ activeBotsProcessed: tags.length, passiveBotsSkipped: 200 - tags.length, simulationActivation: { totalCountries: 201, fullCountries: tags.length + 1 } });
  });
  it('PASSIVE queues, resources, research and movement orders remain intact through AI', () => {
    const p = activationTickParams('AND'); const passive = p.countries.find(c => !buildSimulationActivation(p).fullCountryTags.has(c.tag))!;
    const place = p.provinces.find(pr => pr.owner === passive.tag)!;
    p.armies = [army(passive.tag, place.id)]; p.armies[0].destination = place.id; p.armies[0].movementPlan = { waypoints: [place.id] };
    p.buildingConstructions = [{ id: 'queued', owner: passive.tag, provinceId: place.id, buildingType: 'farm', daysRemaining: 3, totalDays: 10, cost: 10 }];
    p.recruitments = [{ id: 'queued', owner: passive.tag, provinceId: place.id, unitType: 'infantry', daysRemaining: 3, count: 1 }];
    const before = structuredClone({ country: passive, armies: p.armies, construction: p.buildingConstructions, recruitment: p.recruitments, tech: p.currentBotTechStates.get(passive.tag) });
    const result = processAiTick(p);
    expect(result.countries.find(c => c.tag === passive.tag)).toEqual(before.country); expect(result.armies).toEqual(before.armies);
    expect(result.buildingConstructions.filter(c => c.owner === passive.tag)).toEqual(before.construction); expect(result.recruitments.filter(c => c.owner === passive.tag)).toEqual(before.recruitment);
    expect(result.currentBotTechStates.get(passive.tag)).toEqual(before.tech);
  });
  it('PASSIVE initiators produce no proactive proposals or guarantees', () => {
    const world = diplomacyWorld('proposalCycle'); const tags = new Set(['AND']);
    const result = processDiplomacyAI(world, 'AND', createDiplomacyAIProfiler(false), tags);
    expect(result.relations).toEqual(world.relations); expect(collectProactiveProposalCandidates(world, 'AND', undefined, undefined, tags)).toEqual([]);
  });
  it('entering war via external call activates recipient before same-tick military decisions', () => {
    const p = activationTickParams('AND'); p.wars = [war('TUV', 'MCO')];
    const r = relation('TUV', 'SMR', 'alliance', 100); r.trust = 100;
    r.proposals = [{ id: 'join', from: 'TUV', to: 'SMR', kind: 'call', warId: p.wars[0].id, createdAt: 0, expiresAt: 1e9 }];
    p.relations = [r]; const military = vi.spyOn(ai, 'processAI'); const result = processAiTick(p);
    expect(result.wars.some(w => w.attacker === 'SMR' || w.defender === 'SMR')).toBe(true);
    expect(military.mock.calls.map(call => call[0])).toContain('SMR');
    expect(p.profiler!.last!.simulationActivation!.warCountries).toBe(3);
  });
  it('FULL-only world is exactly equivalent to pre-activation AI including queues and movement', () => {
    const make = () => { const p = activationTickParams('AND', 'wars');
      p.countries = p.countries.filter(c => ['AND', 'FRA', 'ESP', 'TUV', 'MCO'].includes(c.tag));
      p.armies = p.armies.filter(a => p.countries.some(c => c.tag === a.owner)); p.relations = [];
      p.wars = [war('TUV', 'MCO')]; return p; };
    // Recruitment/building IDs use Date.now; pin it so the independent runs compare exactly.
    vi.spyOn(Date, 'now').mockReturnValue(1000); vi.spyOn(Math, 'random').mockReturnValue(.5);
    expect(processAiTick(make())).toEqual(baselineAiTick(make()));
  });
  it('FULL economic and military decisions match baseline in a mixed world', () => {
    const make = () => activationTickParams('AND', 'wars');
    vi.spyOn(Date, 'now').mockReturnValue(1000); vi.spyOn(Math, 'random').mockReturnValue(.5);
    const tags = buildSimulationActivation(make()).fullCountryTags;
    const before = baselineAiTick(make()), after = processAiTick(make());
    expect(after.countries.filter(c => tags.has(c.tag))).toEqual(before.countries.filter(c => tags.has(c.tag)));
    expect(after.armies.filter(a => tags.has(a.owner))).toEqual(before.armies.filter(a => tags.has(a.owner)));
    // Existing IDs embed the global queue length. Skipped passive orders change
    // that ordinal, but not recruitment/building choices, costs or progress.
    const recruitment = (rows: typeof after.recruitments) => rows.filter(a => tags.has(a.owner)).map(a => ({ ...a, id: a.id.replace(/_\d+$/, '_ordinal') }));
    const construction = (rows: typeof after.buildingConstructions) => rows.filter(a => tags.has(a.owner)).map(a => ({ ...a, id: a.id.replace(/_\d+$/, '_ordinal') }));
    expect(recruitment(after.recruitments)).toEqual(recruitment(before.recruitments));
    expect(construction(after.buildingConstructions)).toEqual(construction(before.buildingConstructions));
  });
  it('all FULL diplomacy remains equivalent on normal, maintenance and proposal cycles', () => {
    for (const scenario of ['normal', 'maintenance', 'proposalCycle'] as const) {
      const w = diplomacyWorld(scenario); const tags = new Set(w.countries.map(c => c.tag));
      expect(processDiplomacyAI(structuredClone(w), 'AND', createDiplomacyAIProfiler(false), tags))
        .toEqual(baselineDiplomacy(structuredClone(w), 'AND', createDiplomacyAIProfiler(false)));
    }
  });
});

describe('Simulation Activation V1 global continuation and save', () => {
  it('PASSIVE political drift continues while proactive policy changes stop; FULL is equivalent', () => {
    const w = minimal(); const place = w.provinces.find(p => p.owner === 'TUV')!;
    place.unrest = 90; place.population.satisfaction = 10;
    const country = initializePolitics(w.countries.find(c => c.tag === 'TUV')!);
    country.resources.gold = 10000; country.resources.stability = 10;
    const date = { year: 1444, month: 11, day: 11 };
    country.politics!.lastTickDay = politicsDay(date) - 40; country.politics!.politicalCapital = 100;
    const ctx = { provinces: [place], armies: [], wars: [], date };
    expect(choosePoliticalPolicy(country, ctx)).not.toBeNull();
    const passive = processPoliticalTick([structuredClone(country)], ctx, 'AND', false, new Set(['AND']));
    const base = processPoliticalTick([structuredClone(country)], ctx, undefined, false);
    expect(passive).toEqual(base); expect(passive.countries[0].activeLaws).toEqual(country.activeLaws);
    expect(passive.countries[0].politics!.lastTickDay).toBe(politicsDay(date));
    expect(passive.countries[0].politics!.approval).not.toEqual(country.politics!.approval);
    expect(processPoliticalTick([structuredClone(country)], ctx, 'AND', false, new Set(['TUV', 'AND'])))
      .toEqual(processPoliticalTick([structuredClone(country)], ctx, 'AND', false));
  });
  it('profiler reports activation in politics and AI without double-counting phase costs', () => {
    let time = 0; const report = vi.fn(); const profiler = createGameLoopProfiler(true, { now: () => time, reportEvery: 1, report });
    const activation = buildSimulationActivation(minimal()); const date = { year: 1444, month: 11, day: 11 };
    profiler.begin(); profiler.measureSimulationActivation(() => { time += 4; return activation; }); profiler.endPhase('politics');
    profiler.aiProfiler.begin(date); profiler.aiProfiler.measure('simulationActivation', () => { time += 2; });
    profiler.aiProfiler.recordActivation(activation.summary, 2, 198); profiler.aiProfiler.finish(); profiler.endPhase('AI'); profiler.finish(1, 1000);
    expect(report.mock.calls[0][0].aiBreakdown.simulationActivation.duration).toBe(6);
    expect(report.mock.calls[0][0].aiBreakdown.phases.simulationActivation.last).toBe(2);
    expect(report.mock.calls[0][0].phases.politics.last).toBe(4); expect(report.mock.calls[0][0].total.last).toBe(6);
  });
  it('PASSIVE movement plans continue through the ordinary movement tick', () => {
    const w = minimal(); const base = w.provinces.find(p => p.owner === 'TUV')!;
    const places = [{ ...base, id: 'a', neighbors: ['b'], center: { x: 0, y: 0 } }, { ...base, id: 'b', neighbors: ['a'], center: { x: 10, y: 0 } }];
    let units = [appendWaypoint(army('TUV', 'a'), 'b', places, [])!];
    expect(full({ ...w, provinces: places, armies: units }, 'TUV')).toBe('PASSIVE');
    for (let i = 0; i < 30 && units[0].location !== 'b'; i++) { const next = processMovementTick({ ...w, provinces: places, armies: units, addLog: () => {} }); units = [...next.armies, ...next.arrivedArmies]; }
    expect(units[0].location).toBe('b');
    const settled = processMovementTick({ ...w, provinces: places, armies: units, addLog: () => {} });
    expect(settled.armies[0].movementPlan).toBeUndefined();
  });
  it('PASSIVE construction/recruitment finish and population/market/base economy continue', () => {
    const p = activationTickParams('AND'); const tag = 'TUV'; const place = p.provinces.find(pr => pr.owner === tag)!;
    expect(full(p, tag)).toBe('PASSIVE'); const before = structuredClone(place);
    const result = processEconomyTick({ ...p, date: p.snapshot.date, playerTechState: createInitialTechState('AND'), botTechStates: p.currentBotTechStates,
      recruitments: [{ id: 'recruit', owner: tag, provinceId: place.id, unitType: 'infantry', daysRemaining: .01, count: 1 }],
      buildingConstructions: [{ id: 'build', owner: tag, provinceId: place.id, buildingType: 'farm', daysRemaining: .01, totalDays: 10, cost: 10 }],
      addToast: () => {}, addLog: () => {} });
    expect(result.recruitments).toEqual([]); expect(result.buildingConstructions).toEqual([]);
    expect(result.armies.some(a => a.owner === tag)).toBe(true);
    const updated = result.provinces.find(pr => pr.id === place.id)!;
    expect(updated.buildings.find(b => b.type === 'farm')!.level).toBe((before.buildings.find(b => b.type === 'farm')?.level ?? 0) + 1);
    expect(updated.population.total).not.toBe(before.population.total); expect(updated.market).toBeDefined();
    expect(result.countries.find(c => c.tag === tag)!.resources.gold).not.toBe(p.countries.find(c => c.tag === tag)!.resources.gold);
  });
  it('PASSIVE research and focus progress continue for all bots', () => {
    const p = activationTickParams('AND'); const state = p.currentBotTechStates.get('TUV')!;
    state.researchSlots[0] = { id: 0, technologyId: 'education', progressDays: 1 }; state.activeFocusId = 'focus_national_academies';
    expect(full(p, 'TUV')).toBe('PASSIVE');
    const result = processDiplomacyTechTick({ ...p, currentPlayerTechState: createInitialTechState('AND'), playerTechStateRef: { current: createInitialTechState('AND') }, botTechStatesRef: { current: p.currentBotTechStates }, addLog: () => {}, addToast: () => {} });
    expect(result.currentBotTechStates.get('TUV')!.researchSlots[0].progressDays).toBeGreaterThan(1);
    expect(result.currentBotTechStates.get('TUV')!.focusProgressDays).toBeGreaterThan(0);
  });
  it('V3 round-trip restores player and derives tiers without persisting activation', () => {
    localStorage.clear(); const p = activationTickParams('TUV'); const refs: Parameters<typeof saveGame>[0] = {
      dateRef: { current: p.snapshot.date }, provincesRef: { current: p.provinces }, countriesRef: { current: p.countries }, armiesRef: { current: p.armies }, warsRef: { current: p.wars },
      diplomaticRelationsRef: { current: p.relations }, recruitmentsRef: { current: [] }, buildingConstructionsRef: { current: [] }, activeBattlesRef: { current: [] },
      playerTechStateRef: { current: createInitialTechState('TUV') }, botTechStatesRef: { current: p.currentBotTechStates },
    };
    expect(saveGame(refs, 'activation')).toBe(true); expect(CURRENT_VERSION).toBe(3);
    const raw = localStorage.getItem('imperium_save_activation')!; expect(raw).not.toContain('tierByCountry'); expect(raw).not.toContain('simulationTier');
    const loaded = loadGame('activation')!; expect(loaded.version).toBe(3);
    const a = buildSimulationActivation({ ...loaded.world, ...loaded.military, relations: loaded.diplomacy.relations, playerCountryTag: loaded.technology.player.countryTag });
    expect(a.tierByCountry.get('TUV')).toBe('FULL'); expect(a.tierByCountry).toEqual(buildSimulationActivation(p).tierByCountry);
  });
});
