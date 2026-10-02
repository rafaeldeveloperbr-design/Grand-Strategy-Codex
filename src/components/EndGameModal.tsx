/**
 * ============================================================
 * MÓDULO 7 - Modal de Fim de Jogo
 * ============================================================
 * Exibe tela de vitória ou derrota com estatísticas da partida
 */

import React from 'react';
import { EndGameType, GameStats, formatDuration } from '../engine/gameConditions';

interface EndGameModalProps {
  endGameType: EndGameType;
  stats: GameStats;
  onContinue: () => void;
  onRestart: () => void;
}

/**
 * Modal de fim de jogo (vitória ou derrota)
 */
export const EndGameModal: React.FC<EndGameModalProps> = ({
  endGameType,
  stats,
  onContinue,
  onRestart
}) => {
  if (!endGameType) return null;

  const isVictory = endGameType === 'victory';

  return (
    <div className="endgame-modal">
      <div className="endgame-modal__overlay" />
      
      <div className={`endgame-modal__container ${isVictory ? 'victory' : 'defeat'}`}>
        {/* Título e Mensagem */}
        <div className="endgame-modal__header">
          <div className="endgame-modal__icon">
            {isVictory ? '👑' : '💀'}
          </div>
          <h1 className="endgame-modal__title">
            {isVictory ? 'VITÓRIA GLORIOSA!' : 'DERROTA INEVITÁVEL!'}
          </h1>
          <p className="endgame-modal__message">
            {isVictory 
              ? 'Você conquistou 100% das províncias e unificou o mundo!'
              : 'Seu império caiu e todas as suas províncias foram conquistadas.'}
          </p>
        </div>

        {/* Resumo da Partida */}
        <div className="endgame-modal__stats">
          <h2 className="endgame-modal__stats-title">Resumo da Partida</h2>
          
          <div className="endgame-modal__stats-grid">
            {/* Tempo Decorrido */}
            <div className="endgame-modal__stat-card">
              <div className="endgame-modal__stat-icon">⏱️</div>
              <div className="endgame-modal__stat-label">Tempo Decorrido</div>
              <div className="endgame-modal__stat-value">
                {formatDuration(stats.totalDays)}
              </div>
              <div className="endgame-modal__stat-detail">
                ({stats.totalDays} dias)
              </div>
            </div>

            {/* Batalhas */}
            <div className="endgame-modal__stat-card">
              <div className="endgame-modal__stat-icon">⚔️</div>
              <div className="endgame-modal__stat-label">Batalhas</div>
              <div className="endgame-modal__stat-value">
                <span className="victory">{stats.battlesWon}</span>
                {' / '}
                <span className="defeat">{stats.battlesLost}</span>
              </div>
              <div className="endgame-modal__stat-detail">
                (Vencidas / Perdidas)
              </div>
            </div>

            {/* Baixas Inimigas */}
            <div className="endgame-modal__stat-card">
              <div className="endgame-modal__stat-icon">🎯</div>
              <div className="endgame-modal__stat-label">Baixas Inimigas</div>
              <div className="endgame-modal__stat-value victory">
                {stats.enemyCasualties.toLocaleString()}
              </div>
              <div className="endgame-modal__stat-detail">
                soldados abatidos
              </div>
            </div>

            {/* Baixas Próprias */}
            <div className="endgame-modal__stat-card">
              <div className="endgame-modal__stat-icon">💔</div>
              <div className="endgame-modal__stat-label">Baixas Próprias</div>
              <div className="endgame-modal__stat-value defeat">
                {stats.ownCasualties.toLocaleString()}
              </div>
              <div className="endgame-modal__stat-detail">
                soldados perdidos
              </div>
            </div>

            {/* Províncias Conquistadas */}
            <div className="endgame-modal__stat-card full-width">
              <div className="endgame-modal__stat-icon">🏰</div>
              <div className="endgame-modal__stat-label">Províncias Sob Seu Controle</div>
              <div className="endgame-modal__stat-value">
                {stats.provincesControlled} / {stats.totalProvinces}
              </div>
              <div className="endgame-modal__stat-detail">
                ({((stats.provincesControlled / stats.totalProvinces) * 100).toFixed(1)}% do mapa)
              </div>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="endgame-modal__actions">
          <button 
            className="endgame-modal__btn endgame-modal__btn--continue"
            onClick={onContinue}
          >
            🎮 Continuar Jogando
          </button>
          <button 
            className="endgame-modal__btn endgame-modal__btn--restart"
            onClick={onRestart}
          >
            🔄 Reiniciar Partida
          </button>
        </div>
      </div>
    </div>
  );
};
