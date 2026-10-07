import type { TechnologyCategory, Technology, CountryTechState } from '../../types/technology';

export const RESEARCH_CATEGORIES: Record<TechnologyCategory, { label: string; icon: string; color: string }> = {
  MILITARY: { label: 'Militar', icon: '⚔️', color: '#b48b86' },
  INDUSTRY: { label: 'Indústria', icon: '⚙️', color: '#b2a17e' },
  ECONOMY: { label: 'Economia', icon: '📈', color: '#83a88b' },
  SOCIETY: { label: 'Sociedade', icon: '🏛️', color: '#8597bd' },
};
export type ResearchNodeStatus = 'available' | 'blocked' | 'active' | 'completed';
export const STATUS_LABELS: Record<ResearchNodeStatus, string> = {
  available: 'Disponível', blocked: 'Bloqueada', active: 'Ativa', completed: 'Concluída',
};
// Only presentation: the canonical validator supplies availability.
export function getResearchNodeStatus(technology: Technology, state: CountryTechState, reason: string | null): ResearchNodeStatus {
  if (state.completedTechnologies.includes(technology.id)) return 'completed';
  if (state.activeResearchId === technology.id) return 'active';
  return reason ? 'blocked' : 'available';
}
