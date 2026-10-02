/**
 * ============================================================
 * SISTEMA DE DIFICULDADE DA IA
 * ============================================================
 * Define os níveis de dificuldade e seus multiplicadores de velocidade
 */

/**
 * Níveis de dificuldade disponíveis
 */
export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'impossible';

/**
 * Multiplicadores de velocidade para cada nível de dificuldade
 * Afeta: construção, recrutamento, pesquisa e focos nacionais
 */
export const DIFFICULTY_SPEED_MULTIPLIERS: Record<AIDifficulty, number> = {
  easy: 0.10,       // 10% da velocidade normal
  medium: 0.40,     // 40% da velocidade normal
  hard: 0.60,       // 60% da velocidade normal
  impossible: 1.00  // 100% da velocidade normal (1:1 com o jogador)
};

/**
 * Nomes descritivos de cada nível de dificuldade
 */
export const DIFFICULTY_DESCRIPTIONS: Record<AIDifficulty, string> = {
  easy: 'Fácil - IA age lentamente (10% da velocidade)',
  medium: 'Médio - IA age moderadamente (40% da velocidade)',
  hard: 'Difícil - IA age rapidamente (60% da velocidade)',
  impossible: 'Impossível - IA age na mesma velocidade do jogador (100%)'
};

/**
 * Ícones para cada nível de dificuldade
 */
export const DIFFICULTY_ICONS: Record<AIDifficulty, string> = {
  easy: '🟢',
  medium: '🟡',
  hard: '🟠',
  impossible: '🔴'
};
