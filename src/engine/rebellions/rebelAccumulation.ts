import { Army, Province } from '../../types';
import { createRegiment } from '../military';
import { getCountryByTag } from '../../data/countries';
import {
  REBEL_ACCUMULATION_RATE,
  SEPARATIST_THRESHOLD,
  RebelProcessingResult,
  isRebelArmy,
  getArmyTotalTroops,
  generateRebelArmyId
} from './rebelHelpers';

/**
 * ACÚMULO DE TROPAS REBELDES (+1.000 por ciclo)
 */
export function processRebelAccumulation(
  provinces: Province[],
  armies: Army[],
  revoltedProvinceIds: string[]
): RebelProcessingResult {
  let updatedArmies = [...armies];
  const updatedProvinces = [...provinces];
  const notifications: string[] = [];
  const logs: string[] = [];

  for (const provId of revoltedProvinceIds) {
    const province = updatedProvinces.find(p => p.id === provId);
    if (!province) continue;

    const rebelArmyIndex = updatedArmies.findIndex(
      a => a.location === provId && isRebelArmy(a) && !a.destination
    );

    if (rebelArmyIndex !== -1) {
      const rebelArmy = { ...updatedArmies[rebelArmyIndex] };
      const infantryIndex = rebelArmy.regiments.findIndex(r => r.type === 'infantry');

      if (infantryIndex !== -1) {
        const updatedRegiments = rebelArmy.regiments.map(r => ({ ...r }));
        updatedRegiments[infantryIndex].strength += REBEL_ACCUMULATION_RATE;
        rebelArmy.regiments = updatedRegiments;
      } else {
        const newReg = createRegiment('infantry');
        newReg.strength = REBEL_ACCUMULATION_RATE;
        rebelArmy.regiments = [...rebelArmy.regiments, newReg];
      }

      const totalTroops = getArmyTotalTroops(rebelArmy);
      console.log(`🔥 Rebeldes em ${province.name} acumularam +${REBEL_ACCUMULATION_RATE} (total: ${totalTroops})`);

      if (totalTroops >= SEPARATIST_THRESHOLD && !rebelArmy.separatistMode) {
        rebelArmy.separatistMode = true;
        const countryName = getCountryByTag(rebelArmy.originalOwner || '')?.name || 'país desconhecido';
        notifications.push(`⚠️ Exército Separatista atingiu 5.000 tropas e iniciou a marcha de reconquista!`);
        logs.push(`⚔️ Rebeldes de ${countryName} atingiram 5k e estão atacando para reconquistar seus territórios originais!`);
        console.log(`⚔️ Rebeldes de ${countryName} atingiram 5k e estão atacando para reconquistar seus territórios originais!`);
      }

      updatedArmies[rebelArmyIndex] = rebelArmy;
    } else {
      const originalOwner = province.originalOwner || province.owner;
      const countryName = getCountryByTag(originalOwner)?.name || province.name;

      const newRebelArmy: Army = {
        id: generateRebelArmyId(),
        owner: `rebel_${provId}`,
        name: `Rebeldes de ${countryName}`,
        regiments: [],
        location: provId,
        destination: null,
        targetDestination: null,
        movementProgress: 0,
        movementSpeed: 0.75,
        position: null,
        path: [],
        targetArmyId: null,
        targetProvinceId: null,
        originalOwner,
        separatistMode: false,
      };

      const reg = createRegiment('infantry');
      reg.strength = REBEL_ACCUMULATION_RATE;
      newRebelArmy.regiments = [reg];

      updatedArmies = [...updatedArmies, newRebelArmy];
      console.log(`🔥 Novo exército rebelde criado em ${province.name} (${REBEL_ACCUMULATION_RATE} tropas)`);
    }
  }

  return { updatedArmies, updatedProvinces, notifications, logs };
}

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
      const regiments = target.regiments.map(r => ({ ...r }));
      for (const reg of army.regiments) {
        const existing = regiments.find(r => r.type === reg.type);
        if (existing) {
          existing.strength += reg.strength;
        } else {
          regiments.push({ ...reg });
        }
      }
      target.regiments = regiments;
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