/**
 * ============================================================
 * SISTEMA DE ESTABILIDADE E PRESTÍGIO
 * ============================================================
 * Gerencia ganhos e perdas de estabilidade e prestígio baseado em eventos
 */

import { Country } from '../types';

/**
 * Modificadores baseados no nível de estabilidade
 */
export interface StabilityModifiers {
  constructionSpeed: number; // Multiplicador de velocidade de construção
  recruitmentSpeed: number; // Multiplicador de velocidade de recrutamento
  goldIncome: number; // Multiplicador de renda de ouro
  manpowerGrowth: number; // Multiplicador de crescimento de manpower
}

/**
 * Calcula modificadores baseados na estabilidade atual
 */
export function getStabilityModifiers(stability: number): StabilityModifiers {
  if (stability >= 70) {
    // Estabilidade Alta
    return {
      constructionSpeed: 1.10, // +10%
      recruitmentSpeed: 1.10, // +10%
      goldIncome: 1.05, // +5%
      manpowerGrowth: 1.05, // +5%
    };
  } else if (stability >= 30) {
    // Estabilidade Média
    return {
      constructionSpeed: 1.0,
      recruitmentSpeed: 1.0,
      goldIncome: 1.0,
      manpowerGrowth: 1.0,
    };
  } else {
    // Estabilidade Baixa
    return {
      constructionSpeed: 0.80, // -20%
      recruitmentSpeed: 0.80, // -20%
      goldIncome: 0.90, // -10%
      manpowerGrowth: 0.90, // -10%
    };
  }
}

/**
 * Evento de mudança de estabilidade/prestígio
 */
export interface StabilityPrestigeEvent {
  type: 'battle_won' | 'battle_lost' | 'province_conquered' | 'province_lost';
  countryTag: string;
  stabilityChange: number;
  prestigeChange: number;
  description: string;
}

/**
 * Calcula mudanças de estabilidade e prestígio baseado em eventos
 */

/**
 * Aplica mudanças de estabilidade e prestígio a um país
 */
export function applyStabilityPrestigeChanges(
  country: Country,
  stabilityChange: number,
  prestigeChange: number
): Country {
  const newStability = Math.max(0, Math.min(100, country.resources.stability + stabilityChange));
  const newPrestige = Math.max(0, country.resources.prestige + prestigeChange);

  // // Log das mudanças
  // if (stabilityChange !== 0) {
  //   const symbol = stabilityChange > 0 ? '📈' : '📉';
  //   console.log(`${symbol} Estabilidade de ${country.name}: ${country.resources.stability}% → ${newStability}% (${stabilityChange > 0 ? '+' : ''}${stabilityChange}%)`);
  // }
  
  if (prestigeChange !== 0) {
    const symbol = prestigeChange > 0 ? '👑' : '💔';
    console.log(`${symbol} Prestígio de ${country.name}: ${country.resources.prestige} → ${newPrestige} (${prestigeChange > 0 ? '+' : ''}${prestigeChange})`);
  }

  return {
    ...country,
    resources: {
      ...country.resources,
      stability: newStability,
      prestige: newPrestige,
    },
  };
}

/**
 * Processa mudanças diárias naturais de estabilidade
 * Estabilidade tende a se recuperar lentamente se estiver abaixo de 50
 */
export function processDailyStabilityRecovery(country: Country): Country {
  let stabilityChange = 0;

  // Recuperação natural se estabilidade estiver baixa
  if (country.resources.stability < 50) {
    stabilityChange = 0.1; // +0.1% por dia
  }

  // Penalidade se estabilidade estiver muito baixa
  if (country.resources.stability < 20) {
    stabilityChange -= 0.2; // -0.2% por dia (instabilidade crescente)
  }

  if (stabilityChange !== 0) {
    return applyStabilityPrestigeChanges(country, stabilityChange, 0);
  }

  return country;
}

/**
 * Obtém descrição textual do nível de estabilidade
 */
export function getStabilityDescription(stability: number): string {
  if (stability >= 80) return 'Excelente';
  if (stability >= 60) return 'Boa';
  if (stability >= 40) return 'Moderada';
  if (stability >= 20) return 'Baixa';
  return 'Crítica';
}

/**
 * Obtém cor baseada no nível de estabilidade
 */
export function getStabilityColor(stability: number): string {
  if (stability >= 70) return 'var(--accent-green)';
  if (stability >= 40) return 'var(--accent-gold)';
  return 'var(--accent-red)';
}
