import React, { useMemo, useState } from 'react';
import { GameMap } from './GameMap';
import { provincesData, mapMetadata } from '../data/map';
import { countries } from '../data/countries';
import { createInitialArmies } from '../data/map/initialState';
import { buildCountrySelectionIndex, searchCountries } from '../engine/countrySelection';
import type { SaveMeta } from '../engine/saveSystem';

const empty: never[] = [];
const ignore = () => undefined;

export function CountrySelectionScreen({ onConfirm, saves, onLoad, error }: {
  onConfirm: (tag: string) => void;
  saves: SaveMeta[];
  onLoad: (slot: string) => void;
  error: string | null;
}) {
  const index = useMemo(() => buildCountrySelectionIndex(countries, provincesData, createInitialArmies(countries)), []);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const selected = selectedTag ? index.byTag.get(selectedTag) : undefined;
  const results = useMemo(() => searchCountries(index.sorted, query), [index, query]);
  const selectProvince = (id: string) => {
    const owner = index.provinceById.get(id)?.owner;
    if (owner && index.byTag.has(owner)) setSelectedTag(owner);
  };
  return <main className="country-selection" aria-label="Seleção de país">
    <header><h1>Nova partida · Escolha seu país</h1><p>A campanha começa após a confirmação. Todos os países estão disponíveis.</p></header>
    <div className="country-selection__body">
      <GameMap provinces={provincesData} countries={countries} armies={empty} recruitments={empty}
        buildingConstructions={empty} activeBattles={empty} selectedProvince={null} hoveredProvince={hoveredProvince}
        selectedArmy={null} selectionMode selectedCountryTag={selectedTag ?? undefined} initialViewBox={mapMetadata.initialViewBox}
        onProvinceHover={setHoveredProvince} onProvinceClick={selectProvince} onArmyClick={ignore} onProvinceRightClick={ignore} />
      <aside className="country-selection__panel">
        <label htmlFor="country-search">Buscar país</label>
        <input id="country-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nome do país" />
        <p aria-live="polite">{results.length} países</p>
        <div className="country-selection__list" aria-label="Países disponíveis">
          {results.map(({ country }) => <button key={country.tag} aria-pressed={selectedTag === country.tag}
            onClick={() => setSelectedTag(country.tag)}><span className="country-selection__color" style={{ background: country.color }} />{country.name}</button>)}
          {!results.length && <p>Nenhum país encontrado.</p>}
        </div>
        {selected ? <section aria-label="Resumo do país">
          <h2><span className="country-selection__color" style={{ background: selected.country.color }} />{selected.country.name}</h2>
          <dl>
            <dt>Capital</dt><dd>{selected.capitalName}</dd>
            <dt>Províncias / holdings</dt><dd>{selected.provinceCount}</dd>
            <dt>População</dt><dd>{selected.population.toLocaleString('pt-BR')}</dd>
            <dt>Tesouro</dt><dd>{selected.country.resources.gold.toLocaleString('pt-BR')}</dd>
            <dt>Renda / despesas por dia</dt><dd>{selected.country.economy.goldIncome.toLocaleString('pt-BR')} / {selected.country.economy.goldExpense.toLocaleString('pt-BR')}</dd>
            <dt>Manpower</dt><dd>{selected.country.resources.manpower.toLocaleString('pt-BR')}</dd>
            <dt>Força inicial</dt><dd>{selected.armyStrength.toLocaleString('pt-BR')} tropas</dd>
            <dt>Dificuldade estimada</dt><dd>{selected.difficulty}</dd>
          </dl><small>Dificuldade informativa; não altera as regras.</small>
        </section> : <p>Selecione um país pelo mapa ou pela busca.</p>}
        <button className="country-selection__play" disabled={!selected} onClick={() => { if (selected) onConfirm(selected.country.tag); }}>
          {selected ? `Jogar como ${selected.country.name}` : 'Selecione um país para jogar'}
        </button>
        {saves.length > 0 && <section aria-label="Carregar partida"><h2>Carregar partida</h2>
          <div className="country-selection__saves">{saves.map(save => <button key={save.id} onClick={() => onLoad(save.id)}>Carregar {save.name}</button>)}</div>
        </section>}
        {error && <p role="alert">{error}</p>}
      </aside>
    </div>
  </main>;
}
