import type { Army, Country, GameDate, Province } from '../../types';
import type { DiplomaticRelation } from '../../types/diplomacy';
import { moveArmy, recoverArmy } from '../military';
import { calculateArmyCombatStats } from '../military/armyStats';
const getArmyCombatPower = (army: Army): number => { const stats = calculateArmyCombatStats(army); return stats.attack + stats.defense + stats.shock; };
import { applyRebellionAction } from './rebellionActions';
import { REBELLION_BALANCE as B } from './balance';

/** Use Military V2 recovery without conjuring national manpower or free troops. */
export function recoverRebelArmies(armies: Army[], provinces: Province[], countries: Country[]): Army[] {
  return armies.map(army => {
    if (!army.rebellionFactionId || !army.location) return army;
    const province = provinces.find(p => p.id === army.location);
    const sponsor = countries.find(c => c.rebellions?.some(f => f.id === army.rebellionFactionId && f.status === 'active'));
    if (!province || !sponsor) return army;
    const budget: Country = { ...sponsor, tag: army.owner, resources: { ...sponsor.resources, gold: 0, manpower: 0 } };
    return recoverArmy(army, budget, province).army;
  });
}

export function planRebelMovement(armies: Army[], provinces: Province[], countries: Country[], relations: DiplomaticRelation[]): Army[] {
  return armies.map(a => {
    if (!a.rebellionFactionId || a.inCombat || a.destination || !a.location) return a;
    const faction = countries.flatMap(c => c.rebellions ?? []).find(f => f.id === a.rebellionFactionId && f.status === 'active');
    if (!faction) return a;
    const targets = faction.objective.targets.filter(id => provinces.find(p => p.id === id)?.owner !== faction.id);
    for (const target of targets) {
      const hostile = armies.filter(enemy => enemy.location === target && enemy.owner === faction.owner);
      if (hostile.reduce((sum, enemy) => sum + getArmyCombatPower(enemy), 0) > getArmyCombatPower(a) / B.aiAdvantage) continue;
      const moved = moveArmy(a, target, provinces, relations);
      if (moved) return moved;
    }
    return a;
  });
}
export function respondToRebellions(provinces: Province[], countries: Country[], armies: Army[], relations: DiplomaticRelation[], date: GameDate, playerTag: string) {
  const logs: string[] = [];
  for (const country of countries.filter(c => c.tag !== playerTag && !c.tag.startsWith('rebel_'))) {
    const active = country.rebellions?.filter(f => f.status === 'active') ?? [];
    const threats = provinces.filter(p => p.owner === country.tag && (p.rebellion?.progress ?? 0) >= B.groupingUnrest).sort((a, b) => b.development - a.development);
    const available = armies.filter(a => a.owner === country.tag && !a.inCombat && !a.destination && a.location);
    for (const faction of active) {
      const enemies = armies.filter(a => a.rebellionFactionId === faction.id);
      const target = enemies.find(a => a.location);
      if (!target?.location) continue;
      const strength = enemies.reduce((sum, a) => sum + getArmyCombatPower(a), 0);
      const committed = armies.filter(a => a.owner === country.tag && a.targetArmyId && enemies.some(enemy => enemy.id === a.targetArmyId));
      if (committed.reduce((sum, a) => sum + getArmyCombatPower(a), 0) >= strength * B.aiAdvantage) continue;
      const responder = available.filter(a => getArmyCombatPower(a) >= strength * B.aiAdvantage).sort((a, b) => getArmyCombatPower(a) - getArmyCombatPower(b))[0];
      if (responder) {
        const moved = responder.location === target.location ? responder : moveArmy(responder, target.location, provinces, relations);
        if (moved) {
          armies = armies.map(a => a.id === moved.id ? { ...moved, targetArmyId: target.id } : a);
          available.splice(available.indexOf(responder), 1);
        }
      } else {
        const result = applyRebellionAction(provinces, countries, armies, country.tag, faction.originProvince, 'negotiate', date);
        if (result.accepted) { ({ provinces, countries, armies } = result); logs.push(`${country.name}: ${result.reason}`); }
      }
    }
    if (threats[0]) {
      const result = applyRebellionAction(provinces, countries, armies, country.tag, threats[0].id, 'concessions', date);
      if (result.accepted) { ({ provinces, countries, armies } = result); logs.push(`${country.name}: ${result.reason}`); }
    }
  }
  return { provinces, countries, armies, logs };
}
