// @vitest-environment jsdom
import React, { useState } from 'react';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ActiveBattle, Army, BuildingConstruction, Country, DiplomaticRelation, GameDate, Province, Recruitment, ToastType, War } from '../../types';
import { DEFAULT_LAWS } from '../../constants/laws';
import { provincesData } from '../../data/provinces';
import { createArmy, createRegiment, splitArmy } from '../military';
import { createInitialTechState } from '../technology';
import { advanceObjective, applyRebellionAction, collectRebellionFormationFeedback, collectRebellionResolutionFeedback, getProvinceRebellion, migrateLegacyRebels, normalizeSavedFactions, normalizeRebellion, processRebellionObjectives, resolveRebellion, spawnRebellions, troopCount } from '../rebellion';
import { processMovementTick } from '../../hooks/gameLoop/movementTick';
import { processUnrestTick } from '../../hooks/gameLoop/unrestTick';
import { useGameRefs } from '../../hooks/useGameRefs';
import { useGameLoop } from '../../hooks/useGameLoop';
import { ProvincePanel } from '../../components/ProvincePanel/ProvincePanel';
import { ProvinceLayer } from '../../components/GameMap/ProvinceLayer';
import { ArmyMarker } from '../../components/ArmyMarker';

const date: GameDate = { day: 2, month: 1, year: 1444 };
const province = (id: string, overrides: Partial<Province> = {}): Province => ({ id, name: id === 'p' ? 'Portus Magnus' : id === 'q' ? 'Silva Antiqua' : id,
  owner: 'A', neighbors: [], color: '#fff', center: { x: 0, y: 0 }, path: '', buildings: [], defense: 0, development: 5,
  population: { total: 1000, growthRate: .002, employed: 500, unemployed: 100, satisfaction: 60 }, maxPopulation: 20000, unrest: 0, ...overrides });
const ready = (id: string, overrides: Partial<Province> = {}) => province(id, { unrest: 95, rebellion: { ...normalizeRebellion(), progress: 100 }, ...overrides });
const country = (tag: string, provinces: string[]): Country => ({ tag, provinces, name: tag, adjective: tag, color: '#fff', colorLight: '#fff', flag: tag,
  activeLaws: { ...DEFAULT_LAWS }, resources: { gold: 5000, manpower: 10000, maxManpower: 10000, stability: 70, prestige: 0 },
  economy: { goldIncome: 10, goldExpense: 0, manpowerGain: 10, manpowerExpense: 0 } });
const fixture = (): { provinces: Province[]; countries: Country[]; armies: Army[] } => ({ provinces: [ready('p'), province('q'), province('far', { owner: 'B' })], countries: [country('A', ['p','q']), country('B', ['far'])], armies: [] });
const ignore = () => undefined;

