/**
 * ============================================================
 * COMPONENTE DE SELEÇÃO DE DIFICULDADE
 * ============================================================
 * Permite ao jogador escolher o nível de dificuldade da IA
 */

import React from 'react';
import { AIDifficulty, DIFFICULTY_DESCRIPTIONS, DIFFICULTY_ICONS } from '../types/difficulty';
import { getDifficultyName } from '../utils/translations';

interface DifficultySelectorProps {
  currentDifficulty: AIDifficulty;
  onDifficultyChange: (difficulty: AIDifficulty) => void;
}

/**
 * Componente de seleção de dificuldade da IA
 */
export const DifficultySelector: React.FC<DifficultySelectorProps> = ({
  currentDifficulty,
  onDifficultyChange
}) => {
  const difficulties: AIDifficulty[] = ['easy', 'medium', 'hard', 'impossible'];

  return (
    <div className="difficulty-selector">
      <h3 className="difficulty-selector__title">🎯 Dificuldade da IA</h3>
      <div className="difficulty-selector__options">
        {difficulties.map((difficulty) => (
          <button
            key={difficulty}
            className={`difficulty-selector__option ${
              currentDifficulty === difficulty ? 'difficulty-selector__option--active' : ''
            }`}
            onClick={() => onDifficultyChange(difficulty)}
          >
            <span className="difficulty-selector__icon">{DIFFICULTY_ICONS[difficulty]}</span>
            <div className="difficulty-selector__info">
              <span className="difficulty-selector__name">{getDifficultyName(difficulty)}</span>
              <span className="difficulty-selector__description">{DIFFICULTY_DESCRIPTIONS[difficulty]}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
