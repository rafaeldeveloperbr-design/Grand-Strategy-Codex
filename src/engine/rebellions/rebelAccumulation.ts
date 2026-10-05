import { Army, Province } from '../../types';
import {
  isRebelArmy,
  getArmyTotalTroops
} from './rebelHelpers';

/**
 * Funde exércitos rebeldes do MESMO país original na MESMA província
 */
export function mergeRebelArmies(armies: Army[]): Army[] {
  const result: Army[] = [];

  for (const army of armies) {
    if (!isRebelArmy(army) || !army.location) {
      result.push(army);
      continue;
    }

    const idx = result.findIndex(
      a => isRebelArmy(a) &&
           a.location === army.location &&
           a.originalOwner === army.originalOwner
    );

    if (idx !== -1) {
      const target = { ...result[idx] };
      target.regiments = [...target.regiments, ...army.regiments].map(regiment => ({ ...regiment }));
      target.separatistMode = target.separatistMode || army.separatistMode;
      result[idx] = target;
      console.log(`🔀 Rebeldes de ${army.originalOwner} fundidos em ${army.location} (${getArmyTotalTroops(target)} tropas)`);
    } else {
      result.push({ ...army });
    }
  }

  return result;
}

/**
 * Quando a reconquista termina, o rebelde vira exército nacional
 */
export function integrateLiberatedRebels(armies: Army[], provinces: Province[]): Army[] {
  return armies.map(army => {
    if (!isRebelArmy(army) || !army.separatistMode || !army.originalOwner) return army;

    const occupiedHome = provinces.some(
      p => p.originalOwner === army.originalOwner && p.owner !== army.originalOwner
    );

    if (!occupiedHome) {
      console.log(`🏳️ ${army.name}: reconquista completa! Integrado ao exército de ${army.originalOwner}`);
      return {
        ...army,
        owner: army.originalOwner,
        separatistMode: false,
        name: `Exército Libertador (${army.originalOwner})`,
      };
    }
    return army;
  });
}