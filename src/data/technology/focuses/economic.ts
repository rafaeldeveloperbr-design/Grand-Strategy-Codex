import { NationalFocus } from '../../../types/technology';

export const ECONOMIC_FOCUSES: NationalFocus[] = [
  {
    id: 'focus_economic_expansion',
    title: 'Expansão Econômica',
    description: 'Focar no desenvolvimento econômico para aumentar a arrecadação de impostos.',
    icon: '💰',
    durationDays: 70,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'GOLD_INCOME',
      value: 0.20
    }
  },
  {
    id: 'focus_industrial_revolution',
    title: 'Revolução Industrial',
    description: 'Iniciar a industrialização para reduzir custos de construção.',
    icon: '🏭',
    durationDays: 100,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'BUILD_TIME',
      value: -0.30
    },
    prerequisites: ['focus_economic_expansion']
  },
  {
    id: 'focus_agrarian_reform',
    title: 'Reforma Agrária',
    description: 'Redistribuição de terras para aumentar a produção agrícola.',
    icon: '🌾',
    durationDays: 70,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'GOLD_INCOME',
      value: 100
    }
  },
  {
    id: 'focus_commercial_expansion',
    title: 'Expansão Comercial',
    description: 'Expansão agressiva das rotas comerciais e mercados.',
    icon: '📈',
    durationDays: 85,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'GOLD_INCOME',
      value: 0.20
    },
    prerequisites: ['focus_economic_expansion']
  },
  {
    id: 'focus_manufacturing_incentive',
    title: 'Incentivo à Manufatura',
    description: 'Subsídios e incentivos para desenvolvimento industrial.',
    icon: '🏭',
    durationDays: 90,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'BUILD_TIME',
      value: -0.15
    },
    prerequisites: ['focus_commercial_expansion']
  }
];