export type CountryTag = string;
export type DiplomaticStatus = 'peace' | 'war';
export type CasusBelliType = 'conquest' | 'reconquest' | 'liberation' | 'humiliate';
export interface CasusBelli {
  id: string; attacker: CountryTag; target: CountryTag; type: CasusBelliType;
  createdAt: number; expiresAt?: number; targetProvinceIds?: string[];
}
export type ProposalKind = 'alliance' | 'nap' | 'access' | 'call';
export interface DiplomaticProposal {
  id: string; kind: ProposalKind; from: string; to: string; createdAt: number;
  expiresAt: number; warId?: string;
  /** Proactive AI offer to the player; refusals/silence get a longer retry. */
  aiToPlayer?: boolean;
}
/** One canonical pair; opinion/trust and bilateral agreements are symmetric. */
export interface DiplomaticRelation {
  countryA: CountryTag; countryB: CountryTag;
  opinion: number; trust: number; status: DiplomaticStatus;
  alliance?: { since: number };
  nonAggressionPact?: { since: number; expiresAt: number };
  /** Countries granting access to the other member. */
  militaryAccess?: CountryTag[];
  /** Countries guaranteeing the other member. */
  guarantees?: CountryTag[];
  casusBelli?: CasusBelli[];
  proposals?: DiplomaticProposal[];
  cooldowns?: Record<string, number>;
  lastWarEndedAt?: number;
  lastNapBroken?: { by: string; at: number };
}
export type DiplomacyAction = 'offerAlliance' | 'breakAlliance' | 'offerNap' | 'breakNap'
  | 'requestAccess' | 'revokeAccess' | 'guarantee' | 'withdrawGuarantee' | 'declareWar' | 'generateConquestCb';
export interface War {
  /** ID único da guerra */
  id: string;
  campaignId?: string;
  casusBelliType?: CasusBelliType;
  /** País atacante */
  attacker: string;
  /** País defensor */
  defender: string;
  /** Data de início */
  startDate: { year: number; month: number; day: number };
  /** Pontuação de guerra (positivo = atacante vencendo) */
  warScore: number;
  /** Baixas do atacante */
  attackerCasualties: number;
  /** Baixas do defensor */
  defenderCasualties: number;
  /** Províncias ocupadas pelo atacante */
  occupiedByAttacker: string[];
  /** Províncias ocupadas pelo defensor */
  occupiedByDefender: string[];
  /** Dias desde o início da guerra (calculado automaticamente) */
  daysSinceStart?: number;
}
