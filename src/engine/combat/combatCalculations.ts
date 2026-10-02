import { Army } from '../../types/army';
import { Province } from '../../types/province';


/**
 * Multiplicadores de poder por tipo de unidade
 */
export const UNIT_POWER_MULTIPLIERS: Record<string, number> = {
  infantry: 1.0,
  cavalry: 1.5,
  artillery: 2.0,
  archers: 1.2,
  heavy_cavalry: 2.2,
  elite_guard: 3.0,
  siege_engine: 2.5,
};



export const COMBAT_BALANCE = {
  /** Bônus de defesa em território próprio (+25%) */
  TERRITORIAL_DEFENSE_BONUS: 1.25,
  /** Bônus por nível de fortificação (+10% por nível) */
  FORTIFICATION_BONUS_PER_LEVEL: 0.10,
  /** Tropas por dia de batalha (1000 tropas = 1 dia) */
  TROOPS_PER_BATTLE_DAY: 1000,
  /** Perda do vencedor - mínimo (10%) */
  WINNER_LOSS_MIN: 0.10,
  /** Perda do vencedor - máximo (30%) */
  WINNER_LOSS_MAX: 0.30,
  /** Perda do perdedor - mínimo (30%) */
  LOSER_LOSS_MIN: 0.60,
  /** Perda do perdedor - máximo (60%) */
  LOSER_LOSS_MAX: 0.80,
  /** Perda total em caso de cerco (100%) */
  SIEGE_LOSS_PERCENT: 1.0,
};

/**
 * Calcula o tamanho total de um exército (número de homens)
 */
export function calculateArmySize(army: Army) {
  if (!army.regiments || army.regiments.length === 0) return 0;
  return army.regiments.reduce((s,r) => s + (r.strength || 0), 0);
}


/**
 * Calcula a moral média de um exército
 */

/**
 * Calcula o poder base de um exército
 * Fórmula baseada nos multiplicadores de cada tipo de unidade
 * Aplica bônus de tecnologia se fornecidos
 */
export function calculateArmyBasePower(
  army: Army,
  techBonuses?: {
    infantry: number;
    cavalry: number;
    artillery: number;
  }
): number {
  let totalPower = 0;

  for (const regiment of army.regiments) {
    let multiplier = UNIT_POWER_MULTIPLIERS[regiment.type] || 1.0;
    
    // Aplica bônus de tecnologia se disponível (apenas para unidades originais)
    if (techBonuses) {
      if (regiment.type === 'infantry') {
        multiplier *= (1 + techBonuses.infantry);
      } else if (regiment.type === 'cavalry') {
        multiplier *= (1 + techBonuses.cavalry);
      } else if (regiment.type === 'artillery') {
        multiplier *= (1 + techBonuses.artillery);
      }
    }
    
    const regimentPower = regiment.strength * multiplier;
    
    // Bônus de moral (50-100 = bônus, 0-50 = penalidade)
    const moraleBonus = 0.5 + (regiment.morale / 100);
    totalPower += regimentPower * moraleBonus;
  }

  return totalPower;
}

/**
 * Calcula o poder total do defensor com bônus territoriais
 */
export function calculateDefenderTotalPower(
  army: Army,
  province: Province,
  techBonuses?: { infantry: number; cavalry: number; artillery: number }
): { totalPower: number; hasTerritorialBonus: boolean; bonusMultiplier: number } {
  const basePower = calculateArmyBasePower(army, techBonuses);
  
  let bonusMultiplier = 1.0;
  let hasTerritorialBonus = false;

  // Bônus de defesa em território próprio
  if (province.owner === army.owner) {
    bonusMultiplier *= COMBAT_BALANCE.TERRITORIAL_DEFENSE_BONUS;
    hasTerritorialBonus = true;
  }

  // Bônus por fortificação
  if (province.defense > 0) {
    const fortificationBonus = 1 + (province.defense * COMBAT_BALANCE.FORTIFICATION_BONUS_PER_LEVEL);
    bonusMultiplier *= fortificationBonus;
    hasTerritorialBonus = true;
  }

  const totalPower = basePower * bonusMultiplier;

  return { totalPower, hasTerritorialBonus, bonusMultiplier };
}

/**
 * Calcula a duração da batalha em dias baseado no total de tropas
 * Fórmula: (Tropas do Atacante + Tropas do Defensor) / 2000
 * Mínimo: 1 dia
 */
