import { countries, provincesData } from '../../data/map';
import { createArmy } from '../military';
import { createInitialNavies, portByProvince } from '../naval';
import type { DiplomaticRelation, War } from '../../types';
import type { NavalState } from '../../types/naval';
const date = { year: 1444, month: 11, day: 1 };
const war: War = { id: 'w', attacker: 'BRA', defender: 'ARG', startDate: date, warScore: 0, attackerCasualties: 0, defenderCasualties: 0, occupiedByAttacker: [], occupiedByDefender: [] };
export function transportFixture(troops = 3600) {
  const fleet = createInitialNavies(countries, provincesData).find(f => f.countryTag === 'BRA')!;
  const target = provincesData.find(p => p.owner === 'ARG' && portByProvince.has(p.id))!;
  const army = createArmy('BRA', '1º Exército', fleet.portProvinceId!);
  army.id = 'army-transport';
  army.regiments = Array.from({ length: Math.ceil(troops / 1000) }, (_, i) => ({ type: 'infantry', strength: Math.min(1000, troops - i * 1000), morale: 100, organization: 100, originProvinceId: fleet.portProvinceId }));
  return { army, fleet, target, ctx: { armies: [army], naval: { fleets: [fleet], battles: [] } as NavalState, provinces: structuredClone(provincesData), wars: [structuredClone(war)], relations: [] as DiplomaticRelation[], actor: 'BRA' } };
}
