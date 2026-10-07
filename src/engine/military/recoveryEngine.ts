import { UNIT_DEFINITIONS } from '../../data/units';
import type { Army, Country, Province } from '../../types';
import { normalizeMarket } from '../market';
import { MILITARY_BALANCE } from './balance';
import { getArmySupply } from './supplyEngine';
import { getRegimentMaximum, getRegimentOrganization } from './armyStats';
import type { LogisticsSnapshot } from '../logistics';

/** Daily recovery consumes the canonical national manpower and local market. */
export function recoverArmy(army: Army, country: Country, province: Province, colocatedArmies: Army[] = [army], logistics?: LogisticsSnapshot): { army: Army; country: Country; province: Province; reinforced: number } {
  if (army.inCombat || army.destination) return { army, country, province, reinforced: 0 };
  const supply = getArmySupply(army, province, colocatedArmies, logistics);
  const market = normalizeMarket(province.market);
  let manpower = country.resources.manpower;
  let gold = country.resources.gold;
  let reinforced = 0;
  const regiments = army.regiments.map(regiment => {
    const definition = UNIT_DEFINITIONS[regiment.type];
    const missing = Math.max(0, getRegimentMaximum(regiment) - regiment.strength);
    const desired = Math.min(missing, MILITARY_BALANCE.dailyReinforcementRate * supply.ratio);
    const affordable = Math.min(desired, manpower, gold / MILITARY_BALANCE.reinforcementGoldPerMan, market.goods.iron.stock / MILITARY_BALANCE.reinforcementIronPerMan, market.goods.tools.stock / MILITARY_BALANCE.reinforcementToolsPerMan);
    const amount = Math.max(0, Math.floor(affordable));
    manpower -= amount; gold -= amount * MILITARY_BALANCE.reinforcementGoldPerMan;
    market.goods.iron.stock -= amount * MILITARY_BALANCE.reinforcementIronPerMan;
    market.goods.tools.stock -= amount * MILITARY_BALANCE.reinforcementToolsPerMan;
    reinforced += amount;
    const organizationDelta =
      MILITARY_BALANCE.dailyOrganizationRecovery *
      supply.ratio;

    const moraleDelta =
      MILITARY_BALANCE.dailyMoraleRecovery *
      supply.ratio;

    return {
      ...regiment,

      strength:
        regiment.strength + amount,

      maxStrength:
        getRegimentMaximum(regiment),

      organization: Math.max(
        0,
        Math.min(
          definition.maxOrganization,
          getRegimentOrganization(regiment) +
          organizationDelta
        )
      ),

      morale: Math.max(
        0,
        Math.min(
          definition.maxMorale,
          regiment.morale +
          moraleDelta
        )
      ),

      experience:
        regiment.experience ?? 0,
    };
  });
  return { army: { ...army, regiments }, country: { ...country, resources: { ...country.resources, manpower, gold } }, province: { ...province, market }, reinforced };
}
