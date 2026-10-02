import { Technology } from '../../../types/technology';

export const ECONOMIC_TECHNOLOGIES: Technology[] = [
  {
    id: 'tech_banking_system',
    title: 'Sistema Bancário',
    description: 'Implementação de um sistema bancário para aumentar a eficiência econômica.',
    category: 'ECONOMY',
    icon: '🏦',
    costGold: 400,
    durationDays: 50,
    currentProgressDays: 0,
    researched: false,
    prerequisites: [],
    rewardEffect: {
      type: 'GOLD_INCOME',
      value: 0.10
    }
  },
  {
    id: 'tech_trade_routes',
    title: 'Rotas Comerciais',
    description: 'Estabelecimento de rotas comerciais para aumentar o comércio.',
    category: 'ECONOMY',
    icon: '🚢',
    costGold: 600,
    durationDays: 70,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_banking_system'],
    rewardEffect: {
      type: 'GOLD_INCOME',
      value: 0.15
    }
  },
  {
    id: 'tech_tax_reform',
    title: 'Reforma Tributária',
    description: 'Reforma do sistema tributário para aumentar a arrecadação.',
    category: 'ECONOMY',
    icon: '📜',
    costGold: 500,
    durationDays: 60,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_banking_system'],
    rewardEffect: {
      type: 'GOLD_INCOME',
      value: 0.12
    }
  },
  {
    id: 'tech_mercantilism',
    title: 'Mercantilismo',
    description: 'Políticas econômicas para maximizar a eficiência de mercados e portos.',
    category: 'ECONOMY',
    icon: '💹',
    costGold: 800,
    durationDays: 85,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_trade_routes'],
    rewardEffect: {
      type: 'GOLD_INCOME',
      value: 0.15
    }
  },
  {
    id: 'tech_pre_industrial_manufacturing',
    title: 'Manufatura Pré-Industrial',
    description: 'Técnicas de produção em massa para acelerar construções.',
    category: 'ECONOMY',
    icon: '🏭',
    costGold: 1100,
    durationDays: 120,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_mercantilism', 'tech_tax_reform'],
    rewardEffect: {
      type: 'BUILD_TIME',
      value: -0.15
    }
  }
];