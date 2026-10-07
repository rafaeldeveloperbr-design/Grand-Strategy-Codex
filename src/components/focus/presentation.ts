import type { FocusCategory, NationalFocus, CountryTechState } from '../../types/technology';

export const FOCUS_CATEGORIES: Record<FocusCategory, { label: string; icon: string; color: string }> = {
  POLITICS: { label: 'Política', icon: '👑', color: '#8597bd' },
  ECONOMY: { label: 'Economia', icon: '📈', color: '#83a88b' },
  INDUSTRY: { label: 'Indústria', icon: '⚙️', color: '#b2a17e' },
  MILITARY: { label: 'Militar', icon: '⚔️', color: '#b48b86' },
  DIPLOMACY: { label: 'Diplomacia', icon: '🌐', color: '#7fa9b1' },
  RESEARCH: { label: 'Ciência e Pesquisa', icon: '🔬', color: '#a295bc' },
};

export type FocusNodeStatus = 'available' | 'blocked' | 'active' | 'completed' | 'exclusive-blocked';
export const STATUS_LABELS: Record<FocusNodeStatus, string> = {
  available: 'Disponível', blocked: 'Bloqueado', active: 'Ativo', completed: 'Concluído', 'exclusive-blocked': 'Bloqueado por exclusividade',
};

// Presentation only: availability always comes from the canonical engine reason.
export function getFocusNodeStatus(focus: NationalFocus, state: CountryTechState, blockReason: string | null): FocusNodeStatus {
  if (state.completedFocuses.includes(focus.id)) return 'completed';
  if (state.activeFocusId === focus.id) return 'active';
  if (blockReason?.includes('exclusiva')) return 'exclusive-blocked';
  return blockReason ? 'blocked' : 'available';
}

export function getFocusPercent(focus: NationalFocus, progressDays: number): number {
  return Math.round(Math.max(0, Math.min(100, progressDays / focus.durationDays * 100)));
}
