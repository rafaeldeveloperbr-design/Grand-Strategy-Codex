import type { Country, DiplomaticRelation, War } from '../../types';
import { getRelation } from './diplomacyRelations';
export const isDiplomaticCountry = (country?: Country): boolean => !!country && !country.isAnnexed && country.provinces.length > 0 && !country.tag.startsWith('rebel_');
export const areAtWar = (rs: DiplomaticRelation[],a: string,b: string): boolean => getRelation(rs,a,b)?.status === 'war';
export const areAllied = (rs: DiplomaticRelation[],a: string,b: string): boolean => !!getRelation(rs,a,b)?.alliance && !areAtWar(rs,a,b);
export const hasNonAggressionPact = (rs: DiplomaticRelation[],a: string,b: string,day: number): boolean => (getRelation(rs,a,b)?.nonAggressionPact?.expiresAt ?? -Infinity) > day;
export function hasMilitaryAccess(rs: DiplomaticRelation[], visitor: string, host: string): boolean {
  if (visitor === host) return true;
  const r = getRelation(rs,visitor,host);
  return !!r && r.status !== 'war' && (!!r.alliance || !!r.militaryAccess?.includes(host));
}
/** Hostile entry for combat is separate from peaceful access. */
export const canEnterTerritory = (rs: DiplomaticRelation[],visitor: string,host: string): boolean => hasMilitaryAccess(rs,visitor,host) || areAtWar(rs,visitor,host);
export const getAllies = (rs: DiplomaticRelation[],tag: string): string[] => rs.filter(r => r.alliance && r.status === 'peace' && (r.countryA === tag || r.countryB === tag)).map(r => r.countryA === tag ? r.countryB : r.countryA);
export const getGuarantors = (rs: DiplomaticRelation[],tag: string): string[] => rs.filter(r => r.countryA === tag || r.countryB === tag).flatMap(r => (r.guarantees ?? []).filter(g => g !== tag));
export const getCountryWars = (wars: War[], tag: string): War[] => wars.filter(w => w.attacker === tag || w.defender === tag);
