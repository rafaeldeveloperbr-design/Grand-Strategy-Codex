import { countries, provincesData } from '../../../data/map';
import type { Army, BattleExtended, CombatResult, Country, DiplomaticRelation, Province, War } from '../../../types';
import { createArmy, createRegiment } from '../../military';
import { processMovementTick } from '../../../hooks/gameLoop/movementTick';
import { processBattleArrival } from '../../../hooks/gameLoop/battleArrivalTick';
import { processBattleContinuous } from '../../../hooks/gameLoop/battleContinuousTick';
import { createInitialTechState } from '../../technology';

export const date = { year: 1444, month: 11, day: 11 };
export const noop = () => {};
export const world = () => ({ provinces: structuredClone(provincesData), countries: structuredClone(countries) });
export const province = (id: string) => structuredClone(provincesData.find(p => p.id === id)!);
export function army(owner: string, location: string, count = 3, id = `${owner}-${location}`): Army {
  return { ...createArmy(owner, id, location), id, regiments: Array.from({ length: count }, () => ({
    ...createRegiment('infantry'), morale: 100, organization: 100, originProvinceId: location,
  })) };
}
export function relation(a: string, b: string, status: DiplomaticRelation['status'] | 'alliance' | 'access' = 'war', opinion = -100): DiplomaticRelation {
  return { countryA: a, countryB: b, status: status === 'war' ? 'war' : 'peace', opinion, trust: 50,
    ...(status === 'alliance' ? {alliance: {since: 0}} : status === 'access' ? {militaryAccess: [b]} : {}) };
}
export const access = (owner: string) => countries.filter(c => c.tag !== owner).map(c => relation(owner, c.tag));
export function war(attacker: string, defender: string): War {
  return { id: `${attacker}-${defender}`, attacker, defender, startDate: date, warScore: 0,
    attackerCasualties: 0, defenderCasualties: 0, occupiedByAttacker: [], occupiedByDefender: [] };
}
export interface Campaign {
  provinces: Province[]; countries: Country[]; armies: Army[]; relations: DiplomaticRelation[];
  wars: War[]; currentActiveBattles: BattleExtended[];
  battlesStarted: number; battleHistory: CombatResult[];
}
export function campaign(armies: Army[], relations: DiplomaticRelation[], wars: War[]): Campaign {
  return { ...world(), armies, relations, wars, currentActiveBattles: [], battlesStarted: 0, battleHistory: [] };
}
export function day(state: Campaign): Campaign {
  const moved = processMovementTick({ ...state, addLog: noop });
  const activeBattlesRef = { current: state.currentActiveBattles };
  const common = { snapshot: { date }, playerCountryTag: 'OBSERVER', allCountries: moved.countries,
    recruitments: [], buildingConstructions: [], activeBattlesRef, addLog: noop, addToast: noop,
    setActiveBattles: noop, cancelProvinceActivities: () => { throw new Error('Legacy transfer must not run'); } };
  const arrival = processBattleArrival({ ...state, ...moved, ...common });
  const battlesStarted = state.battlesStarted + arrival.currentActiveBattles.filter(battle =>
    !state.currentActiveBattles.some(previous => previous.id === battle.id)).length;
  let battleHistory = [...state.battleHistory];
  const battle = processBattleContinuous({ ...arrival, ...common, wars: state.wars,
    playerTechState: createInitialTechState('OBSERVER'), botTechStates: new Map(),
    setArmies: noop, setBattleHistory: update => { battleHistory = typeof update === 'function' ? update(battleHistory) : update; },
    setBattleReport: noop, setIsPaused: noop });
  return { ...state, ...battle, battlesStarted, battleHistory };
}
