/**
 * ============================================================
 * MÓDULO 6 - Motor de Tecnologias e Focos Nacionais
 * ============================================================
 */

import { Country, Province } from '../types';
import { NationalFocus, Technology, CountryTechState, RewardEffect } from '../types/technology';
import { AIDifficulty, DIFFICULTY_SPEED_MULTIPLIERS } from '../types/difficulty';
import { NATIONAL_FOCUSES, TECHNOLOGIES } from '../data/technology';

/**
 * Processa o progresso diário de focos e tecnologias de um país
 * IMPORTANTE: Usa progresso isolado por país (não modifica arrays globais)
 * 
 * @param techState - Estado de tecnologias do país
 * @param country - País
 * @param aiDifficulty - Nível de dificuldade da IA (opcional, padrão: 'medium')
 * @param isPlayer - Se é o jogador humano (ignora multiplicador de dificuldade)
 */
export function processDailyTechProgress(
  techState: CountryTechState,
  country: Country,
  aiDifficulty: AIDifficulty = 'medium',
  isPlayer: boolean = false
): {
  techState: CountryTechState;
  notifications: string[];
} {
  const notifications: string[] = [];
  
  // Validação de segurança
  if (!techState || !country) {
    console.warn('processDailyTechProgress: techState ou country inválido');
    return { techState: techState || createInitialTechState('UNKNOWN'), notifications };
  }
  
  // Calcula o multiplicador de velocidade baseado na dificuldade
  // Jogador sempre usa 1.0, IA usa o multiplicador da dificuldade
  const speedMultiplier = isPlayer ? 1.0 : DIFFICULTY_SPEED_MULTIPLIERS[aiDifficulty];
  
  // Cria uma cópia profunda do estado para evitar mutações
  const updatedTechState = {
    ...techState,
    completedFocuses: [...(techState.completedFocuses || [])],
    completedTechnologies: [...(techState.completedTechnologies || [])],
    focusProgressDays: techState.focusProgressDays || 0,
    researchProgressDays: techState.researchProgressDays || 0
  };

  // Processa progresso do foco ativo (USANDO PROGRESSO ISOLADO)
  if (updatedTechState.activeFocusId) {
    const focus = NATIONAL_FOCUSES?.find(f => f?.id === updatedTechState.activeFocusId);
    
    if (focus) {
      // Incrementa o progresso ISOLADO do país com multiplicador de dificuldade
      const progressIncrement = 1 * speedMultiplier;
      const newProgressDays = updatedTechState.focusProgressDays + progressIncrement;
      updatedTechState.focusProgressDays = newProgressDays;
      
      // Log de progresso diário silenciado para reduzir ruído no console
      // if (!isPlayer) {
      //   console.log(`📊 [${country.tag}] Foco "${focus.title}": ${newProgressDays.toFixed(2)}/${focus.durationDays} dias (velocidade: ${(speedMultiplier * 100).toFixed(0)}%)`);
      // }

      // Verifica se o foco foi concluído
      if (newProgressDays >= focus.durationDays) {
        // Atualiza o estado do país
        updatedTechState.completedFocuses = [...updatedTechState.completedFocuses, focus.id];
        updatedTechState.activeFocusId = null;
        updatedTechState.focusProgressDays = 0; // Reseta progresso
        
        notifications.push(`✅ Foco concluído: ${focus.title}`);
        console.log(`✅ [${country.tag}] Foco concluído: ${focus.title}`);
      }
    }
  }

  // Processa progresso da pesquisa ativa (USANDO PROGRESSO ISOLADO)
  if (updatedTechState.activeResearchId) {
    const tech = TECHNOLOGIES?.find(t => t?.id === updatedTechState.activeResearchId);
    
    if (tech) {
      // Verifica se tem ouro suficiente para continuar pesquisando
      const dailyCost = tech.costGold / tech.durationDays;
      
      if (country.resources?.gold >= dailyCost) {
        // Incrementa o progresso ISOLADO do país com multiplicador de dificuldade
        const progressIncrement = 1 * speedMultiplier;
        const newProgressDays = updatedTechState.researchProgressDays + progressIncrement;
        updatedTechState.researchProgressDays = newProgressDays;
        
        // Log de progresso diário silenciado para reduzir ruído no console
        // if (!isPlayer) {
        //   console.log(`📊 [${country.tag}] Pesquisa "${tech.title}": ${newProgressDays.toFixed(2)}/${tech.durationDays} dias (velocidade: ${(speedMultiplier * 100).toFixed(0)}%)`);
        // }

        // Verifica se a pesquisa foi concluída
        if (newProgressDays >= tech.durationDays) {
          // Atualiza o estado do país
          updatedTechState.completedTechnologies = [...updatedTechState.completedTechnologies, tech.id];
          updatedTechState.activeResearchId = null;
          updatedTechState.researchProgressDays = 0; // Reseta progresso
          
          notifications.push(`🔬 Pesquisa concluída: ${tech.title}`);
          console.log(`🔬 [${country.tag}] Pesquisa concluída: ${tech.title}`);
        }
      } else {
        console.warn(`⚠️ [${country.tag}] Ouro insuficiente para continuar pesquisa "${tech.title}" (necessário: ${dailyCost}/dia)`);
      }
    }
  }
  
  return { techState: updatedTechState, notifications };
}
/**
 * Inicia um foco nacional
 */
