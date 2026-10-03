import type { Technology } from '../../../types/technology';
export const MILITARY_TECHNOLOGIES: Technology[] = [
  { id: 'military_training', name: 'Treinamento Militar', description: '+5% ataque e defesa no combate ativo.', category: 'MILITARY', icon: '⚔️', researchCost: 45, goldCost: 350, prerequisites: [], effects: [{ type: 'armyAttack', value: 0.05 }, { type: 'armyDefense', value: 0.05 }] },
  { id: 'military_metallurgy', name: 'Metalurgia Militar', description: '+10% ataque das tropas equipadas.', category: 'MILITARY', icon: '🛡️', researchCost: 65, goldCost: 520, prerequisites: ['military_training'], effects: [{ type: 'armyAttack', value: 0.10 }] },
  { id: 'modern_fortifications', name: 'Fortificações Modernas', description: '+15% efeito defensivo das Fortalezas.', category: 'MILITARY', icon: '🏰', researchCost: 90, goldCost: 720, prerequisites: ['military_metallurgy'], effects: [{ type: 'fortressDefense', value: 0.15 }, { type: 'armyDefense', value: 0.05 }] },
];
