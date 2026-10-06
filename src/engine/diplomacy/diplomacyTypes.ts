import type { Army, Country, DiplomaticRelation, GameDate, Province, War } from '../../types';
export interface DiplomacyContext {
  relations: DiplomaticRelation[];
  wars: War[];
  countries: Country[];
  date: GameDate;
  armies?: Army[];
  provinces?: Province[];
}
export interface DiplomacyResult {
  ok: boolean;
  message: string;
  relations: DiplomaticRelation[];
  wars: War[];
}
export const result = (ctx: DiplomacyContext, ok: boolean, message: string): DiplomacyResult => ({ ok, message, relations: ctx.relations, wars: ctx.wars });
