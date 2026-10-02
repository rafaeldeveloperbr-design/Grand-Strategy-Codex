/**
 * ============================================================
 * DEFINIÇÕES DE LEIS
 * ============================================================
 */

import { Law } from '../types/government';

export const LAWS: Record<string, Law> = {
  // === CONSCRIPTION (Recrutamento) ===
  'conscription_peacetime': {
    id: 'conscription_peacetime',
    category: 'conscription',
    name: 'Recrutamento em Tempo de Paz',
    description: 'Recrutamento voluntário e limitado. Menor custo de manutenção, mas menos tropas disponíveis.',
    costGold: 0,
    bonuses: {
      manpowerMultiplier: 1.0,
      armyCostMultiplier: 1.0,
    },
  },
  'conscription_limited': {
    id: 'conscription_limited',
    category: 'conscription',
    name: 'Recrutamento Limitado',
    description: 'Aumenta o pool de recrutáveis e reduz custos de treinamento militar.',
    costGold: 1000,
    bonuses: {
      manpowerMultiplier: 1.25,
      armyCostMultiplier: 0.9,
    },
  },
  'conscription_total': {
    id: 'conscription_total',
    category: 'conscription',
    name: 'Recrutamento Total',
    description: 'Mobilização total da população. Máximo de tropas, mas custos elevados.',
    costGold: 3000,
    bonuses: {
      manpowerMultiplier: 1.75,
      armyCostMultiplier: 1.2,
    },
  },

  // === TAXATION (Tributação) ===
  'taxation_low': {
    id: 'taxation_low',
    category: 'taxation',
    name: 'Tributação Baixa',
    description: 'Impostos reduzidos para estimular o crescimento populacional e a felicidade.',
    costGold: 0,
    bonuses: {
      goldMultiplier: 0.8,
      popGrowthMultiplier: 1.2,
    },
  },
  'taxation_normal': {
    id: 'taxation_normal',
    category: 'taxation',
    name: 'Tributação Normal',
    description: 'Equilíbrio entre arrecadação e crescimento populacional.',
    costGold: 1500,
    bonuses: {
      goldMultiplier: 1.0,
      popGrowthMultiplier: 1.0,
    },
  },
  'taxation_high': {
    id: 'taxation_high',
    category: 'taxation',
    name: 'Tributação Alta',
    description: 'Impostos elevados para maximizar a arrecadação, mas reduz o crescimento populacional.',
    costGold: 4000,
    bonuses: {
      goldMultiplier: 1.4,
      popGrowthMultiplier: 0.8,
    },
  },

  // === GOVERNANCE (Governança) ===
  'governance_decentralized': {
    id: 'governance_decentralized',
    category: 'governance',
    name: 'Governança Descentralizada',
    description: 'Autonomia regional. Construção mais rápida, mas menos eficiente.',
    costGold: 0,
    bonuses: {
      buildTimeMultiplier: 0.85,
      goldMultiplier: 0.95,
    },
  },
  'governance_balanced': {
    id: 'governance_balanced',
    category: 'governance',
    name: 'Governança Balanceada',
    description: 'Equilíbrio entre eficiência central e autonomia local.',
    costGold: 2000,
    bonuses: {
      buildTimeMultiplier: 1.0,
      goldMultiplier: 1.0,
    },
  },
  'governance_centralized': {
    id: 'governance_centralized',
    category: 'governance',
    name: 'Governança Centralizada',
    description: 'Controle central forte. Maior eficiência econômica, mas construção mais lenta.',
    costGold: 5000,
    bonuses: {
      buildTimeMultiplier: 1.2,
      goldMultiplier: 1.15,
    },
  },

  // === WAR ECONOMY (Economia de Guerra) - NOVO ===
  'economy_civilian': {
    id: 'economy_civilian',
    category: 'economy',
    name: 'Economia Civil',
    description: 'Foco na construção civil. Mais barata e rápida para edifícios civis.',
    costGold: 0,
    bonuses: {
      civilianBuildTimeMultiplier: 0.8,
      militaryFactoryCostMultiplier: 1.2,
    },
  },
  'economy_war_early': {
    id: 'economy_war_early',
    category: 'economy',
    name: 'Economia de Guerra Inicial',
    description: 'Início da mobilização industrial para produção militar.',
    costGold: 3500,
    bonuses: {
      militaryFactoryCostMultiplier: 0.9,
      armyCostMultiplier: 0.95,
    },
  },
  'economy_war_total': {
    id: 'economy_war_total',
    category: 'economy',
    name: 'Economia de Guerra Total',
    description: 'Mobilização total da indústria. Produção militar máxima, economia civil penalizada.',
    costGold: 6000,
    bonuses: {
      militaryFactoryCostMultiplier: 0.75,
      civilianBuildTimeMultiplier: 1.4,
      goldMultiplier: 1.1,
    },
  },

  // === INTELLIGENCE (Doutrina) - NOVO ===
  'intel_disorganized': {
    id: 'intel_disorganized',
    category: 'intelligence',
    name: 'Serviço Secreto Desorganizado',
    description: 'Inteligência básica. Sem bônus.',
    costGold: 0,
    bonuses: {
      researchSpeedMultiplier: 1.0,
    },
  },
  'intel_agency': {
    id: 'intel_agency',
    category: 'intelligence',
    name: 'Agência de Inteligência',
    description: 'Agência centralizada. Melhora pesquisa militar e eficiência de focos.',
    costGold: 2500,
    bonuses: {
      researchSpeedMultiplier: 1.15,
      focusTimeMultiplier: 0.9,
    },
  },
  'intel_total': {
    id: 'intel_total',
    category: 'intelligence',
    name: 'Inteligência Total',
    description: 'Rede global de espionagem. Pesquisa e focos muito mais rápidos.',
    costGold: 7000,
    bonuses: {
      researchSpeedMultiplier: 1.3,
      focusTimeMultiplier: 0.8,
    },
  },
};

export const LAWS_BY_CATEGORY = {
  conscription: ['conscription_peacetime', 'conscription_limited', 'conscription_total'],
  taxation: ['taxation_low', 'taxation_normal', 'taxation_high'],
  governance: ['governance_decentralized', 'governance_balanced', 'governance_centralized'],
  economy: ['economy_civilian', 'economy_war_early', 'economy_war_total'],
  intelligence: ['intel_disorganized', 'intel_agency', 'intel_total'],
};

export const DEFAULT_LAWS = {
  conscription: 'conscription_peacetime',
  taxation: 'taxation_normal',
  governance: 'governance_balanced',
  economy: 'economy_civilian',
  intelligence: 'intel_disorganized',
};