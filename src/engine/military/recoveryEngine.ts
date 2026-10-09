import { getMilitaryEquipmentCostMultiplier } from '../../data/buildings';
import { UNIT_DEFINITIONS } from '../../data/units';
import type { Army, Country, Province } from '../../types';
import { normalizeMarket } from '../market';
import { MILITARY_BALANCE } from './balance';
import { getArmySupply } from './supplyEngine';
import { politicsModifiers } from '../politics';
import { getRegimentMaximum, getRegimentOrganization } from './armyStats';
import type { LogisticsSnapshot } from '../logistics';

/** Daily recovery consumes the canonical national manpower and local market. */
export function recoverArmy(army: Army, country: Country, province: Province, colocatedArmies: Army[] = [army], logistics?: LogisticsSnapshot): { army: Army; country: Country; province: Province; reinforced: number } {
  if (army.embarkedFleetId || army.inCombat || army.destination) return { army, country, province, reinforced: 0 };
  const supply = getArmySupply(army, province, colocatedArmies, logistics);
  const recoveryModifier = politicsModifiers(country).recovery;
  const market = normalizeMarket(province.market);
  const equipmentMultiplier = province.owner === army.owner ? getMilitaryEquipmentCostMultiplier(province) : 1;
  const ironPerMan = MILITARY_BALANCE.reinforcementIronPerMan * equipmentMultiplier;
  const toolsPerMan = MILITARY_BALANCE.reinforcementToolsPerMan * equipmentMultiplier;
  let manpower = country.resources.manpower;
  let gold = country.resources.gold;
  let reinforced = 0;
  const regiments = army.regiments.map(regiment => {
    const definition = UNIT_DEFINITIONS[regiment.type];
    const missing = Math.max(0, getRegimentMaximum(regiment) - regiment.strength);
    const desired = Math.min(missing, MILITARY_BALANCE.dailyReinforcementRate * supply.ratio * recoveryModifier);
    const affordable = Math.min(desired, manpower, gold / MILITARY_BALANCE.reinforcementGoldPerMan, market.goods.iron.stock / ironPerMan, market.goods.tools.stock / toolsPerMan);
    const amount = Math.max(0, Math.floor(affordable));
    manpower -= amount; gold -= amount * MILITARY_BALANCE.reinforcementGoldPerMan;
    market.goods.iron.stock -= amount * ironPerMan;
    market.goods.tools.stock -= amount * toolsPerMan;
    reinforced += amount;
    const organizationDelta =
      MILITARY_BALANCE.dailyOrganizationRecovery *
      supply.ratio * recoveryModifier;

    const moraleDelta =
      MILITARY_BALANCE.dailyMoraleRecovery *
      supply.ratio * recoveryModifier;

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
