/**
 * ============================================================
 * SISTEMA DE AGITAÇÃO PROVINCIAL E REVOLTAS
 * ============================================================
 * Gerencia instabilidade local, decaimento diário e spawn de rebeldes
 */

import { Province, Army } from '../types';
import { GameDate } from '../types';

/**
 * Constantes de balanceamento do sistema de agitação
 */
export const UNREST_BALANCE = {
  /** Unrest inicial ao conquistar província (0-100) */
  INITIAL_UNREST_ON_CONQUEST: 50,
  
  /** Crescimento diário natural de unrest (aumenta por dia) */
  DAILY_GROWTH_RATE: 0.3,
  
  /** Bônus de pacificação por Templo (reduz unrest por dia) */
  TEMPLE_PACIFICATION_BONUS: 0.5,
  
  /** Bônus de pacificação por guarnição/exército estacionado (reduz unrest por dia) */
  GARRISON_PACIFICATION_BONUS: 0.3,
  
  /** Threshold para revolta (unrest >= 100) */
  REVOLT_THRESHOLD: 100,
  
  /** Unrest após revolta (reset para evitar spawn infinito) */
  UNREST_AFTER_REVOLT: 30,
  
  /** Tamanho mínimo do exército rebelde */
  MIN_REBEL_SIZE: 1000,
  
  /** Tamanho máximo do exército rebelde */
  MAX_REBEL_SIZE: 3000,
  
  /** Fator de escala baseado na população da província */
  POPULATION_SCALE_FACTOR: 0.1,
};

/**
 * Calcula o tamanho do exército rebelde baseado na população da província
 */
export function calculateRebelArmySize(province: Province): number {
  const baseSize = Math.floor(province.population * UNREST_BALANCE.POPULATION_SCALE_FACTOR);
  const size = Math.max(
    UNREST_BALANCE.MIN_REBEL_SIZE,
    Math.min(UNREST_BALANCE.MAX_REBEL_SIZE, baseSize)
  );
  
  console.log(`🔥 Calculando tamanho do exército rebelde em ${province.name}: ${size} tropas (pop: ${province.population})`);
  return size;
}

/**
 * Cria um exército rebelde na província
 */

/**
 * Processa crescimento diário de unrest em todas as províncias
 * Unrest AUMENTA naturalmente, só DIMINUI com moderadores (Templo, Guarnição)
 */
export function processDailyUnrestDecay(
  provinces: Province[],
  currentDate: GameDate,
  armies: Army[]
): {
  updatedProvinces: Province[];
  revoltedProvinces: Province[];
} {
  const updatedProvinces: Province[] = [];
  const revoltedProvinces: Province[] = [];
  
  for (const province of provinces) {
    let unrest = province.unrest ?? 0;
    
    // Se não tem unrest, não faz nada
    if (unrest <= 0) {
      updatedProvinces.push(province);
      continue;
    }
    
    // Unrest AUMENTA naturalmente por dia
    let change = UNREST_BALANCE.DAILY_GROWTH_RATE;
    
    // Calcula bônus de pacificação baseado em edifícios
    // Templo reduz unrest
    const temple = province.buildings.find(b => b.type === 'temple');
    if (temple) {
      change -= UNREST_BALANCE.TEMPLE_PACIFICATION_BONUS * temple.level;
    }
    
    // Verifica se há guarnição/exército estacionado na província
    const hasGarrison = armies.some(army => 
      army.location === province.id && 
      army.owner === province.owner &&
      !army.inCombat // Exército não está em combate
    );
    
    if (hasGarrison) {
      change -= UNREST_BALANCE.GARRISON_PACIFICATION_BONUS;
    }
    
    // Aplica mudança de unrest (pode ser positivo ou negativo)
    unrest = Math.min(100, Math.max(0, unrest + change));
    
    // Verifica se houve revolta
    if (unrest >= UNREST_BALANCE.REVOLT_THRESHOLD) {
      console.log(`🔥 Revolta estourou em ${province.name}! Unrest: ${unrest.toFixed(1)}%`);
      
      // Reset unrest para evitar spawn infinito
      unrest = UNREST_BALANCE.UNREST_AFTER_REVOLT;
      
      revoltedProvinces.push({
        ...province,
        unrest,
      });
    }
    
    updatedProvinces.push({
      ...province,
      unrest,
    });
  }
  
  return { updatedProvinces, revoltedProvinces };
}

/**
 * Aplica unrest inicial quando uma província é conquistada
 */
export function applyConquestUnrest(
  province: Province,
  currentDate: GameDate
): Province {
  const newUnrest = UNREST_BALANCE.INITIAL_UNREST_ON_CONQUEST;
  
  console.log(`📍 Província ${province.name} conquistada! Unrest inicial: ${newUnrest}%`);
  
  return {
    ...province,
    unrest: newUnrest,
    lastConquestDate: currentDate.year * 360 + currentDate.month * 30 + currentDate.day,
  };
}

/**
 * Verifica se uma província está totalmente pacificada (unrest = 0)
 */
export function isProvincePacified(province: Province): boolean {
  return (province.unrest ?? 0) === 0;
}

/**
 * Obtém descrição textual do nível de unrest
 */
export function getUnrestDescription(unrest: number): string {
  if (unrest >= 80) return 'Crítico';
  if (unrest >= 60) return 'Alto';
  if (unrest >= 40) return 'Moderado';
  if (unrest >= 20) return 'Baixo';
  return 'Pacífico';
}

/**
 * Obtém cor baseada no nível de unrest
 */
export function getUnrestColor(unrest: number): string {
  if (unrest >= 80) return '#e74c3c'; // Vermelho
  if (unrest >= 60) return '#e67e22'; // Laranja
  if (unrest >= 40) return '#f39c12'; // Amarelo
  if (unrest >= 20) return '#95a5a6'; // Cinza
  return '#2ecc71'; // Verde
}

/**
 * Calcula o impacto do unrest na economia da província
 */
export function calculateUnrestEconomicImpact(unrest: number): {
  goldMultiplier: number;
  manpowerMultiplier: number;
  growthMultiplier: number;
} {
  // Unrest alto reduz economia
  const penalty = unrest / 100; // 0 a 1
  
  return {
    goldMultiplier: 1 - (penalty * 0.5), // Até -50% de ouro
    manpowerMultiplier: 1 - (penalty * 0.3), // Até -30% de manpower
    growthMultiplier: 1 - (penalty * 0.4), // Até -40% de crescimento
  };
}
