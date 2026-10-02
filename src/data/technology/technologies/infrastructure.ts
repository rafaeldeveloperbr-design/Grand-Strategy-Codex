import { Technology } from '../../../types/technology';

export const INFRASTRUCTURE_TECHNOLOGIES: Technology[] = [
  {
    id: 'tech_construction_techniques',
    title: 'Técnicas de Construção',
    description: 'Melhorias nas técnicas de construção para reduzir custos.',
    category: 'INFRASTRUCTURE',
    icon: '🔨',
    costGold: 450,
    durationDays: 55,
    currentProgressDays: 0,
    researched: false,
    prerequisites: [],
    rewardEffect: {
      type: 'BUILD_COST',
      value: -0.15
    }
  },
  {
    id: 'tech_engineering_corps',
    title: 'Corpo de Engenheiros',
    description: 'Criação de um corpo especializado de engenheiros militares.',
    category: 'INFRASTRUCTURE',
    icon: '👷',
    costGold: 700,
    durationDays: 80,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_construction_techniques'],
    rewardEffect: {
      type: 'BUILD_TIME',
      value: -0.20
    }
  },
  {
    id: 'tech_fortification_design',
    title: 'Design de Fortificações',
    description: 'Avanços no design de fortificações para maior eficácia defensiva.',
    category: 'INFRASTRUCTURE',
    icon: '🏗️',
    costGold: 650,
    durationDays: 75,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_construction_techniques'],
    rewardEffect: {
      type: 'BUILD_COST',
      value: -0.20
    }
  },
  {
    id: 'tech_centralized_admin',
    title: 'Administração Centralizada',
    description: 'Sistema administrativo unificado para aumentar a estabilidade.',
    category: 'INFRASTRUCTURE',
    icon: '🏛️',
    costGold: 500,
    durationDays: 60,
    currentProgressDays: 0,
    researched: false,
    prerequisites: [],
    rewardEffect: {
      type: 'STABILITY',
      value: 0.05
    }
  },
  {
    id: 'tech_science_academy',
    title: 'Academia de Ciências',
    description: 'Instituição de pesquisa para acelerar o desenvolvimento tecnológico.',
    category: 'INFRASTRUCTURE',
    icon: '🔬',
    costGold: 750,
    durationDays: 90,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_centralized_admin'],
    rewardEffect: {
      type: 'RESEARCH_SPEED',
      value: 0.15
    }
  }
];