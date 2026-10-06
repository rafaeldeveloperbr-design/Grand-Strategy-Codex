import type { Army, Country, Province, SupplyStatus, War, DiplomaticRelation, ActiveBattle } from '../../types';
import { calculateArmySize, calculateArmyOrganization, calculateArmyMorale, calculateLocalSupplyCapacity, getArmySupply } from '../../engine/military';

export type MapMode = 'political' | 'development' | 'population' | 'unrest' | 'supply' | 'terrain';
export const MAP_MODES: { id: MapMode; label: string; description: string }[] = [
  { id: 'terrain', label: 'TERRENO', description: 'Terreno e modificadores militares' },
  { id: 'political', label: 'Político', description: 'Controle atual por país' },
  { id: 'development', label: 'Desenvolvimento', description: 'Desenvolvimento provincial' },
  { id: 'population', label: 'População', description: 'População total; escala relativa ao mapa atual' },
  { id: 'unrest', label: 'Unrest', description: 'Maior valor entre agitação e organização rebelde' },
  { id: 'supply', label: 'Supply', description: 'Capacidade logística local base; não representa acesso militar' },
];
export const SUPPLY_LABELS: Record<SupplyStatus, string> = { good: 'Bom', low: 'Baixo', critical: 'Crítico' };
export type ArmyReadout = { troops: number; organization: number; morale: number; supply: SupplyStatus; supplyRatio: number; status: string };
export type ArmyVisualGroup = {
  key: string; owner: string; provinceId: string | null; armies: Army[]; troops: number;
  x: number; y: number; offsetX: number; offsetY: number; moving: boolean; fighting: boolean;
};

// Presentation-only offsets: sorted owners receive stable slots, without mutating armies.
export function groupOffset(index: number) {
  if (index === 0) return { offsetX: 0, offsetY: 0 };
  const slots = [{ offsetX: 58, offsetY: 0 }, { offsetX: -58, offsetY: 0 }, { offsetX: 0, offsetY: 38 }];
  const slot = slots[(index - 1) % slots.length];
  const ring = Math.floor((index - 1) / slots.length) + 1;
  return { offsetX: slot.offsetX * ring, offsetY: slot.offsetY * ring };
}

export function buildArmyPresentation(armies: Army[], provinces: Province[]) {
  const provinceById = new Map(provinces.map(province => [province.id, province]));
  const armyById = new Map(armies.map(army => [army.id, army]));
  const byLocation = new Map<string, Army[]>();
  const byOwnerLocation = new Map<string, Map<string, Army[]>>();
  for (const army of armies) {
    if (!army.location) continue;
    const local = byLocation.get(army.location) ?? [];
    local.push(army); byLocation.set(army.location, local);
    const owners = byOwnerLocation.get(army.location) ?? new Map<string, Army[]>();
    const friendly = owners.get(army.owner) ?? [];
    friendly.push(army); owners.set(army.owner, friendly); byOwnerLocation.set(army.location, owners);
  }
  const supplyByArmy = new Map<string, ReturnType<typeof getArmySupply>>();
  for (const [provinceId, owners] of byOwnerLocation) {
    for (const friendly of owners.values()) {
      const supply = getArmySupply(friendly[0], provinceById.get(provinceId), friendly);
      for (const army of friendly) supplyByArmy.set(army.id, supply);
    }
  }
  const readouts = new Map<string, ArmyReadout>();
  const groupsByAnchor = new Map<string, Map<string, ArmyVisualGroup>>();
  const localTotals = new Map<string, { count: number; troops: number }>();
  for (const army of armies) {
    const supply = supplyByArmy.get(army.id) ?? getArmySupply(army);
    const troops = calculateArmySize(army);
    readouts.set(army.id, { troops, organization: calculateArmyOrganization(army), morale: calculateArmyMorale(army), supply: supply.status, supplyRatio: supply.ratio, status: army.inCombat ? 'Combate' : army.destination ? 'Movendo' : 'Parado' });
    const province = army.location ? provinceById.get(army.location) : undefined;
    const inTransit = !!(army.destination && army.position && army.movementProgress > 0);
    if (!province && !inTransit) continue;
    if (province && !inTransit) {
      const total = localTotals.get(province.id) ?? { count: 0, troops: 0 };
      total.count++; total.troops += troops; localTotals.set(province.id, total);
    }
    const position = inTransit ? army.position! : { x: province!.center.x, y: province!.center.y + 28 };
    // Co-marching armies group only at the same actual position and same next step.
    const anchor = inTransit ? JSON.stringify(['march', army.location, army.destination, position.x, position.y]) : JSON.stringify(['province', army.location]);
    const owners = groupsByAnchor.get(anchor) ?? new Map<string, ArmyVisualGroup>();
    const group = owners.get(army.owner) ?? { key: JSON.stringify([anchor, army.owner]), owner: army.owner, provinceId: army.location, armies: [], troops: 0, x: position.x, y: position.y, offsetX: 0, offsetY: 0, moving: false, fighting: false };
    group.armies.push(army); group.troops += troops; group.moving ||= !!army.destination; group.fighting ||= !!army.inCombat;
    owners.set(army.owner, group); groupsByAnchor.set(anchor, owners);
  }
  const groups: ArmyVisualGroup[] = [];
  for (const owners of groupsByAnchor.values()) {
    [...owners.values()].sort((a, b) => a.owner.localeCompare(b.owner)).forEach((group, index) => {
      const first = group.armies[0];
      if (first.destination && first.position && first.movementProgress > 0) {
        // Stable across movement ticks: position is used to group, never as a React identity.
        group.key = JSON.stringify(['march', group.owner, group.armies.map(army => army.id).sort()]);
      }
      Object.assign(group, groupOffset(index)); groups.push(group);
    });
  }
  return { groups, readouts, armyById, provinceById, byLocation, localTotals };
}
export type ArmyPresentation = ReturnType<typeof buildArmyPresentation>;