function mountGame(initial: ReturnType<typeof fixture>, onToast: (message: string, type?: ToastType, title?: string, dateString?: string) => void = ignore) {
  const log = vi.fn();
  const game = renderHook(() => {
    const [provinces, setProvinces] = useState(initial.provinces), [allCountries, setAllCountries] = useState(initial.countries), [armies, setArmies] = useState(initial.armies);
    const [recruitments, setRecruitments] = useState<Recruitment[]>([]), [wars, setWars] = useState<War[]>([]);
    const [diplomaticRelations, setDiplomaticRelations] = useState<DiplomaticRelation[]>([]), [buildingConstructions, setBuildingConstructions] = useState<BuildingConstruction[]>([]);
    const [activeBattles, setActiveBattles] = useState<ActiveBattle[]>([]), [currentDate, setDate] = useState(date);
    const [playerTechState, setPlayerTechState] = useState(createInitialTechState('A')), [botTechStates, setBotTechStates] = useState(new Map<string, ReturnType<typeof createInitialTechState>>());
    const [isPaused, setIsPaused] = useState(false);
    const refs = useGameRefs({ provinces, allCountries, armies, recruitments, wars, diplomaticRelations, date: currentDate, buildingConstructions,
      activeBattles, playerTechState, botTechStates, aiDifficulty: 'medium' });
    useGameLoop({ ...refs, playerCountryTag: 'A', allCountries, battleHistory: [], hasTriggeredEndGame: false, gameSpeed: 1, isPaused,
      setProvinces, setAllCountries, setArmies, setRecruitments, setWars, setDiplomaticRelations, setBuildingConstructions, setActiveBattles,
      setDate, setPlayerTechState, setBotTechStates, setIsPaused, setEndGameType: ignore, setGameStats: ignore, setHasTriggeredEndGame: ignore,
      setBattleHistory: ignore, setBattleReport: ignore, addLog: log, addToast: onToast, addAILog: ignore, formatGameDate: d => `${d.day}/${d.month}/${d.year}` });
    return { provinces, countries: allCountries, armies, activeBattles, refs };
  });
  return { ...game, log };
}

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('rebellion announcement lifecycle', () => {
  it('persists through many real ticks and announces the explicit objective resolution once', () => {
    vi.useFakeTimers();
    const onToast = vi.fn(), game = mountGame(fixture(), onToast);
    for (let tick = 0; tick < 20; tick++) act(() => vi.advanceTimersByTime(1000));
    const f = game.result.current.countries[0].rebellions![0];
    expect(f.status).toBe('active');
    expect(game.result.current.armies.some(a => a.owner === f.id && troopCount(a) > 0)).toBe(true);
    expect(game.result.current.provinces[0].owner).toBe(f.id);
    for (let tick = 20; tick < f.objective.requiredDays; tick++) act(() => vi.advanceTimersByTime(1000));
    const ended = game.result.current.countries[0].rebellions![0];
    expect(ended.status).toBe('victorious');
    expect(ended.resolution?.reason).toBe('objective_completed');
    expect(game.result.current.armies.some(a => a.owner === f.id)).toBe(false);
    expect(game.result.current.provinces[0].owner).toBe('A');
    expect(onToast.mock.calls.filter(([, , title]) => title === 'Rebelião resolvida')).toHaveLength(1);
    expect(onToast.mock.calls.some(([message]) => message.includes('objetivo Alívio fiscal concluído'))).toBe(true);
    expect(game.log.mock.calls.some(([message]) => message.includes('venceu:'))).toBe(true);
    act(() => vi.advanceTimersByTime(1000));
    expect(onToast.mock.calls.filter(([, , title]) => title === 'Rebelião resolvida')).toHaveLength(1);
  });

  it('does not defeat a faction after losing territory or membership metadata while an owner-tagged army survives', () => {
    const initial = fixture(), born = spawnRebellions(initial.provinces, initial.countries, [], [], [], date);
    const f = { ...born.countries[0].rebellions![0], involvedProvinces: [], objective: { ...born.countries[0].rebellions![0].objective, targets: [] } };
    let countries = born.countries.map(c => c.tag === 'A' ? { ...c, rebellions: [f] } : c);
    let armies: Army[] = born.armies.map(a => ({ ...a, rebellionFactionId: undefined, location: 'q', inCombat: true }));
    for (let day = 2; day < 12; day++) {
      const next = processRebellionObjectives(initial.provinces, countries, armies, born.wars, born.relations, { ...date, day });
      countries = next.countries; armies = next.armies;
      expect(countries[0].rebellions![0].status).toBe('active');
      expect(armies).toHaveLength(1);
      expect(armies[0].rebellionFactionId).toBe(f.id);
      expect(next.provinces.every(p => !p.owner.startsWith('rebel_'))).toBe(true);
      expect(next.logs.some(log => log.includes('derrotada'))).toBe(false);
    }
    expect(normalizeSavedFactions([f])).toHaveLength(1);
    const loaded = migrateLegacyRebels(initial.provinces, countries, [{ ...armies[0], rebellionFactionId: undefined }], date);
    expect(loaded.armies[0].rebellionFactionId).toBe(f.id);
    expect(loaded.countries[0].rebellions).toHaveLength(1);
    const invalidCleanup = resolveRebellion({ ...f, status: 'defeated' }, initial.provinces, countries, armies);
    expect(invalidCleanup.armies).toEqual(armies);
  });

  it('preserves occupations without armies until a real reconquest, then logs and records military defeat', () => {
    const initial = fixture(), born = spawnRebellions(initial.provinces, initial.countries, [], [], [], date);
    const f = born.countries[0].rebellions![0];
    const occupied = born.provinces.map(p => p.id === 'p' ? { ...p, owner: f.id } : p);
    const holding = processRebellionObjectives(occupied, born.countries, [], born.wars, born.relations, date);
    expect(holding.countries[0].rebellions![0].status).toBe('active');
    expect(holding.provinces[0].owner).toBe(f.id);
    const moved = processMovementTick({ provinces: occupied, countries: [], armies: [], relations: [], addLog: ignore });
    expect(moved.provinces[0].owner).toBe(f.id);
    const defeated = processRebellionObjectives(initial.provinces, holding.countries, [], born.wars, born.relations, { ...date, day: 3 });
    expect(defeated.countries[0].rebellions![0].status).toBe('defeated');
    expect(defeated.countries[0].rebellions![0].resolution?.reason).toBe('military_defeat');
    expect(defeated.logs.some(log => log.includes('derrotada'))).toBe(true);
    expect(collectRebellionResolutionFeedback(holding.countries, defeated.countries, defeated.provinces)).toHaveLength(1);
    expect(collectRebellionResolutionFeedback(defeated.countries, defeated.countries, defeated.provinces)).toHaveLength(0);
    expect(defeated.wars).toHaveLength(0);
  });

  it('counts objective control once per day and keeps rebellion identity when splitting troops', () => {
    const initial = fixture(), born = spawnRebellions(initial.provinces, initial.countries, [], [], [], date);
    const f = born.countries[0].rebellions![0], occupied = born.provinces.map(p => p.id === 'p' ? { ...p, owner: f.id } : p);
    const held = advanceObjective(f, occupied, born.armies, 100);
    expect(advanceObjective(held, occupied, born.armies, 100).objective.heldDays).toBe(1);
    expect(advanceObjective(held, occupied, born.armies, 101).objective.heldDays).toBe(2);
    const split = splitArmy({ ...born.armies[0], regiments: [createRegiment('infantry'), createRegiment('infantry')] }, [0], 'Destacamento');
    expect(split?.rebellionFactionId).toBe(f.id);
    expect(split?.owner).toBe(f.id);
    expect(resolveRebellion(f, occupied, born.countries, born.armies).armies).toEqual(born.armies);
    const negotiated = applyRebellionAction(occupied, born.countries, born.armies, 'A', 'p', 'negotiate', date);
    expect(negotiated.countries[0].rebellions![0].resolution?.reason).toBe('negotiation');
    expect(collectRebellionResolutionFeedback(born.countries, negotiated.countries, negotiated.provinces)[0].message).toContain('negociação aceita');
  });
  it('defers announcements until the final tick state has been committed, with an active faction and persistent consequence', () => {
    vi.useFakeTimers();
    const notices: string[] = [];
    const game = mountGame(fixture(), message => {
      if (!message.startsWith('Rebelião de')) return;
      notices.push(message);
      const state = game.result.current.refs;
      const active = state.countriesRef.current.flatMap(c => c.rebellions ?? []).filter(f => f.status === 'active');
      expect(active).toHaveLength(1);
      const f = active[0];
      expect(state.armiesRef.current.some(a => a.rebellionFactionId === f.id && a.owner === f.id && troopCount(a) > 0)
        || state.provincesRef.current.some(p => p.owner === f.id)
        || f.objective.targets.length > 0 && f.objective.heldDays < f.objective.requiredDays).toBe(true);
    });
    act(() => vi.advanceTimersByTime(1000));
    expect(notices).toEqual(['Rebelião de Camponeses em Portus Magnus']);
    expect(game.result.current.countries[0].rebellions?.[0].status).toBe('active');
    expect(game.result.current.armies.some(a => a.owner.startsWith('rebel_v2_') && !!a.rebellionFactionId)).toBe(true);
    const id = game.result.current.countries[0].rebellions![0].id;
    act(() => vi.advanceTimersByTime(1000));
    expect(game.result.current.countries[0].rebellions![0].id).toBe(id);
    expect(game.result.current.provinces.find(p => p.id === 'p')?.owner).toBe(id);
    expect(notices).toHaveLength(1);
  });

  it('reports same-tick military defeat as a resolved revolt instead of announcing a nonexistent active rebellion', () => {
    vi.useFakeTimers();
    const initial = fixture();
    const silva = provincesData.find(p => p.name === 'Silva Antiqua')!;
    initial.provinces[0] = ready('p', { name: silva.name, population: { ...silva.population }, development: silva.development, defense: silva.defense });
    initial.armies = [{ ...createArmy('A', 'Exército manual de 6k', 'p'), regiments: Array.from({ length: 6 }, () => createRegiment('infantry')) }];
    const onToast = vi.fn(), game = mountGame(initial, onToast);
    act(() => vi.advanceTimersByTime(1000));
    expect(game.result.current.countries[0].rebellions?.[0].status).toBe('defeated');
    expect(game.result.current.armies.filter(a => a.rebellionFactionId)).toHaveLength(0);
    expect(game.result.current.armies[0].owner).toBe('A');
    expect(onToast.mock.calls.some(([message]) => message.startsWith('Rebelião de'))).toBe(false);
    expect(onToast.mock.calls.some(([message]) => message === 'Revolta em Silva Antiqua derrotada no mesmo dia.')).toBe(true);
    expect(game.log.mock.calls.some(([message]) => message.startsWith('Facção de'))).toBe(false);
  });

  it('tracks exact births, without reannouncing ended or existing factions from the same day', () => {
    const initial = fixture(), first = spawnRebellions(initial.provinces, initial.countries, [], [], [], date);
    const resolved = processRebellionObjectives(first.provinces, first.countries, [], first.wars, first.relations, date);
    const onToast = vi.fn();
    const result = processUnrestTick({ ...resolved, provinces: resolved.provinces.map(p => p.id === 'q' ? ready('q') : p),
      snapshot: { date }, playerCountryTag: 'A', allCountries: resolved.countries, addLog: ignore, addToast: onToast });
    expect(onToast).not.toHaveBeenCalled();
    expect(result.createdFactionIds).toHaveLength(1);
    expect(result.createdFactionIds).not.toContain(first.createdFactionIds[0]);
    const feedback = collectRebellionFormationFeedback(result.createdFactionIds, result.provinces, result.countries, result.armies);
    expect(feedback).toHaveLength(1);
    expect(feedback[0].message).toBe('Rebelião de Camponeses em Silva Antiqua');
  });

  it('does not claim successful spawn when the country record is missing, and does not reset progress', () => {
    const result = spawnRebellions([ready('p')], [], [], [], [], date);
    expect(result.createdFactionIds).toEqual([]);
    expect(result.armies).toEqual([]);
    expect(result.provinces[0].rebellion?.progress).toBe(100);
    expect(collectRebellionFormationFeedback(result.createdFactionIds, result.provinces, result.countries, result.armies)).toEqual([]);
  });

  it('shows one shared faction and its actual army in every involved province, including reconquered provinces with zero local progress', () => {
    const initial = fixture();
    initial.provinces = [ready('p', { neighbors: ['q'] }), ready('q', { neighbors: ['p'] }), initial.provinces[2]];
    const result = spawnRebellions(initial.provinces, initial.countries, [], [], [], date);
    expect(result.countries[0].rebellions).toHaveLength(1);
    expect(result.armies).toHaveLength(1);
    expect(result.countries[0].rebellions![0].involvedProvinces).toEqual(['p','q']);
    const reconquered = province('q', { unrest: 22, rebellion: normalizeRebellion() });
    const provinces = result.provinces.map(p => p.id === 'q' ? reconquered : p);
    expect(getProvinceRebellion(reconquered, result.countries)?.id).toBe(result.createdFactionIds[0]);
    const view = render(<ProvincePanel province={reconquered} provinces={provinces} countries={result.countries} playerCountry={result.countries[0]}
      armies={result.armies} recruitments={[]} buildingConstructions={[]} playerTechState={createInitialTechState('A')} botTechStates={new Map()}
      onClose={ignore} onProvinceClick={ignore} onBuild={ignore} onRecruit={ignore} onCancelRecruitment={ignore} onCancelBuilding={ignore} />);
    expect(view.getByText(/Camponeses: Alívio fiscal/)).toBeDefined();
    expect(view.getByText('Província envolvida na revolta. Origem: Portus Magnus.')).toBeDefined();
    expect(view.getByText(/Exército rebelde: .* tropas em Portus Magnus/)).toBeDefined();
    expect(view.getByText('Estável (22%)')).toBeDefined();
    expect(applyRebellionAction(provinces, result.countries, result.armies, 'A', 'q', 'negotiate', date).accepted).toBe(true);
  });

  it('marks involved provinces independently of unrest and gives rebel armies a distinct flag', () => {
    const initial = fixture(), result = spawnRebellions(initial.provinces, initial.countries, [], [], [], date);
    const p = { ...result.provinces[0], unrest: 0 };
    const view = render(<svg><ProvinceLayer provinces={[p]} countries={result.countries} buildingConstructions={[]} recruitments={[]}
      selectedProvince={null} hoveredProvince={null} onProvinceClick={ignore} onMouseEnter={ignore} onMouseMove={ignore} onMouseLeave={ignore} />
      <ArmyMarker army={result.armies[0]} provinces={[p]} countries={result.countries} isSelected={false} isHovered={false} offsetX={0} offsetY={0} onClick={ignore} onHover={ignore} /></svg>);
    expect(view.getByLabelText('Província envolvida na revolta de Camponeses em Portus Magnus')).toBeDefined();
    expect(view.getAllByText('🏴')).toHaveLength(2);
  });
});
