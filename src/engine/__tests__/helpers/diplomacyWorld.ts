import { countries, provincesData } from '../../../data/map';
import { createInitialArmies } from '../../../data/map/initialState';
import { createInitialDiplomacy } from '../../diplomacy/diplomacyInitialization';
import { diplomacyDay } from '../../diplomacy/diplomacyRelations';
import { DIPLOMACY_BALANCE as B } from '../../diplomacy/diplomacyBalance';
import type { DiplomacyContext } from '../../diplomacy/diplomacyTypes';

export function diplomacyWorld(scenario: 'normal' | 'maintenance' | 'proposalCycle' = 'proposalCycle'): DiplomacyContext {
  const world = structuredClone(countries), provinces = structuredClone(provincesData);
  const day = diplomacyDay({ year: 1444, month: 11, day: 11 });
  const cycle = day + (B.aiInterval - day % B.aiInterval) % B.aiInterval;
  const d = new Date((cycle + (scenario === 'normal' ? 1 : scenario === 'maintenance' ? B.aiMaintenanceInterval : 0)) * 86400000);
  return { countries: world, provinces, armies: createInitialArmies(world), wars: [], relations: createInitialDiplomacy(world, provinces),
    date: { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() } };
}
