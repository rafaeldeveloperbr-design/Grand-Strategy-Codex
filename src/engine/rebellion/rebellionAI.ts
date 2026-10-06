import type { Army, Country, GameDate, Province } from '../../types';
import type { DiplomaticRelation } from '../../types/diplomacy';
import { calculateArmySiege, findPath, getArmySupply, moveArmy, recoverArmy } from '../military';
import { getBuildingLevel } from '../../data/buildings';
import { MILITARY_BALANCE } from '../military/balance';
import { calculateArmyCombatStats } from '../military/armyStats';
const getArmyCombatPower = (army: Army): number => { const stats = calculateArmyCombatStats(army); return stats.attack + stats.defense + stats.shock; };
import { applyRebellionAction } from './rebellionActions';
import { REBELLION_BALANCE as B } from './balance';
import { rebellionDay, troopCount } from './rebellionUtils';

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

export function planRebelMovement(armies: Army[], provinces: Province[], countries: Country[], relations: DiplomaticRelation[], date?: GameDate): Army[] {
  const factions = countries.flatMap(c => c.rebellions ?? []).filter(f => f.status === 'active');
  return armies.map(a => {
    if (a.inCombat || a.destination || !a.location || troopCount(a) <= 0) return a;
    const faction = factions.find(f => f.id === a.owner);
    if (!faction) return a;
    const army = { ...a, rebellionFactionId: faction.id, originalOwner: faction.owner };
    // An active civil war grants access to its government; sibling occupations
    // must not cut the route through the same country's territory.
    const access = relations.filter(r => !((r.countryA === faction.id && r.countryB === faction.owner) || (r.countryB === faction.id && r.countryA === faction.owner)));
    access.push({ countryA: faction.id, countryB: faction.owner, status: 'war', opinion: -50, pactDaysRemaining: 0 });
    for (const sibling of factions.filter(f => f.owner === faction.owner && f.id !== faction.id)) {
      if (!access.some(r => (r.countryA === faction.id && r.countryB === sibling.id) || (r.countryB === faction.id && r.countryA === sibling.id))) {
        access.push({ countryA: faction.id, countryB: sibling.id, status: 'peace', opinion: 80, pactDaysRemaining: 0 });
      }
    }
    const capitalObjective = faction.objective.kind === 'replace_government' || faction.objective.kind === 'reform';
    const day = date ? rebellionDay(date) : undefined;
    const since = a.rebellionMovement?.blockedSinceDay;
    const escalated = capitalObjective && day !== undefined && since !== undefined && day - since >= B.escalation.blockedDays;
    const requiredRatio = escalated ? B.escalation.minimumPowerRatio : B.aiAdvantage;
    const targets = faction.objective.targets.filter(id => capitalObjective || provinces.find(p => p.id === id)?.owner !== faction.id);
    let decision: NonNullable<Army['rebellionMovement']> = faction.objective.targets.length
      ? { state: 'defending', reason: 'Mantendo o controle dos objetivos.' }
      : { state: 'blocked', reason: 'A facção não possui um objetivo territorial válido.' };
    // Project readiness at the destination, including hostile supply and forts.
    const ratios = new Map(
      provinces.map(p => {
        const enemies = armies.filter(
          enemy =>
            enemy.location === p.id &&
            enemy.owner === faction.owner &&
            troopCount(enemy) > 0
        );

        const fort = Math.min(
          MILITARY_BALANCE.maximumFortDefense,
          (p.defense + getBuildingLevel(p, 'fortress') * 2)
          * MILITARY_BALANCE.fortDefensePerLevel
          / (1 + calculateArmySiege(army) / 20)
        );

        const enemyPower = enemies.reduce((sum, enemy) => {
          const stats = calculateArmyCombatStats(enemy);

          return sum +
            (
              stats.attack +
              stats.defense * B.projectedPower.defenseWeight
            ) *
            getArmySupply(enemy, p, enemies).combatMultiplier;
        }, 0) * (1 + fort);

        const stats = calculateArmyCombatStats(army);

        const attackPower =
          (
            stats.attack +
            stats.shock * B.projectedPower.attackShockWeight
          ) *
          getArmySupply(army, p).combatMultiplier;

        return [
          p.id,
          enemyPower > 0
            ? attackPower / enemyPower
            : Infinity,
        ] as const;
      })
    );



    const superior = new Set(
      provinces
        .filter(
          p =>
            (ratios.get(p.id) ?? 0) <
            requiredRatio
        )
        .map(p => p.id)
    );
    for (const target of targets) {
      if (a.location === target) {
        const controller = provinces.find(p => p.id === target)?.owner;
        decision = {
          target, state: 'defending', reason: controller === faction.id
            ? 'Mantendo posição no objetivo até concluir o controle.'
            : controller?.startsWith('rebel_v2_') ? 'Objetivo ocupado por outra facção; mantendo posição sem controle próprio.'
              : 'Mantendo posição no objetivo enquanto o controle é resolvido pelo combate ou ocupação.'
        };
        continue;
      }
      const safeMap = provinces.filter(p => !superior.has(p.id) || p.id === a.location);
      const safeRoute = findPath(a.location, target, safeMap, a.owner, access);
      const route = safeRoute.length ? safeRoute : findPath(a.location, target, provinces, a.owner, access);
      if (!route.length) { decision = { target, state: 'blocked', reason: 'Sem rota acessível ao objetivo.' }; continue; }
      const obstacle = route.findIndex(id => superior.has(id));
      const projectedRatio = ratios.get(obstacle < 0 ? target : route[obstacle]);
      const preparation = { blockedSinceDay: since ?? day, powerRatio: projectedRatio !== Infinity ? projectedRatio : undefined, requiredRatio };
      const advanceTo = obstacle < 0 ? target : obstacle > 0 ? route[obstacle - 1] : undefined;
      if (!advanceTo) {
        decision = {
          target, state: 'defending', ...preparation, reason: capitalObjective
            ? 'Reagrupando antes do ataque à capital. Força governamental superior; ataque previsto quando força suficiente.'
            : 'Força governamental superior bloqueia o próximo avanço; defendendo posição.'
        }; continue;
      }
      const moved = moveArmy(army, advanceTo, safeRoute.length ? safeMap : provinces, access);
      if (moved) return {
        ...moved, rebellionMovement: {
          target, state: 'marching', ...(obstacle >= 0 ? preparation : { powerRatio: preparation.powerRatio, requiredRatio }),
          reason: obstacle < 0 ? escalated ? 'Escalada após bloqueio prolongado: ataque com vantagem mínima preservada.' : 'Marchando para o objetivo.' : 'Avançando até posição segura diante da força governamental superior.'
        }
      };
      decision = { target, state: 'blocked', reason: 'Não foi possível emitir a ordem de marcha.' };
    }

    return { ...army, rebellionMovement: decision };
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
