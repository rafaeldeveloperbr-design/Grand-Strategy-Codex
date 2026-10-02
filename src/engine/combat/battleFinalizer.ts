import { Army, Province, ActiveBattle, GameDate, CombatResult, Country } from '../../types';
import { applyTroopLoss, calculateArmySize } from './combatCalculations';

// ============ EXTENSÕES QUE FALTAVAM NO TIPO ============
type CountryWithCapital = Country & {
  capital?: string;
  capitalId?: string;
};

type BattleWithExtensions = ActiveBattle & {
  attackerReinfInitial?: number;
  defenderReinfInitial?: number;
  attackerInitialSnapshot?: Army;
  defenderInitialSnapshot?: Army;
};

export function finalizeBattle(
  battle: BattleWithExtensions,
  attacker: Army,
  defender: Army,
  province: Province,
  currentDate: GameDate,
  allArmies: Army[],
  allProvinces: Province[] = [],
  allCountries: Country[] = []
): { result: CombatResult; updatedArmies: Army[] } {

  const defenderParticipants = allArmies.filter(a =>
    battle.participantArmyIds.includes(a.id) && a.owner === defender.owner
  );
  const attackerParts = allArmies.filter(a =>
    battle.participantArmyIds.includes(a.id) && a.owner!== defender.owner
  );

  const totalAttacker = attackerParts.reduce((s, a) => s + calculateArmySize(a), 0);
  const totalDefender = defenderParticipants.reduce((s, a) => s + calculateArmySize(a), 0);

  const winner: 'attacker' | 'defender' = totalAttacker > totalDefender? 'attacker' : 'defender';
  const loserOwner = winner === 'attacker'? defender.owner : attacker.owner;

  // STACKWIPE CHECK
  const powerRatio = totalAttacker / Math.max(1, totalDefender);
  const inverseRatio = totalDefender / Math.max(1, totalAttacker);
  const ratioForWipe = Math.max(powerRatio, inverseRatio);
  const totalLoserSize = winner === 'attacker'? totalDefender : totalAttacker;
  const isStackwipe = ratioForWipe >= 10 && totalLoserSize <= 2000;

  let finalAttacker = attacker;
  let finalDefender = defender;

  if (!battle.shouldRetreatAttacker &&!battle.shouldRetreatDefender &&!isStackwipe) {
    const extraWinner = Math.floor((winner === 'attacker'? battle.attackerCurrentTroops : battle.defenderCurrentTroops) * 0.05);
    const extraLoser = Math.floor((winner === 'attacker'? battle.defenderCurrentTroops : battle.attackerCurrentTroops) * 0.10);
    if (winner === 'attacker') {
      finalAttacker = applyTroopLoss(attacker, extraWinner);
      finalDefender = applyTroopLoss(defender, extraLoser);
    } else {
      finalDefender = applyTroopLoss(defender, extraWinner);
      finalAttacker = applyTroopLoss(attacker, extraLoser);
    }
  }

  const findCapitalId = (owner: string): string | null => {
    const country = allCountries.find(c => c.tag === owner) as CountryWithCapital | undefined;
    if (!country) return null;
    return country.capital?? country.capitalId?? country.provinces[0]?? null;
  };

  let remainingLoserTroopsToKeep = isStackwipe? 0 : 1000;

  const updatedAllArmies: Army[] = allArmies.map(army => {
    if (!battle.participantArmyIds.includes(army.id)) return army;

    let updatedArmy = army;
    if (army.id === attacker.id) updatedArmy = finalAttacker;
    else if (army.id === defender.id) updatedArmy = finalDefender;

    const isLoser = army.owner === loserOwner;
    if (!isLoser) {
      return {
       ...updatedArmy,
        inCombat: false,
        battleId: null,
        destination: null,
        targetDestination: null,
        path: [],
        location: province.id
      };
    }

    // PERDEDOR ANIQUILADO
    if (remainingLoserTroopsToKeep <= 0) {
      return {
       ...updatedArmy,
        regiments: [],
        inCombat: false,
        battleId: null,
        location: findCapitalId(army.owner) || province.id,
        destination: null,
        targetDestination: null,
        path: [],
        // essas props precisam existir no tipo Army - se não existir, remova
       ...( 'morale' in updatedArmy? { morale: 0 } : {} ),
       ...( 'lastRetreatDate' in updatedArmy? { lastRetreatDate: currentDate } : {} ),
      } as Army;
    }

    const currentSize = calculateArmySize(updatedArmy);
    const keep = Math.min(currentSize, remainingLoserTroopsToKeep);
    const lose = currentSize - keep;
    remainingLoserTroopsToKeep -= keep;
    const trimmed = lose > 0? applyTroopLoss(updatedArmy, lose) : updatedArmy;

    return {
     ...trimmed,
      inCombat: false,
      battleId: null,
      location: findCapitalId(army.owner) || province.id,
      destination: null,
      targetDestination: null,
      path: [],
     ...( 'morale' in trimmed? { morale: 0.1 } : {} ),
     ...( 'lastRetreatDate' in trimmed? { lastRetreatDate: currentDate } : {} ),
    } as Army;
  });

  const cloneRegiments = (a: Army): Army => ({
   ...a,
    regiments: a.regiments.map(r => ({...r }))
  });

  const attackerOriginal = battle.attackerInitialSnapshot? cloneRegiments(battle.attackerInitialSnapshot) : cloneRegiments(attacker);
  const defenderOriginal = battle.defenderInitialSnapshot? cloneRegiments(battle.defenderInitialSnapshot) : cloneRegiments(defender);

  const finalAttackerSize = updatedAllArmies
   .filter(a => battle.participantArmyIds.includes(a.id) && a.owner === attacker.owner)
   .reduce((s, a) => s + calculateArmySize(a), 0);

  const finalDefenderSize = updatedAllArmies
   .filter(a => battle.participantArmyIds.includes(a.id) && a.owner === defender.owner)
   .reduce((s, a) => s + calculateArmySize(a), 0);

  const result: CombatResult = {
    attacker: finalAttacker,
    defender: finalDefender,
    attackerOriginal,
    defenderOriginal,
    attackerCasualties: (battle.attackerInitialTroops + (battle.attackerReinfInitial?? 0)) - finalAttackerSize,
    defenderCasualties: (battle.defenderInitialTroops + (battle.defenderReinfInitial?? 0)) - finalDefenderSize,
    winner,
    provinceId: province.id,
    provinceName: province.name,
    duration: battle.daysTotal,
    territoryChanged: false,
    territorialDefenseBonus: province.owner === defender.owner,
    powerRatio: Math.round(ratioForWipe * 100) / 100,
    date: currentDate,
    isStackwipe,
  };

  return { result, updatedArmies: updatedAllArmies };
}
