import { Technology } from '../../../types/technology';

export const MILITARY_TECHNOLOGIES: Technology[] = [
  {
    id: 'tech_improved_weapons',
    title: 'Armas Melhoradas',
    description: 'Desenvolvimento de armas mais eficazes para a infantaria.',
    category: 'MILITARY',
    icon: '🗡️',
    costGold: 500,
    durationDays: 60,
    currentProgressDays: 0,
    researched: false,
    prerequisites: [],
    rewardEffect: {
      type: 'COMBAT_POWER',
      value: 0.10,
      unitType: 'infantry'
    }
  },
  {
    id: 'tech_cavalry_tactics',
    title: 'Táticas de Cavalaria',
    description: 'Novas táticas de combate montado para aumentar a eficácia da cavalaria.',
    category: 'MILITARY',
    icon: '🏇',
    costGold: 600,
    durationDays: 70,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_improved_weapons'],
    rewardEffect: {
      type: 'COMBAT_POWER',
      value: 0.15,
      unitType: 'cavalry'
    }
  },
  {
    id: 'tech_artillery_development',
    title: 'Desenvolvimento de Artilharia',
    description: 'Avanços na fabricação de canhões e artilharia de cerco.',
    category: 'MILITARY',
    icon: '💣',
    costGold: 800,
    durationDays: 90,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_improved_weapons'],
    rewardEffect: {
      type: 'COMBAT_POWER',
      value: 0.20,
      unitType: 'artillery'
    }
  },
  {
    id: 'tech_siege_artillery',
    title: 'Artilharia de Cerco Avançada',
    description: 'Desenvolvimento de artilharia especializada em derrubar fortificações.',
    category: 'MILITARY',
    icon: '🎯',
    costGold: 900,
    durationDays: 100,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_artillery_development'],
    rewardEffect: {
      type: 'COMBAT_POWER',
      value: 0.20,
      unitType: 'artillery'
    }
  },
  {
    id: 'tech_line_infantry_doctrine',
    title: 'Doutrina de Infantaria em Linha',
    description: 'Táticas de formação em linha para maximizar a defesa da infantaria.',
    category: 'MILITARY',
    icon: '🛡️',
    costGold: 700,
    durationDays: 80,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_improved_weapons'],
    rewardEffect: {
      type: 'COMBAT_POWER',
      value: 0.10,
      unitType: 'infantry'
    }
  },
  {
    id: 'tech_heavy_cavalry_tactics',
    title: 'Táticas de Cavalaria Pesada',
    description: 'Técnicas avançadas de combate para cavalaria pesada.',
    category: 'MILITARY',
    icon: '⚔️',
    costGold: 850,
    durationDays: 90,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_cavalry_tactics'],
    rewardEffect: {
      type: 'COMBAT_POWER',
      value: 0.15,
      unitType: 'cavalry'
    }
  },
  {
    id: 'tech_military_logistics',
    title: 'Logística Militar',
    description: 'Sistemas avançados de suprimentos para reduzir custos de manutenção.',
    category: 'MILITARY',
    icon: '📦',
    costGold: 1000,
    durationDays: 110,
    currentProgressDays: 0,
    researched: false,
    prerequisites: ['tech_siege_artillery', 'tech_line_infantry_doctrine'],
    rewardEffect: {
      type: 'MANPOWER',
      value: -0.10
    }
  }
];