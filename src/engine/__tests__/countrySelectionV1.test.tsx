// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { useGameLoop } from '../../hooks/useGameLoop';
import { countries, provincesData, mapMetadata } from '../../data/map';
import { createInitialArmies } from '../../data/map/initialState';
import { createInitialTechState } from '../technology';
import { saveGame, loadGame } from '../saveSystem';
import { buildCountrySelectionIndex, estimateCountryDifficulty, getCountryInitialView, searchCountries } from '../countrySelection';
import { readCampaignSave } from '../../components/CampaignEntry';
import { CountrySelectionScreen } from '../../components/CountrySelectionScreen';
import { ProvinceLayer } from '../../components/GameMap/ProvinceLayer';
import { checkEndGameConditions, calculateGameStats } from '../gameConditions';

vi.mock('../../hooks/useGameLoop', () => ({ useGameLoop: vi.fn() }));
vi.mock('../../components/GameMap', () => ({ GameMap: (props: import('../../components/GameMap/GameMap').MapProps) =>
  <div aria-label="Mapa de teste" data-selected-country={props.selectedCountryTag}>
    {props.provinces.map(p => <button key={p.id} onClick={() => props.onProvinceClick(p.id)}>{p.name}</button>)}
    <button onClick={() => props.onProvinceClick('invalid-province')}>Província inexistente</button>
  </div> }));