export function buildMapValues(provinces: Province[], mode: MapMode) {
  const values = new Map<string, number>();
  for (const province of provinces) values.set(province.id, mode === 'development' ? province.development : mode === 'population' ? province.population.total : mode === 'unrest' ? Math.max(province.unrest ?? 0, province.rebellion?.progress ?? 0) : mode === 'supply' ? calculateLocalSupplyCapacity(province) : 0);
  const max = mode === 'unrest' ? 100 : [...values.values()].reduce((highest, value) => Math.max(highest, value), 1);
  return { values, min: 0, max };
}
export function numericMapColor(value: number, max: number, mode: MapMode): string {
  const ratio = Math.min(1, Math.max(0, value / max));
  const hue = mode === 'unrest' ? 145 - ratio * 145 : mode === 'supply' ? 35 + ratio * 110 : 215 - ratio * 40;
  return `hsl(${hue.toFixed(1)} 52% ${(30 + ratio * 28).toFixed(1)}%)`;
}

export function buildWarPresentation(provinces: Province[], countries: Country[], wars: War[], relations: DiplomaticRelation[], battles: ActiveBattle[]) {
  const hostile = new Map<string, Set<string>>();
  const addPair = (a: string, b: string) => { const enemies = hostile.get(a) ?? new Set<string>(); enemies.add(b); hostile.set(a, enemies); };
  for (const war of wars) { addPair(war.attacker, war.defender); addPair(war.defender, war.attacker); }
  for (const relation of relations) if (relation.status === 'war') { addPair(relation.countryA, relation.countryB); addPair(relation.countryB, relation.countryA); }
  const provinceById = new Map(provinces.map(province => [province.id, province]));
  const frontlines = new Set<string>();
  const occupied = new Set(wars.flatMap(war => [...war.occupiedByAttacker, ...war.occupiedByDefender]));
  const battleProvinces = new Set(battles.map(battle => battle.provinceId));
  for (const province of provinces) if (province.neighbors.some(id => hostile.get(province.owner)?.has(provinceById.get(id)?.owner ?? ''))) frontlines.add(province.id);
  const capitals = new Set(countries.map(country => country.capitalId ?? country.capital).filter((id): id is string => !!id));
  const capitalsAtRisk = new Set([...capitals].filter(id => frontlines.has(id) || occupied.has(id) || battleProvinces.has(id)));
  return { frontlines, occupied, battleProvinces, capitals, capitalsAtRisk };
}
export type WarPresentation = ReturnType<typeof buildWarPresentation>;
