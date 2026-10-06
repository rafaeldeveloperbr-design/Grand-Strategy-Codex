import type { Army, Country, Province, Regiment } from '../../types';
import { UNIT_DEFINITIONS } from '../../data/units';
import { createRegiment, calculateArmySpeed } from '../military';
import { normalizePopulation } from '../population';
import { REBELLION_BALANCE as B } from './balance';
import { clamp, troopCount } from './rebellionUtils';
import type { RebelType, RebellionFaction, RebellionObjective } from './types';

/** No religion/culture inference: unsupported types are deliberately never selected. */
export function selectRebelType(
  p: Province,
  country?: Country
): RebelType {
  if (
    p.originalOwner &&
    p.originalOwner !== p.owner &&
    p.lastConquestDate !== undefined
  ) {
    return 'separatists';
  }

  if (
    country &&
    country.resources.stability <
      B.revolutionaryStability &&
    country.activeLaws.governance ===
      'governance_centralized'
  ) {
    return 'revolutionaries';
  }

  if (
    country &&
    country.resources.stability <
      B.pretenderStability &&
    country.resources.prestige <= 0
  ) {
    return 'pretenders';
  }

  return 'peasants';
}
export function createObjective(type: RebelType, involved: Province[], country: Country, provinces: Province[]): RebellionObjective {
  const capital = provinces.find(p => p.id === (country.capitalId ?? country.capital)) ?? provinces.filter(p => p.owner === country.tag).sort((a, b) => b.development - a.development || a.id.localeCompare(b.id))[0];
  const kind = type === 'separatists' || type === 'nationalists' ? 'independence' : type === 'pretenders' ? 'replace_government' : type === 'revolutionaries' || type === 'religious' ? 'reform' : 'tax_relief';
  return { kind, targets: kind === 'replace_government' || kind === 'reform' ? [capital?.id ?? involved[0].id] : involved.map(p => p.id), heldDays: 0, requiredDays: B.objectiveDays[kind] };
}
export function calculateRebellionStrength(provinces: Province[], type: RebelType, nationalTroops = 0): number {
  const local = provinces.reduce((sum, p) => sum + normalizePopulation(p.population).total * B.populationMobilization *
    (0.5 + clamp(p.unrest ?? 0) / 100) * (0.5 + clamp(p.rebellion?.progress ?? 100) / 200) * (1 + p.development * B.developmentStrength), 0);
  return Math.round(Math.max(B.minTroops, Math.min(B.maxTroops, (local + Math.min(local, nationalTroops * B.nationalStrength)) * B.strength[type])));
}
export function createRebelArmy(faction: RebellionFaction, province: Province): Army {
  const regiments: Regiment[] = [];
  for (let remaining = faction.militaryStrength; remaining > 0; remaining -= UNIT_DEFINITIONS.infantry.maxStrength) {
    regiments.push({ ...createRegiment('infantry'), strength: Math.min(remaining, UNIT_DEFINITIONS.infantry.maxStrength), originProvinceId: province.id });
  }
  const army: Army = { id: `${faction.id}_army`, owner: faction.id, rebellionFactionId: faction.id,
    name: `${faction.type}: ${province.name}`, originalOwner: faction.owner, regiments,
    location: province.id, destination: null, targetDestination: null, path: [], movementProgress: 0, movementSpeed: 0,
    position: null, inCombat: false, separatistMode: false };
  return { ...army, movementSpeed: calculateArmySpeed(army) };
}
export function groupRebellion(origin: Province, provinces: Province[], country: Country): Province[] {
  const type = selectRebelType(origin, country), group: Province[] = [], queue = [origin.id], seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const p = provinces.find(item => item.id === id);
    if (!p || p.owner !== origin.owner || p.rebellion?.factionId || (p.id !== origin.id && (p.unrest ?? 0) < B.groupingUnrest) || selectRebelType(p, country) !== type) continue;
    if (type === 'separatists' && p.originalOwner !== origin.originalOwner) continue;
    group.push(p); queue.push(...p.neighbors);
  }
  return group;
}
export function nationalMilitaryStrength(country: Country, armies: Army[]): number {
  return armies.filter(a => a.owner === country.tag).reduce((sum, a) => sum + troopCount(a), 0);
}