const loop = vi.mocked(useGameLoop);
const latest = () => loop.mock.calls[loop.mock.calls.length - 1][0];
const country = (tag: string) => countries.find(c => c.tag === tag)!;
const index = buildCountrySelectionIndex(countries, provincesData, createInitialArmies(countries));
const start = (tag = 'AND') => {
  render(<App />);
  fireEvent.click(within(screen.getByLabelText('Países disponíveis')).getByRole('button', { name: country(tag).name }));
  fireEvent.click(screen.getByRole('button', { name: `Jogar como ${country(tag).name}` }));
};
function makeSave(tag: string, slot = 'autosave') {
  const refs = {
    provincesRef: { current: structuredClone(provincesData) }, countriesRef: { current: structuredClone(countries) },
    armiesRef: { current: createInitialArmies(countries) }, warsRef: { current: [] }, diplomaticRelationsRef: { current: [] },
    recruitmentsRef: { current: [] }, buildingConstructionsRef: { current: [] }, activeBattlesRef: { current: [] },
    dateRef: { current: { year: 1445, month: 2, day: 7 } }, playerTechStateRef: { current: createInitialTechState(tag) },
    botTechStatesRef: { current: new Map(countries.filter(c => c.tag !== tag).map(c => [c.tag, createInitialTechState(c.tag)])) },
  };
  expect(saveGame(refs, slot, 'Campanha teste')).toBe(true);
  return refs;
}
beforeEach(() => { localStorage.clear(); window.history.replaceState({}, '', '/?newgame=1'); loop.mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Country Selection V1 entry and UI', () => {
  it('New Game opens selection with Confirm disabled, without mounting the game loop', () => {
    render(<App />);
    expect(screen.getByLabelText('Seleção de país')).toBeTruthy();
    const confirm = screen.getByRole('button', { name: 'Selecione um país para jogar' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirm);
    expect(loop).not.toHaveBeenCalled();
  });
  it('time, AI and autosave cannot advance before Confirm, including after selecting a country', () => {
    vi.useFakeTimers();
    const worldBefore = structuredClone(provincesData);
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    render(<App />);
    fireEvent.click(within(screen.getByLabelText('Países disponíveis')).getByRole('button', { name: 'Andorra' }));
    act(() => vi.advanceTimersByTime(360_000));
    expect(loop).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    expect(provincesData).toEqual(worldBefore);
    expect(screen.getByLabelText('Seleção de país')).toBeTruthy();
  });
  it.each([
    ['Greenland', 'DNK'], ['Puerto Rico', 'USA'], ['Réunion', 'FRA'], ['Andorra la Vella', 'AND'],
  ])('clicking %s selects global owner %s', (name, tag) => {
    render(<App />);
    fireEvent.click(within(screen.getByLabelText('Mapa de teste')).getByRole('button', { name }));
    expect(screen.getByRole('button', { name: `Jogar como ${country(tag).name}` })).toBeTruthy();
    expect(screen.getByLabelText('Mapa de teste').getAttribute('data-selected-country')).toBe(tag);
  });
  it.each(['AND', 'MCO', 'SMR', 'LIE', 'TUV', 'NRU'])('allows microstate %s and confirms its tag', tag => {
    start(tag);
    expect(screen.queryByLabelText('Seleção de país')).toBeNull();
    expect(latest().playerCountryTag).toBe(tag);
    expect(latest().playerTechStateRef.current.countryTag).toBe(tag);
    expect(latest().botTechStatesRef.current.has(tag)).toBe(false);
    expect(latest().botTechStatesRef.current.size).toBe(200);
  });
  it('search is case-insensitive and tag is only a fallback, keeping friendly labels', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Buscar país'), { target: { value: 'bRaSiL' } });
    const list = within(screen.getByLabelText('Países disponíveis'));
    expect(list.getAllByRole('button').map(b => b.textContent)).toEqual(['Brasil']);
    fireEvent.change(screen.getByLabelText('Buscar país'), { target: { value: 'and' } });
    expect(list.getByRole('button', { name: 'Andorra' })).toBeTruthy();
    expect(list.queryByRole('button', { name: 'AND' })).toBeNull();
  });
  it('all 201 countries appear in alphabetical order without dependency countries or internal labels', () => {
    render(<App />);
    const buttons = within(screen.getByLabelText('Países disponíveis')).getAllByRole('button');
    expect(buttons.map(b => b.textContent)).toEqual(index.sorted.map(s => s.country.name));
    expect(buttons).toHaveLength(201);
    expect(buttons.some(b => ['Greenland', 'Puerto Rico', 'Réunion'].includes(b.textContent ?? ''))).toBe(false);
    for (const c of countries) expect(searchCountries(index.sorted, c.name).some(s => s.country.tag === c.tag)).toBe(true);
  });
  it('shows capital, holdings, population, treasury, economy, manpower, army and difficulty', () => {
    render(<App />);
    fireEvent.click(within(screen.getByLabelText('Países disponíveis')).getByRole('button', { name: 'Andorra' }));
    const summary = screen.getByLabelText('Resumo do país');
    const andorra = index.byTag.get('AND')!;
    const values = [...summary.querySelectorAll('dd')].map(n => n.textContent);
    expect(values).toEqual([andorra.capitalName, String(andorra.provinceCount), andorra.population.toLocaleString('pt-BR'),
      andorra.country.resources.gold.toLocaleString('pt-BR'), `${andorra.country.economy.goldIncome.toLocaleString('pt-BR')} / ${andorra.country.economy.goldExpense.toLocaleString('pt-BR')}`,
      andorra.country.resources.manpower.toLocaleString('pt-BR'), `${andorra.armyStrength.toLocaleString('pt-BR')} tropas`, andorra.difficulty]);
    expect(andorra.capitalName).toBe('Andorra la Vella');
  });
  it('clicking a different country replaces selection without starting the game', () => {
    render(<App />);
    const list = within(screen.getByLabelText('Países disponíveis'));
    fireEvent.click(list.getByRole('button', { name: 'Andorra' }));
    fireEvent.click(list.getByRole('button', { name: 'Brasil' }));
    expect(screen.queryByRole('button', { name: 'Jogar como Andorra' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Jogar como Brasil' })).toBeTruthy();
    expect(loop).not.toHaveBeenCalled();
  });
  it('ignores unknown province IDs and displays no results for an unknown name', () => {
    render(<CountrySelectionScreen onConfirm={vi.fn()} onLoad={vi.fn()} saves={[]} error={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Província inexistente' }));
    expect(screen.queryByLabelText('Resumo do país')).toBeNull();
    expect((screen.getByRole('button', { name: 'Selecione um país para jogar' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Buscar país'), { target: { value: 'unknown-country-9999' } });
    expect(within(screen.getByLabelText('Países disponíveis')).queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText('Nenhum país encontrado.')).toBeTruthy();
  });
  it('highlights every holding of the selected owner without modifying geometry', () => {
    const owned = provincesData.filter(p => p.owner === 'DNK');
    const { container } = render(<svg><ProvinceLayer provinces={owned} countries={countries} buildingConstructions={[]} recruitments={[]}
      selectedProvince={null} selectedCountryTag="DNK" hoveredProvince={null} onProvinceClick={vi.fn()}
      onMouseEnter={vi.fn()} onMouseMove={vi.fn()} onMouseLeave={vi.fn()} /></svg>);
    expect(container.querySelectorAll('.map__province--selected')).toHaveLength(owned.length);
    for (const p of owned) expect(container.querySelector(`[data-province-id="${p.id}"]`)?.getAttribute('d')).toBe(p.path);
  });
});

describe('selected player persistence and integration', () => {
  it('mounts game refs and player-dependent systems only after confirmation with the chosen country', () => {
    start('AND');
    const game = latest();
    expect(game.dateRef.current).toEqual({ year: 1444, month: 11, day: 11 });
    expect(game.countriesRef.current.find(c => c.tag === game.playerCountryTag)?.name).toBe('Andorra');
    expect(game.playerTechStateRef.current.countryTag).toBe('AND');
    expect(game.botTechStatesRef.current.has(mapMetadata.defaultPlayerCountry)).toBe(true);
    expect(game.gameSpeed).toBe(0);
  });
  it('cheats affect the selected player, preserving the former default country resources', () => {
    start('AND');
    const original = latest().countriesRef.current;
    const oldDefault = original.find(c => c.tag === mapMetadata.defaultPlayerCountry)!.resources;
    const before = original.find(c => c.tag === 'AND')!.resources.gold;
    act(() => window.cheats!.addGold(123));
    const updated = latest().countriesRef.current;
    expect(updated.find(c => c.tag === 'AND')!.resources.gold).toBe(before + 123);
    expect(updated.find(c => c.tag === mapMetadata.defaultPlayerCountry)!.resources).toEqual(oldDefault);
  });
  it('endgame and stats follow the selected player rather than the former default', () => {
    start('AND');
    const game = latest(), player = game.countriesRef.current.find(c => c.tag === game.playerCountryTag)!;
    expect(checkEndGameConditions(player, game.provincesRef.current)).toBeNull();
    expect(checkEndGameConditions(player, game.provincesRef.current.map(p => ({ ...p, owner: 'AND' })))).toBe('victory');
    expect(checkEndGameConditions(player, game.provincesRef.current.filter(p => p.owner !== 'AND'))).toBe('defeat');
    expect(calculateGameStats(game.dateRef.current, game.dateRef.current, [], game.playerCountryTag, game.provincesRef.current).provincesControlled).toBe(1);
  });
  it('Save V3 persists the selected player without a version change', () => {
    start('AND');
    expect(saveGame(latest(), 'manual', 'Andorra')).toBe(true);
    const raw = JSON.parse(localStorage.getItem('imperium_save_manual')!);
    expect(raw.version).toBe(3);
    expect(raw.mapId).toBe('world-v1');
    expect(raw.technology.player.countryTag).toBe('AND');
    expect(loadGame('manual')!.technology.player.countryTag).toBe('AND');
  });
  it('autosave enters the game directly with saved country, technology, bots and date', () => {
    makeSave('TUV');
    window.history.replaceState({}, '', '/');
    render(<App />);
    expect(screen.queryByLabelText('Seleção de país')).toBeNull();
    expect(latest().playerCountryTag).toBe('TUV');
    expect(latest().dateRef.current).toEqual({ year: 1445, month: 2, day: 7 });
    expect(latest().playerTechStateRef.current.countryTag).toBe('TUV');
    expect(latest().botTechStatesRef.current.has('TUV')).toBe(false);
  });
  it('New Game ignores an existing autosave and confirmation never reloads it', () => {
    makeSave('BRA');
    start('AND');
    expect(latest().playerCountryTag).toBe('AND');
    expect(latest().dateRef.current.year).toBe(1444);
  });
  it('manual Load from selection skips confirmation and restores saved country', () => {
    makeSave('NRU', 'manual');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Carregar Campanha teste' }));
    expect(screen.queryByLabelText('Seleção de país')).toBeNull();
    expect(latest().playerCountryTag).toBe('NRU');
  });
  it('manual Load inside game switches country and player/bot technology together', () => {
    makeSave('TUV', 'manual');
    start('AND');
    fireEvent.click(screen.getByTitle('Configurações'));
    fireEvent.click(screen.getByRole('button', { name: /Carregar/ }));
    expect(latest().playerCountryTag).toBe('TUV');
    expect(latest().playerTechStateRef.current.countryTag).toBe('TUV');
    expect(latest().botTechStatesRef.current.has('TUV')).toBe(false);
    expect(screen.queryByLabelText('Seleção de país')).toBeNull();
  });
  it('rejects absent/invalid player tag and leaves selection available', () => {
    makeSave('UNKNOWN');
    window.history.replaceState({}, '', '/');
    render(<App />);
    expect(screen.getByRole('alert').textContent).toContain('País do jogador');
    expect(screen.getByLabelText('Seleção de país')).toBeTruthy();
    expect(loop).not.toHaveBeenCalled();
    expect(readCampaignSave('autosave').campaign).toBeNull();
  });
  it('missing and corrupt manual saves do not start a campaign', () => {
    expect(readCampaignSave('missing').campaign).toBeNull();
    localStorage.setItem('imperium_save_broken', '{');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(readCampaignSave('broken').campaign).toBeNull();
  });
  it('rejects a save from a different map without starting the game', () => {
    makeSave('AND', 'foreign');
    const raw = JSON.parse(localStorage.getItem('imperium_save_foreign')!);
    raw.mapId = 'other-map';
    localStorage.setItem('imperium_save_foreign', JSON.stringify(raw));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Carregar Campanha teste' }));
    expect(screen.getByRole('alert').textContent).toContain('outro mapa');
    expect(loop).not.toHaveBeenCalled();
  });
  it('rejects a legacy save with no player identity', () => {
    makeSave('AND');
    const raw = JSON.parse(localStorage.getItem('imperium_save_autosave')!);
    delete raw.technology.player.countryTag;
    localStorage.setItem('imperium_save_autosave', JSON.stringify(raw));
    expect(readCampaignSave('autosave').campaign).toBeNull();
  });
});

describe('selection summaries and camera', () => {
  it('aggregates each owner using current province ownership including overseas holdings', () => {
    for (const summary of index.sorted) {
      const owned = provincesData.filter(p => p.owner === summary.country.tag);
      expect(summary.provinceCount).toBe(owned.length);
      expect(summary.population).toBe(owned.reduce((sum, p) => sum + p.population.total, 0));
    }
    expect(index.byTag.has('GRL')).toBe(false);
    expect(index.byTag.has('PRI')).toBe(false);
    expect(index.byTag.has('REU')).toBe(false);
  });
  it('difficulty thresholds are deterministic, informational and do not mutate resources', () => {
    const c = structuredClone(country('AND'));
    c.resources.manpower = 0; c.economy.goldIncome = 0;
    const before = structuredClone(c);
    for (const [provinceCount, expected] of [[1, 'Very Hard'], [5, 'Hard'], [15, 'Medium'], [40, 'Easy']] as const)
      expect(estimateCountryDifficulty({ provinceCount, population: 0, armyStrength: 0 }, c)).toBe(expected);
    expect(c).toEqual(before);
  });
  it('centers the initial viewport on the capital with a usable microstate zoom', () => {
    const c = country('AND'), capital = provincesData.find(p => p.id === c.capitalId)!;
    const box = getCountryInitialView(c, provincesData)!;
    expect(box.x + box.w / 2).toBe(capital.center.x);
    expect(box.y + box.h / 2).toBe(capital.center.y);
    expect(box.w).toBeGreaterThanOrEqual(240);
    expect(box.h).toBeGreaterThanOrEqual(180);
    expect(getCountryInitialView({ ...c, tag: 'NONE' }, provincesData)).toBeUndefined();
  });
});
