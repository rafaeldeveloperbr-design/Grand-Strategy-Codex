import type { Country, DiplomaticRelation, DiplomaticProposal, Province, War } from '../../types';
import { getRelation } from './diplomacyRelations';
import type { DiplomacyContext } from './diplomacyTypes';
import { isDiplomaticCountry } from './diplomacySelectors';
import { DIPLOMACY_BALANCE as B } from './diplomacyBalance';

/** Ephemeral read indexes. Relation refreshes follow immutable engine updates;
 * first-row lookup and all-row selectors intentionally preserve legacy duplicates. */
export class DiplomacyAIIndex {
  readonly countryByTag = new Map<string, Country>();
  readonly validTags = new Set<string>();
  readonly provinceById = new Map<string, Province>();
  readonly neighborsByTag = new Map<string, Set<string>>();
  readonly armyLocationsByOwner = new Map<string, string[]>();
  readonly powerByTag = new Map<string, number>();
  readonly warsByCountry = new Map<string, War[]>();
  readonly warById = new Map<string, War>();
  readonly enemiesByTag = new Map<string, Set<string>>();
  readonly campaignsByTag = new Map<string, Set<string>>();
  readonly relationsByCountry = new Map<string, DiplomaticRelation[]>();
  readonly alliesByTag = new Map<string, string[]>();
  readonly proposalById = new Map<string, DiplomaticProposal>();
  private readonly relationByPair = new Map<string, Map<string, DiplomaticRelation>>();
  private relations: DiplomaticRelation[];
  private wars: War[];

  constructor(ctx: DiplomacyContext) {
    for (const country of ctx.countries) {
      if (!this.countryByTag.has(country.tag)) this.countryByTag.set(country.tag, country);
      if (isDiplomaticCountry(country)) this.validTags.add(country.tag);
    }
    for (const province of ctx.provinces ?? []) this.provinceById.set(province.id, province);
    for (const province of ctx.provinces ?? []) {
      let neighbors = this.neighborsByTag.get(province.owner);
      if (!neighbors) { neighbors = new Set(); this.neighborsByTag.set(province.owner, neighbors); }
      for (const id of province.neighbors) {
        const owner = this.provinceById.get(id)?.owner;
        if (owner !== undefined) neighbors.add(owner);
      }
    }
    const troops = new Map<string, number>();
    for (const army of ctx.armies ?? []) {
      troops.set(army.owner, (troops.get(army.owner) ?? 0) + army.regiments.reduce((sum, r) => sum + r.strength, 0));
      if (army.location) {
        const locations = this.armyLocationsByOwner.get(army.owner) ?? [];
        locations.push(army.location); this.armyLocationsByOwner.set(army.owner, locations);
      }
    }
    for (const tag of new Set([...this.countryByTag.keys(), ...troops.keys()])) this.powerByTag.set(tag,
      Math.max(B.aiPowerFloor, (troops.get(tag) ?? 0) + (this.countryByTag.get(tag)?.provinces.length ?? 0) * B.aiPowerFloor));
    this.relations = ctx.relations; this.wars = ctx.wars;
    this.indexRelations(ctx.relations); this.indexWars(ctx.wars);
  }

  relation(a: string, b: string) { return this.relationByPair.get(a)?.get(b); }
  power(tag: string) { return this.powerByTag.get(tag) ?? B.aiPowerFloor; }
  neighbors(a: string, b: string) { return this.neighborsByTag.get(a)?.has(b) ?? false; }
  access(visitor: string, host: string) {
    if (visitor === host) return true;
    const r = this.relation(visitor, host);
    return !!r && r.status !== 'war' && (!!r.alliance || !!r.militaryAccess?.includes(host));
  }
  refresh(ctx: DiplomacyContext, pair?: { from: string; to: string }) {
    if (this.relations !== ctx.relations) {
      if (pair) this.refreshPair(ctx.relations, pair.from, pair.to);
      else this.indexRelations(ctx.relations);
      this.relations = ctx.relations;
    }
    if (this.wars !== ctx.wars) { this.indexWars(ctx.wars); this.wars = ctx.wars; }
    return this;
  }
  private refreshPair(relations: DiplomaticRelation[], a: string, b: string) {
    // Existing updateRelation removes every orientation and appends one canonical row.
    const updated = getRelation(relations, a, b);
    const oldRows = this.relationsByCountry.get(a) ?? [];
    const hasProposals = oldRows.some(r => (r.countryA === a && r.countryB === b || r.countryA === b && r.countryB === a) && r.proposals?.length)
      || !!updated?.proposals?.length;
    for (const [tag, other] of a === b ? [[a, b]] : [[a, b], [b, a]]) {
      const pairs = this.relationByPair.get(tag) ?? new Map<string, DiplomaticRelation>();
      if (updated) pairs.set(other, updated); else pairs.delete(other);
      this.relationByPair.set(tag, pairs);
      const rows = (this.relationsByCountry.get(tag) ?? []).filter(r => !(r.countryA === a && r.countryB === b || r.countryA === b && r.countryB === a));
      if (updated) rows.push(updated);
      this.relationsByCountry.set(tag, rows);
      this.alliesByTag.set(tag, rows.filter(r => r.alliance && r.status === 'peace').map(r => r.countryA === tag ? r.countryB : r.countryA));
    }
    // Proposal IDs may also be duplicated across legacy rows. Rebuild only when
    // proposals change to retain flatMap(...).find's global first-match semantics.
    if (hasProposals) {
      this.proposalById.clear();
      for (const r of relations) for (const p of r.proposals ?? []) if (!this.proposalById.has(p.id)) this.proposalById.set(p.id, p);
    }
  }
  private indexRelations(relations: DiplomaticRelation[]) {
    this.relationByPair.clear(); this.relationsByCountry.clear(); this.alliesByTag.clear(); this.proposalById.clear();
    for (const r of relations) {
      for (const [tag, other] of r.countryA === r.countryB ? [[r.countryA, r.countryB]] : [[r.countryA, r.countryB], [r.countryB, r.countryA]]) {
        const pairs = this.relationByPair.get(tag) ?? new Map<string, DiplomaticRelation>();
        if (!pairs.has(other)) pairs.set(other, r);
        this.relationByPair.set(tag, pairs);
        const rows = this.relationsByCountry.get(tag) ?? [];
        rows.push(r); this.relationsByCountry.set(tag, rows);
        if (r.alliance && r.status === 'peace') {
          const allies = this.alliesByTag.get(tag) ?? [];
          allies.push(other); this.alliesByTag.set(tag, allies);
        }
      }
      for (const proposal of r.proposals ?? []) if (!this.proposalById.has(proposal.id)) this.proposalById.set(proposal.id, proposal);
    }
  }
  private indexWars(wars: War[]) {
    this.warsByCountry.clear(); this.warById.clear(); this.enemiesByTag.clear(); this.campaignsByTag.clear();
    for (const war of wars) {
      if (!this.warById.has(war.id)) this.warById.set(war.id, war);
      for (const [tag, enemy] of war.attacker === war.defender ? [[war.attacker, war.defender]] : [[war.attacker, war.defender], [war.defender, war.attacker]]) {
        const rows = this.warsByCountry.get(tag) ?? []; rows.push(war); this.warsByCountry.set(tag, rows);
        const enemies = this.enemiesByTag.get(tag) ?? new Set<string>(); enemies.add(enemy); this.enemiesByTag.set(tag, enemies);
        const campaigns = this.campaignsByTag.get(tag) ?? new Set<string>(); campaigns.add(war.campaignId ?? war.id); this.campaignsByTag.set(tag, campaigns);
      }
    }
  }
}
