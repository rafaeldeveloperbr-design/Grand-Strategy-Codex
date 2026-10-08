import type { Army, Country, Province } from '../types';
import type { MapViewBox } from '../data/map/types';
import { calculateArmySize } from './combat';

export type SelectionDifficulty = 'Easy' | 'Medium' | 'Hard' | 'Very Hard';
export interface CountrySummary {
  country: Country;
  capitalName: string;
  provinceCount: number;
  population: number;
  armyStrength: number;
  difficulty: SelectionDifficulty;
}

/** Informational only: broad resource thresholds, never gameplay modifiers. */
export function estimateCountryDifficulty(summary: Pick<CountrySummary, 'provinceCount' | 'population' | 'armyStrength'>, country: Country): SelectionDifficulty {
  const score = summary.provinceCount + summary.population / 1_000_000
    + Math.max(0, country.economy.goldIncome - country.economy.goldExpense) / 10
    + country.resources.manpower / 10_000 + summary.armyStrength / 5_000;
  return score >= 40 ? 'Easy' : score >= 15 ? 'Medium' : score >= 5 ? 'Hard' : 'Very Hard';
}

/** One pass per collection; built once for the immutable selection snapshot. */
export function buildCountrySelectionIndex(countries: Country[], provinces: Province[], armies: Army[]) {
  const provinceById = new Map(provinces.map(p => [p.id, p]));
  const byTag = new Map<string, CountrySummary>(countries.map(country => [country.tag, {
    country, capitalName: provinceById.get(country.capitalId ?? country.capital ?? '')?.name ?? 'Não definida',
    provinceCount: 0, population: 0, armyStrength: 0, difficulty: 'Very Hard',
  }]));
  for (const p of provinces) {
    const summary = byTag.get(p.owner);
    if (summary) { summary.provinceCount++; summary.population += p.population.total; }
  }
  for (const army of armies) {
    const summary = byTag.get(army.owner);
    if (summary) summary.armyStrength += calculateArmySize(army);
  }
  for (const summary of byTag.values()) summary.difficulty = estimateCountryDifficulty(summary, summary.country);
  const sorted = [...byTag.values()].sort((a, b) => a.country.name.localeCompare(b.country.name, 'pt-BR'));
  return { byTag, provinceById, sorted };
}

export function searchCountries(summaries: CountrySummary[], query: string) {
  const term = query.trim().toLocaleLowerCase('pt-BR');
  return summaries.filter(({ country }) => country.name.toLocaleLowerCase('pt-BR').includes(term) || country.tag.toLowerCase().includes(term));
}

/** Capital-centered viewport, using nearby owned centers to avoid distant holdings. */
export function getCountryInitialView(country: Country, provinces: Province[]): MapViewBox | undefined {
  const owned = provinces.filter(p => p.owner === country.tag);
  const capital = owned.find(p => p.id === (country.capitalId ?? country.capital)) ?? owned[0];
  if (!capital) return undefined;
  const nearby = owned.filter(p => Math.abs(p.center.x - capital.center.x) < 900 && Math.abs(p.center.y - capital.center.y) < 600);
  const width = Math.max(240, ...nearby.map(p => Math.abs(p.center.x - capital.center.x) * 2 + 120));
  const height = Math.max(180, ...nearby.map(p => Math.abs(p.center.y - capital.center.y) * 2 + 120));
  return { x: capital.center.x - width / 2, y: capital.center.y - height / 2, w: width, h: height };
}