export function startNationalFocus(
  techState: CountryTechState,
  focusId: string
): CountryTechState | null {
  // Validação de segurança
  if (!techState || !focusId) {
    console.warn('startNationalFocus: techState ou focusId inválido');
    return null;
  }
  
  const focus = NATIONAL_FOCUSES?.find(f => f?.id === focusId);
  if (!focus) return null;

  // Verifica se já foi concluído por este país
  if (techState.completedFocuses?.includes(focusId)) return null;

  // Verifica pré-requisitos
  if (focus.prerequisites) {
    const hasPrereqs = focus.prerequisites.every(prereqId => 
      techState.completedFocuses?.includes(prereqId)
    );
    if (!hasPrereqs) return null;
  }

  return {
    ...techState,
    activeFocusId: focusId,
    focusProgressDays: 0 // Reseta progresso isolado
  };
}

/**
 * Inicia uma pesquisa tecnológica
 */
export function startTechnologyResearch(
  techState: CountryTechState,
  techId: string,
  country: Country
): { techState: CountryTechState | null; cost: number } {
  // Validação de segurança
  if (!techState || !techId || !country) {
    console.warn('startTechnologyResearch: techState, techId ou country inválido');
    return { techState: null, cost: 0 };
  }
  
  const tech = TECHNOLOGIES?.find(t => t?.id === techId);
  if (!tech) return { techState: null, cost: 0 };
  
  // Verifica se já foi pesquisada por este país
  if (techState.completedTechnologies?.includes(techId)) return { techState: null, cost: 0 };
  
  // Verifica pré-requisitos
  const hasPrereqs = tech.prerequisites?.every(prereqId => 
    techState.completedTechnologies?.includes(prereqId)
  ) ?? true;
  if (!hasPrereqs) return { techState: null, cost: 0 };
  
  // Verifica se tem ouro suficiente
  if (country.resources?.gold < tech.costGold) {
    return { techState: null, cost: tech.costGold };
  }
  
  return {
    techState: {
      ...techState,
      activeResearchId: techId,
      researchProgressDays: 0 // Reseta progresso isolado
    },
    cost: tech.costGold
  };
}


/**
 * Calcula os bônus acumulados de todas as tecnologias e focos completados
 */
export function calculateTechBonuses(techState: CountryTechState): {
  combatPowerBonus: {
    infantry: number;
    cavalry: number;
    artillery: number;
  };
  goldIncomeMultiplier: number;
  buildCostMultiplier: number;
  buildTimeMultiplier: number;
  manpowerMultiplier: number;
} {
  const bonuses = {
    combatPowerBonus: {
      infantry: 0,
      cavalry: 0,
      artillery: 0
    },
    goldIncomeMultiplier: 1.0,
    buildCostMultiplier: 1.0,
    buildTimeMultiplier: 1.0,
    manpowerMultiplier: 1.0
  };

  // Processa focos completados
  for (const focusId of techState.completedFocuses) {
    const focus = NATIONAL_FOCUSES.find(f => f.id === focusId);
    if (focus) {
      applyRewardEffect(focus.rewardEffect, bonuses);
    }
  }

  // Processa tecnologias completadas
  for (const techId of techState.completedTechnologies) {
    const tech = TECHNOLOGIES.find(t => t.id === techId);
    if (tech) {
      applyRewardEffect(tech.rewardEffect, bonuses);
    }
  }

  return bonuses;
}

/**
 * Aplica um efeito de recompensa aos bônus acumulados
 */
function applyRewardEffect(
  effect: RewardEffect,
  bonuses: ReturnType<typeof calculateTechBonuses>
): void {
  switch (effect.type) {
    case 'COMBAT_POWER':
      if (effect.unitType === 'infantry') {
        bonuses.combatPowerBonus.infantry += effect.value;
      } else if (effect.unitType === 'cavalry') {
        bonuses.combatPowerBonus.cavalry += effect.value;
      } else if (effect.unitType === 'artillery') {
        bonuses.combatPowerBonus.artillery += effect.value;
      }
      break;
    case 'GOLD_INCOME':
      bonuses.goldIncomeMultiplier += effect.value;
      break;
    case 'BUILD_COST':
      bonuses.buildCostMultiplier += effect.value; // value é negativo
      break;
    case 'BUILD_TIME':
      bonuses.buildTimeMultiplier += effect.value; // value é negativo
      break;
    case 'MANPOWER':
      bonuses.manpowerMultiplier += effect.value;
      break;
  }
}

/**
 * Cria o estado inicial de tecnologias para um país
 */
export function createInitialTechState(countryTag: string): CountryTechState {
  return {
    countryTag,
    activeFocusId: null,
    activeResearchId: null,
    completedFocuses: [],
    completedTechnologies: [],
    focusProgressDays: 0,
    researchProgressDays: 0
  };
}
