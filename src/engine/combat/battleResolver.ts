import { Army, Province, GameDate, CombatResult } from '../../types';
import {
  calculateArmyBasePower,
  calculateArmySize,
  calculateBattleDuration,
  calculateDefenderTotalPower,
  calculateLoserLosses,
  calculateWinnerLosses,
  distributeLosses,
} from './combatCalculations';


/**
 * Resolve uma batalha completa usando o Sistema de Combate Prolongado
 * Duração baseada no total de tropas, com recuo tático e regra de cerco
 */
export function resolveBattle(
  attacker: Army,
  defender: Army,
  province: Province,
  currentDate: GameDate,
  attackerTechBonuses?: { infantry: number; cavalry: number; artillery: number },
  defenderTechBonuses?: { infantry: number; cavalry: number; artillery: number }
): CombatResult {
  // Salva estado original dos exércitos
  const attackerOriginal = { ...attacker, regiments: attacker.regiments.map(r => ({ ...r })) };
  const defenderOriginal = { ...defender, regiments: defender.regiments.map(r => ({ ...r })) };

  // Tamanhos originais
  const attackerOriginalSize = calculateArmySize(attackerOriginal);
  const defenderOriginalSize = calculateArmySize(defenderOriginal);

  // Calcula duração da batalha baseada no total de tropas
  const battleDays = calculateBattleDuration(attackerOriginalSize, defenderOriginalSize);

  // Calcula poderes (com bônus de tecnologia se fornecidos)
  const attackerPower = calculateArmyBasePower(attacker, attackerTechBonuses);
  const { totalPower: defenderPower, hasTerritorialBonus } = calculateDefenderTotalPower(defender, province, defenderTechBonuses);

  // Determina vencedor e ratio
  const winner: 'attacker' | 'defender' = attackerPower > defenderPower ? 'attacker' : 'defender';
  const winnerPower = Math.max(attackerPower, defenderPower);
  const loserPower = Math.min(attackerPower, defenderPower);
  const powerRatio = loserPower > 0 ? winnerPower / loserPower : 999;

  // Calcula perdas baseadas na duração da batalha
  let finalAttacker: Army;
  let finalDefender: Army;
  let attackerLoss: number;
  let defenderLoss: number;

  if (winner === 'attacker') {
    // Atacante venceu
     attackerLoss = calculateWinnerLosses(attackerOriginalSize, defenderOriginalSize, powerRatio);
    defenderLoss = calculateLoserLosses(defenderOriginalSize, powerRatio);

    finalAttacker = distributeLosses(attacker, attackerLoss);
    finalDefender = distributeLosses(defender, defenderLoss);
  } else {
    // Defensor venceu
    defenderLoss = calculateWinnerLosses(defenderOriginalSize, attackerOriginalSize, powerRatio);
    attackerLoss = calculateLoserLosses(attackerOriginalSize, powerRatio);

    finalAttacker = distributeLosses(attacker, attackerLoss);
    finalDefender = distributeLosses(defender, defenderLoss);
  }

  // Garante valores inteiros finais
  finalAttacker = {
    ...finalAttacker,
    regiments: finalAttacker.regiments.map(r => ({
      ...r,
      strength: Math.floor(r.strength),
      morale: Math.floor(r.morale),
    })),
  };

  finalDefender = {
    ...finalDefender,
    regiments: finalDefender.regiments.map(r => ({
      ...r,
      strength: Math.floor(r.strength),
      morale: Math.floor(r.morale),
    })),
  };

  // Calcula baixas EXATAS: TropasIniciais - TropasFinais
  const finalAttackerSize = calculateArmySize(finalAttacker);
  const finalDefenderSize = calculateArmySize(finalDefender);
  
  const exactAttackerCasualties = Math.floor(attackerOriginalSize - finalAttackerSize);
  const exactDefenderCasualties = Math.floor(defenderOriginalSize - finalDefenderSize);

  console.log(`⚔️ Batalha em ${province.name}: ${battleDays} dias de combate`);
  console.log(`   Atacante: ${attackerOriginalSize} → ${finalAttackerSize} tropas (${exactAttackerCasualties} baixas)`);
  console.log(`   Defensor: ${defenderOriginalSize} → ${finalDefenderSize} tropas (${exactDefenderCasualties} baixas)`);
  console.log(`   Vencedor: ${winner === 'attacker' ? 'Atacante' : 'Defensor'} (ratio: ${powerRatio.toFixed(2)})`);

  // Aplica regra de cerco/aniquilação para o perdedor
  const loser = winner === 'attacker' ? finalDefender : finalAttacker;
  const loserOwner = winner === 'attacker' ? defender.owner : attacker.owner;
  
  // Verifica se o perdedor está cercado (sem províncias próprias vizinhas)
  const hasEscapeRoute = province.neighbors.some(neighborId => {
    const neighborProvince = province.neighbors.includes(neighborId);
    // Precisamos acessar o array de províncias, mas não temos aqui
    // Esta lógica será movida para uma função separada
    return false; // Placeholder - será implementado na função de recuo
  });

  // Se não houver rota de fuga, aplica aniquilação total (100% de baixas)
  // Esta lógica será aplicada no App.tsx onde temos acesso ao array de províncias

  return {
    attacker: finalAttacker,
    defender: finalDefender,
    attackerOriginal,
    defenderOriginal,
    attackerCasualties: exactAttackerCasualties,
    defenderCasualties: exactDefenderCasualties,
    winner,
    provinceId: province.id,
    provinceName: province.name,
    duration: battleDays, // Duração calculada baseada nas tropas
    territoryChanged: false, // Será atualizado pelo App.tsx
    territorialDefenseBonus: hasTerritorialBonus,
    powerRatio: Math.round(powerRatio * 100) / 100, // 2 casas decimais
    date: currentDate,
  };
}

/**
 * Resolve uma batalha em grupo: múltiplos defensores contra um atacante
 * Combina forças defensivas e distribui baixas proporcionalmente
 */
