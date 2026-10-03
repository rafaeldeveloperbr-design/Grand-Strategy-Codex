import type { Technology } from '../../../types/technology';
export const INFRASTRUCTURE_TECHNOLOGIES: Technology[] = [
  { id: 'civil_engineering', name: 'Engenharia Civil', description: '+10% velocidade de construção e +5% produtividade de infraestrutura.', category: 'INFRASTRUCTURE', icon: '🏗️', researchCost: 45, goldCost: 350, prerequisites: [], effects: [{ type: 'constructionSpeed', value: 0.10 }, { type: 'infrastructureProductivity', value: 0.05 }] },
  { id: 'organized_storage', name: 'Armazenamento Organizado', description: '+15% capacidade real dos Armazéns.', category: 'INFRASTRUCTURE', icon: '📦', researchCost: 65, goldCost: 500, prerequisites: ['civil_engineering'], effects: [{ type: 'warehouseCapacity', value: 0.15 }] },
  { id: 'trade_networks', name: 'Redes Comerciais', description: '+10% eficiência de distribuição interna.', category: 'INFRASTRUCTURE', icon: '🛣️', researchCost: 90, goldCost: 700, prerequisites: ['organized_storage'], effects: [{ type: 'internalTradeEfficiency', value: 0.10 }] },
];
