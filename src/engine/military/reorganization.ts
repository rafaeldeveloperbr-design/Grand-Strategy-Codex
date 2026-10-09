import type { Army, Regiment, Province, ActiveBattle } from '../../types';
import { calculateArmySpeed } from './militaryUtils';
import { splitArmy, mergeArmies } from './movementEngine';
import { isRecognizedUnitType } from '../../data/units';

export const REORGANIZATION_BLOCKS = {
  invalid: 'Exército inválido', foreign: 'Exército pertence a outro país', rebel: 'Exércitos rebeldes não podem ser reorganizados',
  battle: 'Exército em batalha', moving: 'Exército em movimento ou com rota ativa. Limpe a rota antes de reorganizar.',
  location: 'Localização inválida', differentLocation: 'Exércitos em províncias diferentes', same: 'Selecione outro exército',
  none: 'Nenhum regimento selecionado', all: 'Todos os regimentos selecionados', indices: 'Seleção de regimentos inválida',
  insufficient: 'Não há regimentos suficientes', group: 'Selecione pelo menos dois exércitos',
  stale: 'A composição mudou. Revise a seleção antes de confirmar.',
} as const;
export interface ReorganizationContext { armies: Army[]; provinces: Province[]; playerCountryTag: string; activeBattles?: ActiveBattle[] }
export type ReorganizationResult = { success: true; armies: Army[]; selectedArmyId: string } | { success: false; reason: string };
export function getArmyReorganizationBlockReason(army: Army | undefined, ctx: ReorganizationContext): string | null {
  const B = REORGANIZATION_BLOCKS;
  if (!army || !ctx.armies.some(a => a.id === army.id) || !army.regiments.some(r => r.strength > 0) || !army.regiments.every(r => isRecognizedUnitType(r.type) && Number.isFinite(r.strength) && r.strength >= 0)) return B.invalid;
  if (army.owner.startsWith('rebel_') || army.rebellionFactionId) return B.rebel;
  if (army.owner !== ctx.playerCountryTag) return B.foreign;
  if (army.embarkedFleetId) return 'Army embarcado: desembarque antes de reorganizar.';
  if (army.inCombat || ctx.activeBattles?.some(b => b.participantArmyIds.includes(army.id))) return B.battle;
  if (army.destination || army.targetDestination || army.path.length || army.movementPlan?.waypoints.length || army.movementProgress > 0 || army.position) return B.moving;
  if (!army.location || !ctx.provinces.some(p => p.id === army.location)) return B.location;
  return null;
}
export const canReorganizeArmy = (army: Army | undefined, ctx: ReorganizationContext) => getArmyReorganizationBlockReason(army, ctx) === null;
export function getRegimentSelectionBlockReason(army: Army, indices: readonly number[]): string | null {
  if (!indices.length) return REORGANIZATION_BLOCKS.none;
  if (new Set(indices).size !== indices.length || indices.some(i => !Number.isInteger(i) || i < 0 || i >= army.regiments.length)) return REORGANIZATION_BLOCKS.indices;
  if (indices.length === army.regiments.length || !army.regiments.some((r, i) => r.strength > 0 && !indices.includes(i))) return REORGANIZATION_BLOCKS.all;
  return null;
}
export function getArmyPairBlockReason(source: Army | undefined, target: Army | undefined, ctx: ReorganizationContext): string | null {
  const reason = getArmyReorganizationBlockReason(source, ctx) ?? getArmyReorganizationBlockReason(target, ctx);
  if (reason) return reason;
  if (source!.id === target!.id) return REORGANIZATION_BLOCKS.same;
  return source!.location === target!.location ? null : REORGANIZATION_BLOCKS.differentLocation;
}
export function getMergeGroupBlockReason(ids: readonly string[], ctx: ReorganizationContext): string | null {
  if (ids.length < 2) return REORGANIZATION_BLOCKS.group;
  if (new Set(ids).size !== ids.length) return REORGANIZATION_BLOCKS.invalid;
  const base = ctx.armies.find(a => a.id === ids[0]);
  for (const id of ids) {
    const army = ctx.armies.find(a => a.id === id);
    const reason = getArmyReorganizationBlockReason(army, ctx);
    if (reason) return reason;
    if (army!.location !== base!.location) return REORGANIZATION_BLOCKS.differentLocation;
  }
  return null;
}
const withRegiments = (army: Army, regiments: Regiment[]): Army => ({ ...army, regiments, movementSpeed: calculateArmySpeed({ regiments }) });
const remainingAndSelected = (army: Army, indices: readonly number[]) => {
  const selected = new Set(indices);
  return { remaining: army.regiments.filter((_, i) => !selected.has(i)), transferred: army.regiments.filter((_, i) => selected.has(i)) };
};
function sourceReason(source: Army | undefined, indices: readonly number[], ctx: ReorganizationContext, expected?: string) {
  return getArmyReorganizationBlockReason(source, ctx) ?? (expected && JSON.stringify(source!.regiments) !== expected ? REORGANIZATION_BLOCKS.stale : getRegimentSelectionBlockReason(source!, indices));
}
export function splitArmyByRegiments(sourceId: string, indices: readonly number[], ctx: ReorganizationContext, expected?: string): ReorganizationResult {
  const source = ctx.armies.find(a => a.id === sourceId);
  const reason = sourceReason(source, indices, ctx, expected);
  if (reason) return { success: false, reason };
  const baseName = `${source!.name} (Destacamento)`;
  let name = baseName, suffix = 2;
  while (ctx.armies.some(a => a.name === name && a.owner === source!.owner)) name = `${baseName} ${suffix++}`;
  const created = splitArmy(source!, [...indices], name, ctx.armies.map(a => a.id));
  if (!created) return { success: false, reason: REORGANIZATION_BLOCKS.indices };
  const original = withRegiments(source!, remainingAndSelected(source!, indices).remaining);
  return { success: true, armies: [...ctx.armies.map(a => a.id === sourceId ? original : a), created], selectedArmyId: created.id };
}
export function splitArmyByHalf(sourceId: string, ctx: ReorganizationContext): ReorganizationResult {
  const source = ctx.armies.find(a => a.id === sourceId);
  const reason = getArmyReorganizationBlockReason(source, ctx);
  if (reason) return { success: false, reason };
  if (source!.regiments.length < 2) return { success: false, reason: REORGANIZATION_BLOCKS.insufficient };
  return splitArmyByRegiments(sourceId, Array.from({ length: Math.floor(source!.regiments.length / 2) }, (_, i) => i), ctx);
}
export function transferRegiments(sourceId: string, targetId: string, indices: readonly number[], ctx: ReorganizationContext, expected?: string): ReorganizationResult {
  const source = ctx.armies.find(a => a.id === sourceId), target = ctx.armies.find(a => a.id === targetId);
  const reason = getArmyPairBlockReason(source, target, ctx) ?? sourceReason(source, indices, ctx, expected);
  if (reason) return { success: false, reason };
  const { remaining, transferred } = remainingAndSelected(source!, indices);
  return { success: true, armies: ctx.armies.map(a => a.id === sourceId ? withRegiments(a, remaining) : a.id === targetId ? withRegiments(a, [...a.regiments, ...transferred]) : a), selectedArmyId: sourceId };
}
export function mergeArmyGroup(ids: readonly string[], ctx: ReorganizationContext): ReorganizationResult {
  const reason = getMergeGroupBlockReason(ids, ctx);
  if (reason) return { success: false, reason };
  const group = ids.map(id => ctx.armies.find(a => a.id === id)!);
  const merged = group.slice(1).reduce((base, army) => mergeArmies(base, army), group[0]);
  return { success: true, armies: ctx.armies.filter(a => !ids.includes(a.id) || a.id === merged.id).map(a => a.id === merged.id ? merged : a), selectedArmyId: merged.id };
}