export function calculateBattleDuration(attackerSize: number, defenderSize: number): number {
  const smaller = Math.min(attackerSize, defenderSize);
  return Math.max(1, Math.min(20, Math.floor(smaller / COMBAT_BALANCE.TROOPS_PER_BATTLE_DAY)));
}


/**
 * Calcula as perdas do vencedor com base no tamanho do INIMIGO e na escala de poder.
 * Impede que exércitos gigantes percam milhares de homens contra tropas minúsculas.
 */
export function calculateWinnerLosses(winnerSize: number, loserSize: number, powerRatio: number): number {
  if (winnerSize <= 0 || loserSize <= 0) return 0;

  // Quanto maior a superioridade numérica/poder (powerRatio), menor a fração cobrada do inimigo
  let enemyLossMultiplier: number;

  if (powerRatio >= 5.0) {
    enemyLossMultiplier = 0.10; // atropelo completo: perde no máx 10% do tamanho do exército inimigo
  } else if (powerRatio >= 3.0) {
    enemyLossMultiplier = 0.20; // superioridade esmagadora: perde no máx 20% do tamanho do inimigo
  } else if (powerRatio >= 2.0) {
    enemyLossMultiplier = 0.35; // vantagem clara
  } else if (powerRatio >= 1.5) {
    enemyLossMultiplier = 0.50; // vitória moderada
  } else {
    enemyLossMultiplier = 0.70; // vitória apertada
  }

  // O vencedor perde uma fração proporcional às tropas do PERDEDOR (nunca do próprio tamanho total)
  const baseLosses = loserSize * enemyLossMultiplier;

  // Trava de segurança: o vencedor nunca pode perder mais do que 30% do seu próprio exército em combates normais
  const maxSelfCap = winnerSize * 0.30;

  return Math.floor(Math.min(baseLosses, maxSelfCap));
}



/**
 * Calcula as perdas do perdedor baseado na esmagadora diferença de poder
 */
export function calculateLoserLosses(loserSize: number, powerRatio: number): number {
  let lossPercent: number;
  
  if (powerRatio >= 5.0) lossPercent = 0.90;      // massacre
  else if (powerRatio >= 3.0) lossPercent = 0.80;
  else if (powerRatio >= 2.0) lossPercent = 0.70;
  else if (powerRatio >= 1.5) lossPercent = 0.60;
  else lossPercent = 0.50;

  return Math.floor(loserSize * lossPercent);
}



/**
 * Distribui perdas proporcionalmente entre os regimentos
 */
export function distributeLosses(army: Army, totalLoss: number): Army {
  const armySize = calculateArmySize(army);
  if (armySize === 0 || totalLoss <= 0) return army;
  const losses: number[] = army.regiments.map(reg => {
    const proportion = reg.strength / armySize;
    return Math.floor(totalLoss * proportion);
  });
  const sumLosses = losses.reduce((a, b) => a + b, 0);
  if (sumLosses < totalLoss && losses.length > 0) losses[0] += totalLoss - sumLosses;
  const updatedRegiments = army.regiments.map((reg, i) => {
    const loss = Math.min(Math.floor(reg.strength), losses[i]);
    return {
      ...reg,
      strength: Math.max(0, Math.floor(reg.strength - loss)),
      morale: Math.max(0, reg.morale - (loss / Math.max(reg.strength, 1)) * 20),
    };
  }).filter(reg => Math.floor(reg.strength) > 0);
  return { ...army, regiments: updatedRegiments };
}


/**
 * Aplica perda de tropas a um exército
 */
export function applyTroopLoss(army: Army, loss: number): Army {
  if (loss <= 0 || army.regiments.length === 0) return army;
  const armySize = calculateArmySize(army);
  if (armySize === 0) return army;
  const losses: number[] = army.regiments.map(reg => {
    const proportion = reg.strength / armySize;
    return Math.floor(loss * proportion);
  });
  const sumLosses = losses.reduce((a, b) => a + b, 0);
  if (sumLosses < loss && losses.length > 0) losses[0] += loss - sumLosses;
  const updatedRegiments = army.regiments.map((reg, i) => {
    const regLoss = Math.min(reg.strength, losses[i]);
    return {
      ...reg,
      strength: Math.max(0, reg.strength - regLoss),
    };
  }).filter(reg => reg.strength > 0);
  return { ...army, regiments: updatedRegiments };
}
