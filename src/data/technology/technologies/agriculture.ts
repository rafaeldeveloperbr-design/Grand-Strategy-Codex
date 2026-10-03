import type { Technology } from '../../../types/technology';
export const AGRICULTURE_TECHNOLOGIES: Technology[] = [
  { id: 'agriculture_organized', name: 'Agricultura Organizada', description: '+5% produção real de FOOD.', category: 'AGRICULTURE', icon: '🌾', researchCost: 45, goldCost: 300, prerequisites: [], effects: [{ type: 'foodProduction', value: 0.05 }] },
  { id: 'crop_rotation', name: 'Rotação de Culturas', description: '+10% produção real de FOOD.', category: 'AGRICULTURE', icon: '🔄', researchCost: 65, goldCost: 450, prerequisites: ['agriculture_organized'], effects: [{ type: 'foodProduction', value: 0.10 }] },
  { id: 'intensive_agriculture', name: 'Agricultura Intensiva', description: '+15% produção de FOOD e +5% produtividade de infraestrutura.', category: 'AGRICULTURE', icon: '🚜', researchCost: 90, goldCost: 650, prerequisites: ['crop_rotation'], effects: [{ type: 'foodProduction', value: 0.15 }, { type: 'infrastructureProductivity', value: 0.05 }] },
];
