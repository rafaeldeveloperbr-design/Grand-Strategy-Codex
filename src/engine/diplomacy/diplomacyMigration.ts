import type { DiplomaticProposal, DiplomaticRelation, GameDate, War } from '../../types';
import { clampOpinion, clampTrust, createRelation, diplomacyDay, relationKey } from './diplomacyRelations';
import { DIPLOMACY_BALANCE as B } from './diplomacyBalance';
const object = (v: unknown): Record<string,unknown> => typeof v === 'object' && v !== null ? v as Record<string,unknown> : {};
const number = (v: unknown,fallback: number): number => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
/** Unknown boundary: legacy status/pact countdown is converted exactly once. */
export function migrateDiplomacy(raw: unknown,wars: War[],date: GameDate): DiplomaticRelation[] {
  const pairs = new Map<string,DiplomaticRelation>(),day = diplomacyDay(date);
  for (const value of Array.isArray(raw) ? raw : []) {
    const v = object(value),a = v.countryA,b = v.countryB;
    if (typeof a !== 'string' || typeof b !== 'string' || a === b) continue;
    const r = createRelation(a,b),key = relationKey(a,b),prior = pairs.get(key);
    r.opinion = clampOpinion(number(v.opinion,0)); r.trust = clampTrust(number(v.trust,50));
    r.status = v.status === 'war' || prior?.status === 'war' ? 'war' : 'peace';
    const alliance = object(v.alliance),nap = object(v.nonAggressionPact);
    if (v.status === 'alliance' || typeof alliance.since === 'number') r.alliance = {since: number(alliance.since,day)};
    if (typeof nap.expiresAt === 'number' && nap.expiresAt > day) r.nonAggressionPact = {since: number(nap.since,day),expiresAt: nap.expiresAt};
    else if (v.status === 'non_aggression_pact' && number(v.pactDaysRemaining,0) > 0) r.nonAggressionPact = {since: day,expiresAt: day+number(v.pactDaysRemaining,B.napDuration)};
    const members = [a,b];
    r.militaryAccess = Array.isArray(v.militaryAccess) ? [...new Set(v.militaryAccess.filter((t): t is string => typeof t === 'string' && members.includes(t)))] : [];
    r.guarantees = Array.isArray(v.guarantees) ? [...new Set(v.guarantees.filter((t): t is string => typeof t === 'string' && members.includes(t)))] : [];
    r.casusBelli = (Array.isArray(v.casusBelli) ? v.casusBelli : []).flatMap(value => {
      const c = object(value);
      if (typeof c.id !== 'string' || typeof c.attacker !== 'string' || typeof c.target !== 'string' || !members.includes(c.attacker) || !members.includes(c.target) || c.attacker === c.target
        || !['conquest','reconquest','liberation','humiliate'].includes(String(c.type)) || typeof c.createdAt !== 'number' || c.createdAt > day || c.expiresAt !== undefined && number(c.expiresAt,-Infinity) <= day) return [];
      return [{id: c.id,attacker: c.attacker,target: c.target,type: c.type as NonNullable<DiplomaticRelation['casusBelli']>[number]['type'],createdAt: c.createdAt,
        expiresAt: typeof c.expiresAt === 'number' ? c.expiresAt : undefined,targetProvinceIds: Array.isArray(c.targetProvinceIds) ? c.targetProvinceIds.filter((p): p is string => typeof p === 'string') : undefined}];
    });
    r.proposals = (Array.isArray(v.proposals) ? v.proposals : []).flatMap(value => {
      const p = object(value);
      if (typeof p.id !== 'string' || typeof p.from !== 'string' || typeof p.to !== 'string' || !members.includes(p.from) || !members.includes(p.to) || p.from === p.to || !['alliance','nap','access','call'].includes(String(p.kind))
        || typeof p.createdAt !== 'number' || typeof p.expiresAt !== 'number' || p.expiresAt <= day || p.kind === 'call' && !wars.some(w => w.id === p.warId)) return [];
      return [{id: p.id,kind: p.kind as DiplomaticProposal['kind'],from: p.from,to: p.to,createdAt: p.createdAt,expiresAt: p.expiresAt,warId: typeof p.warId === 'string' ? p.warId : undefined}];
    });
    r.cooldowns = Object.fromEntries(Object.entries(object(v.cooldowns)).filter(([key,value]) => members.some(t => key.startsWith(`${t}:`)) && typeof value === 'number' && Number.isFinite(value) && value > day).map(([key,value]) => [key,value as number]));
    if (typeof v.lastWarEndedAt === 'number') r.lastWarEndedAt = v.lastWarEndedAt;
    const broken = object(v.lastNapBroken);
    if (typeof broken.by === 'string' && members.includes(broken.by) && typeof broken.at === 'number') r.lastNapBroken = {by: broken.by,at: broken.at};
    // Duplicated old directions: deterministic first record, war always wins.
    pairs.set(key,prior ? {...prior,status: r.status} : r);
  }
  for (const w of wars) {
    if (w.attacker === w.defender) continue;
    const key = relationKey(w.attacker,w.defender),r = pairs.get(key) ?? createRelation(w.attacker,w.defender);
    pairs.set(key,{...r,status: 'war'});
  }
  const warPairs = new Set(wars.map(w => relationKey(w.attacker,w.defender)));
  return [...pairs.values()].map(r => {
    // Military records survive migration; orphan war flags are discarded.
    const status = warPairs.has(relationKey(r.countryA,r.countryB)) ? 'war' : 'peace';
    return status === 'war' ? {...r,status,alliance: undefined,nonAggressionPact: undefined,militaryAccess: [],guarantees: [],proposals: []} : {...r,status};
  });
}
