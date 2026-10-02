import { NationalFocus } from '../../../types/technology';

export const MILITARY_FOCUSES: NationalFocus[] = [
  {
    id: 'focus_military_modernization',
    title: 'Modernização Militar',
    description: 'Investir na modernização das forças armadas, aumentando o poder de combate da infantaria.',
    icon: '⚔️',
    durationDays: 70,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'COMBAT_POWER',
      value: 0.15,
      unitType: 'infantry'
    }
  },
  {
    id: 'focus_fortification_program',
    title: 'Programa de Fortificação',
    description: 'Investir em fortificações para reduzir o custo de construção de defesas.',
    icon: '🏰',
    durationDays: 70,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'BUILD_COST',
      value: -0.25
    }
  },
  {
    id: 'focus_cavalry_traditions',
    title: 'Tradições de Cavalaria',
    description: 'Fortalecer as tradições de cavalaria, aumentando sua eficácia em combate.',
    icon: '🐎',
    durationDays: 70,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'COMBAT_POWER',
      value: 0.20,
      unitType: 'cavalry'
    },
    prerequisites: ['focus_military_modernization']
  },
  {
    id: 'focus_army_modernization',
    title: 'Modernização do Exército',
    description: 'Reforma completa das forças armadas para aumentar a eficiência militar.',
    icon: '🎖️',
    durationDays: 80,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'MANPOWER',
      value: 200
    },
    prerequisites: ['focus_military_modernization']
  },
  {
    id: 'focus_border_fortification',
    title: 'Fortalecimento das Fronteiras',
    description: 'Investimento massivo em defesas de fronteira.',
    icon: '🏰',
    durationDays: 75,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'BUILD_COST',
      value: -0.20
    },
    prerequisites: ['focus_fortification_program']
  }
];