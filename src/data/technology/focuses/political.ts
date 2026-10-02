import { NationalFocus } from '../../../types/technology';

export const POLITICAL_FOCUSES: NationalFocus[] = [
  {
    id: 'focus_national_unity',
    title: 'Unidade Nacional',
    description: 'Fortalecer a coesão nacional para aumentar a estabilidade e mão de obra.',
    icon: '🤝',
    durationDays: 70,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'MANPOWER',
      value: 0.15
    }
  },
  {
    id: 'focus_kingdom_centralization',
    title: 'Centralização do Reino',
    description: 'Consolidação do poder central para maior estabilidade e eficiência.',
    icon: '👑',
    durationDays: 80,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'STABILITY',
      value: 0.10
    }
  },
  {
    id: 'focus_scientific_patronage',
    title: 'Patronato Científico',
    description: 'Investimento em pesquisa e desenvolvimento científico.',
    icon: '🔬',
    durationDays: 75,
    currentProgressDays: 0,
    completed: false,
    rewardEffect: {
      type: 'RESEARCH_SPEED',
      value: 0.20
    },
    prerequisites: ['focus_kingdom_centralization']
  }
];