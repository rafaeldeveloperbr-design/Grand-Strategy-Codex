/**
 * ============================================================
 * TIPOS DE LOG DA IA
 * ============================================================
 */

export type AIActionType = 'building' | 'military' | 'tech' | 'focus' | 'diplomacy';

export interface AILogEntry {
  id: string;
  countryName: string;
  countryColor?: string;
  actionType: AIActionType;
  message: string;
  dateString: string;
  timestamp: number;
}
