import type { Army, Country, GameDate, Province } from '../../types';
import { createRegiment } from '../military';
import { UNIT_DEFINITIONS } from '../../data/units';
import { REBELLION_BALANCE as B } from './balance';
import { clamp, rebellionDay, troopCount } from './rebellionUtils';
import { createRebelArmy } from './rebellionSpawner';

/** Finite local mobilization, once per faction/day; never resurrect a defeated force. */
export function reinforceRebellions(provinces: Province[], countries: Country[], armies: Army[], date: GameDate) {
  const day = rebellionDay(date), rates = B.reinforcements;
  for (const faction of countries.flatMap(c => c.rebellions ?? [])) {
    if (faction.status !== 'active' || faction.lastReinforcementDay === day) continue;
    const living = armies.filter(a => a.owner === faction.id && troopCount(a) > 0);
    const controlled = provinces.filter(p => p.owner === faction.id);
    const support = clamp(faction.support) / 100;
    const sources = provinces.filter(p => p.owner === faction.id || (support * 100 >= rates.minimumSupport
      && faction.involvedProvinces.includes(p.id) && p.owner === faction.owner));
    const population = sources.reduce((sum, p) => sum + p.population.total, 0);
    const controlledPopulation = controlled.reduce((sum, p) => sum + p.population.total, 0);
    const strength = living.reduce((sum, a) => sum + troopCount(a), 0);
    const recipient = living.filter(a => !a.inCombat && !a.destination && a.location && sources.some(p => p.id === a.location))
      .sort((a, b) => a.id.localeCompare(b.id))[0];
    const canRaise = living.length === 0 && controlled.length > 0;
    let added = Math.max(0, Math.floor(Math.min(rates.dailyCap, rates.maximumStrength - strength,
      population * rates.populationPoolRatio - (faction.recruitedTroops ?? 0),
      population * support * rates.supportPopulationRate + controlledPopulation * Math.max(support, rates.controlledMinimumSupport) * rates.controlledPopulationRate)));
    if ((!recipient && !canRaise) || (!controlled.length && (!living.length || support * 100 < rates.minimumSupport))) added = 0;
    if (added > 0) {
      let remaining = added;
      provinces = provinces.map(p => {
        if (!sources.some(source => source.id === p.id)) return p;
        const share = Math.min(remaining, Math.ceil(added * p.population.total / population));
        remaining -= share;
        const total = p.population.total - share;
        return { ...p, population: { ...p.population, total, employed: Math.min(p.population.employed, total), unemployed: Math.min(p.population.unemployed, Math.max(0, total - p.population.employed)) } };
      });
      if (recipient) {
        const regiments = recipient.regiments.map(r => ({ ...r }));
        remaining = added;
        for (const regiment of regiments) {
          const definition = UNIT_DEFINITIONS[regiment.type];

          const maxStrength =
            regiment.maxStrength ??
            definition.maxStrength;

          const fill = Math.min(
            remaining,
            Math.max(
              0,
              maxStrength - regiment.strength
            )
          );

          if (fill <= 0) {
            continue;
          }

          const oldStrength = regiment.strength;
          const newStrength = oldStrength + fill;

          const recruitOrganization =
            definition.maxOrganization * 0.60;

          const recruitMorale =
            definition.maxMorale * 0.70;

          regiment.organization =
            (
              (regiment.organization ??
                definition.maxOrganization) *
              oldStrength +
              recruitOrganization * fill
            ) /
            newStrength;

          regiment.morale =
            (
              regiment.morale *
              oldStrength +
              recruitMorale * fill
            ) /
            newStrength;

          regiment.strength = newStrength;

          remaining -= fill;
        }
        while (remaining > 0) {
          const count = Math.min(remaining, UNIT_DEFINITIONS.infantry.maxStrength);
          regiments.push({ ...createRegiment('infantry'), strength: count, originProvinceId: recipient.location! });
          remaining -= count;
        }
        armies = armies.map(a => a.id === recipient.id ? { ...a, regiments } : a);
      } else {
        const raised = createRebelArmy({ ...faction, militaryStrength: added }, controlled[0]);
        armies = [...armies, { ...raised, id: `${faction.id}_reinforcement_${day}` }];
      }
    }
    countries = countries.map(c => ({
      ...c, rebellions: c.rebellions?.map(f => f.id === faction.id ? {
        ...f,
        lastReinforcementDay: day, reinforcementRate: added, recruitedTroops: (f.recruitedTroops ?? 0) + added, militaryStrength: strength + added
      } : f)
    }));
  }
  return { provinces, countries, armies };
}
