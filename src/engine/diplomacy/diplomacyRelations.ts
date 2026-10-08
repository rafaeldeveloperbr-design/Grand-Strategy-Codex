import type { DiplomaticRelation, GameDate } from '../../types';
export const relationKey = (a: string, b: string): string => JSON.stringify([a,b].sort());
export const diplomacyDay = (date: GameDate): number => Math.floor(Date.UTC(date.year, date.month - 1, date.day) / 86400000);
export const clampOpinion = (n: number): number => Math.max(-100, Math.min(100, Number.isFinite(n) ? n : 0));
export const clampTrust = (n: number): number => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 50));
export function getRelation(relations: DiplomaticRelation[], a: string, b: string): DiplomaticRelation | undefined {
  // The growing world calls this inside logistics/trade loops. Compare the
  // unordered pair directly instead of allocating/sorting JSON for every row.
  return relations.find(r => r.countryA === a && r.countryB === b || r.countryA === b && r.countryB === a);
}
/** Scoped snapshot lookup; preserves the canonical first record for duplicate pairs. */
export function indexRelations(relations: DiplomaticRelation[]): Map<string,DiplomaticRelation[]> {
  const index = new Map<string,DiplomaticRelation[]>();
  for (const relation of relations) {
    const key = relationKey(relation.countryA,relation.countryB);
    if (!index.has(key)) index.set(key,[relation]);
  }
  return index;
}
export function createRelation(a: string, b: string): DiplomaticRelation {
  if (a === b) throw new Error('Two distinct countries required.');
  const [countryA,countryB] = [a,b].sort();
  return { countryA,countryB,opinion: 0,trust: 50,status: 'peace' };
}
export function updateRelation(relations: DiplomaticRelation[], a: string, b: string, update: (r: DiplomaticRelation) => DiplomaticRelation): DiplomaticRelation[] {
  const relation = getRelation(relations,a,b) ?? createRelation(a,b);
  const [countryA,countryB] = [a,b].sort();
  const next = update(relation);
  return [...relations.filter(r => relationKey(r.countryA,r.countryB) !== relationKey(a,b)),
    { ...next,countryA,countryB,opinion: clampOpinion(next.opinion),trust: clampTrust(next.trust) }];
}
export const getOpinion = (rs: DiplomaticRelation[], a: string, b: string): number => getRelation(rs,a,b)?.opinion ?? 0;
export const getTrust = (rs: DiplomaticRelation[], a: string, b: string): number => getRelation(rs,a,b)?.trust ?? 50;
export const setOpinion = (rs: DiplomaticRelation[], a: string,b: string,value: number): DiplomaticRelation[] => updateRelation(rs,a,b,r => ({...r,opinion: clampOpinion(value)}));
export const changeOpinion = (rs: DiplomaticRelation[], a: string,b: string,delta: number): DiplomaticRelation[] => setOpinion(rs,a,b,getOpinion(rs,a,b)+delta);
export const setTrust = (rs: DiplomaticRelation[], a: string,b: string,value: number): DiplomaticRelation[] => updateRelation(rs,a,b,r => ({...r,trust: clampTrust(value)}));
export const changeTrust = (rs: DiplomaticRelation[], a: string,b: string,delta: number): DiplomaticRelation[] => setTrust(rs,a,b,getTrust(rs,a,b)+delta);
export function opinionLabel(n: number): string {
  return n <= -75 ? 'Hostil' : n <= -40 ? 'Muito desconfiado' : n <= -10 ? 'Desconfiado'
    : n < 10 ? 'Neutro' : n < 40 ? 'Cordial' : n < 70 ? 'Amig\u00e1vel' : 'Muito amig\u00e1vel';
}
