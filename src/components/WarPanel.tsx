/**
 * ============================================================
 * MÓDULO 4 - Painel de Guerra
 * ============================================================
 * Exibe guerras ativas e permite assinar tratados de paz
 */

import React from 'react';
import { Country } from '../types';
import { War } from '../types/diplomacy';

interface WarPanelProps {
  wars: War[];
  playerCountry: Country;
  allCountries: Country[];
  onClose: () => void;
  onMakePeace: (warId: string) => void;
}

/**
 * Painel de guerras ativas
 */
export const WarPanel: React.FC<WarPanelProps> = ({
  wars,
  playerCountry,
  allCountries,
  onClose,
  onMakePeace
}) => {
  // Filtra guerras que envolvem o jogador
  const playerWars = wars.filter(
    w => w.attacker === playerCountry.tag || w.defender === playerCountry.tag
  );

    const getCountryByTag = (tag: string): Country | undefined => {
    const found = allCountries.find(c => c.tag === tag);
    if (found) return found;
    if (tag.startsWith('rebel_')) {
      return { tag, name: 'Exército Rebelde', flag: '🏴‍️', color: '#808080' } as Country;
    }
    return undefined;
  };

  const formatDate = (date: { year: number; month: number; day: number }): string => {
    return `${date.day}/${date.month}/${date.year}`;
  };

  if (playerWars.length === 0) {
    return (
      <div className="war-panel">
        <div className="war-panel__header">
          <h2>🕊️ Guerras Ativas</h2>
          <button className="war-panel__close" onClick={onClose}>✕</button>
        </div>
        <div className="war-panel__empty">
          <p>Nenhuma guerra ativa no momento.</p>
          <p className="war-panel__empty-subtitle">Seu país está em paz com todos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="war-panel">
      {/* Cabeçalho */}
      <div className="war-panel__header">
        <h2>⚔️ Guerras Ativas</h2>
        <button className="war-panel__close" onClick={onClose}>✕</button>
      </div>

      {/* Lista de Guerras */}
      <div className="war-panel__wars">
        {playerWars.map(war => {
          const attacker = getCountryByTag(war.attacker);
          const defender = getCountryByTag(war.defender);
          const isPlayerAttacker = war.attacker === playerCountry.tag;
          const playerSide = isPlayerAttacker ? 'attacker' : 'defender';
          const playerCasualties = isPlayerAttacker ? war.attackerCasualties : war.defenderCasualties;
          const enemyCasualties = isPlayerAttacker ? war.defenderCasualties : war.attackerCasualties;

          return (
            <div key={war.id} className="war-panel__war-card">
              {/* Cabeçalho da Guerra */}
              <div className="war-panel__war-header">
                <div className="war-panel__war-countries">
                  <span className="war-panel__country">
                    {attacker?.flag} {attacker?.name}
                  </span>
                  <span className="war-panel__vs">VS</span>
                  <span className="war-panel__country">
                    {defender?.flag} {defender?.name}
                  </span>
                </div>
                <span className="war-panel__war-date">
                  Desde {formatDate(war.startDate)}
                </span>
              </div>

              {/* War Score */}
              <div className="war-panel__war-score">
                <div className="war-panel__score-header">
                  <span className="war-panel__score-label">Pontuação de Guerra:</span>
                  <span className={`war-panel__score-value ${war.warScore > 0 ? 'war-panel__score-value--positive' : war.warScore < 0 ? 'war-panel__score-value--negative' : ''}`}>
                    {war.warScore > 0 ? '+' : ''}{war.warScore}
                  </span>
                </div>
                <div className="war-panel__score-bar">
                  <div 
                    className="war-panel__score-fill"
                    style={{ 
                      width: `${Math.min(100, Math.max(0, 50 + war.warScore / 2))}%`,
                      backgroundColor: war.warScore > 0 ? '#2ecc71' : war.warScore < 0 ? '#e74c3c' : '#95a5a6'
                    }}
                  />
                  <div className="war-panel__score-marker" style={{ left: '50%' }} />
                </div>
                <div className="war-panel__score-labels">
                  <span>{attacker?.name}</span>
                  <span>{defender?.name}</span>
                </div>
              </div>

              {/* Baixas */}
              <div className="war-panel__casualties">
                <div className="war-panel__casualty-row">
                  <span className="war-panel__casualty-label">Suas Baixas:</span>
                  <span className="war-panel__casualty-value">{playerCasualties.toLocaleString()}</span>
                </div>
                <div className="war-panel__casualty-row">
                  <span className="war-panel__casualty-label">Baixas Inimigas:</span>
                  <span className="war-panel__casualty-value">{enemyCasualties.toLocaleString()}</span>
                </div>
              </div>

              {/* Províncias Ocupadas */}
              {(war.occupiedByAttacker.length > 0 || war.occupiedByDefender.length > 0) && (
                <div className="war-panel__occupied">
                  {war.occupiedByAttacker.length > 0 && (
                    <div className="war-panel__occupied-row">
                      <span className="war-panel__occupied-label">{attacker?.flag} Ocupadas por {attacker?.name}:</span>
                      <span className="war-panel__occupied-count">{war.occupiedByAttacker.length} províncias</span>
                    </div>
                  )}
                  {war.occupiedByDefender.length > 0 && (
                    <div className="war-panel__occupied-row">
                      <span className="war-panel__occupied-label">{defender?.flag} Ocupadas por {defender?.name}:</span>
                      <span className="war-panel__occupied-count">{war.occupiedByDefender.length} províncias</span>
                    </div>
                  )}
                </div>
              )}

              {/* Botão de Paz */}
              <button
                className="war-panel__peace-btn"
                onClick={() => onMakePeace(war.id)}
                disabled={war.warScore < -50 && playerSide === 'attacker'}
                title={war.warScore < -50 && playerSide === 'attacker' ? 'Pontuação de guerra muito desfavorável' : ''}
              >
                🕊️ Assinar Tratado de Paz
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
