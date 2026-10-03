import type { Technology } from '../../../types/technology';
export const INDUSTRY_TECHNOLOGIES: Technology[] = [
  { id: 'improved_tools', name: 'Ferramentas Melhoradas', description: '+5% produção real de TOOLS.', category: 'INDUSTRY', icon: '🔧', researchCost: 45, goldCost: 320, prerequisites: [], effects: [{ type: 'toolProduction', value: 0.05 }] },
  { id: 'metallurgy', name: 'Metalurgia', description: '+10% produção real de IRON.', category: 'INDUSTRY', icon: '⚙️', researchCost: 65, goldCost: 480, prerequisites: ['improved_tools'], effects: [{ type: 'ironProduction', value: 0.10 }] },
  { id: 'organized_production', name: 'Produção Organizada', description: '+10% TOOLS e +5% WOOD.', category: 'INDUSTRY', icon: '🏭', researchCost: 90, goldCost: 700, prerequisites: ['metallurgy'], effects: [{ type: 'toolProduction', value: 0.10 }, { type: 'woodProduction', value: 0.05 }] },
];
