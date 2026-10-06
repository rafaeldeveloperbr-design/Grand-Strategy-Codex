import type { Country, DiplomaticRelation, Province } from '../../types';
import { DIPLOMACY_BALANCE as B } from './diplomacyBalance';
import { createRelation, relationKey } from './diplomacyRelations';
import { isDiplomaticCountry } from './diplomacySelectors';
/** Scenario balance, not historical claims: borders start open to cooperation. */
export function createInitialDiplomacy(countries: Country[],provinces: Province[]): DiplomaticRelation[] {
  const valid = countries.filter(isDiplomaticCountry),owners = new Map(provinces.map(p => [p.id,p.owner]));
  const borders = new Set(provinces.flatMap(p => p.neighbors.flatMap(id => {
    const owner = owners.get(id); return owner && owner !== p.owner ? [relationKey(p.owner,owner)] : [];
  })));
  return valid.flatMap((a,index) => valid.slice(index+1).map(b => ({...createRelation(a.tag,b.tag),
    opinion: borders.has(relationKey(a.tag,b.tag)) ? B.initialBorderOpinion : B.initialDistantOpinion})));
}
