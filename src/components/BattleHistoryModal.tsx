import React from 'react';
import { CombatResult, Country } from '../types';

interface BattleHistoryModalProps {
  battleHistory: CombatResult[];
  allCountries: Country[];
  onClose: () => void;
  onViewBattle: (battle: CombatResult) => void;
}

export const BattleHistoryModal: React.FC<BattleHistoryModalProps> = ({
  battleHistory,
  allCountries,
  onClose,
  onViewBattle,
}) => {
  const getCountryByTag = (tag: string): Country | undefined => {
    return allCountries.find(c => c.tag === tag);
  };

  const formatDate = (date: { year: number; month: number; day: number }): string => {
    if (!date) return '---';
    return `${date.day}/${date.month}/${date.year}`;
  };

  const safeNum = (v: number | null | undefined): string =>
    (v ?? 0).toLocaleString();
  const safeRatio = (v: number | null | undefined): string =>
    (v ?? 1).toFixed(2);

  return (
    <div className="battle-history-overlay">
      <div className="battle-history-modal">
        <div className="battle-history-header">
          <h2>📜 Histórico de Batalhas</h2>
          <button className="battle-history-close" onClick={onClose}>✕</button>
        </div>

        <div className="battle-history-content">
          {battleHistory.length === 0 ? (
            <div className="battle-history-empty">
              <p>Nenhuma batalha registrada ainda.</p>
              <p className="battle-history-empty-subtitle">
                As batalhas aparecerão aqui conforme ocorrem.
              </p>
            </div>
          ) : (
            <div className="battle-history-list">
              {battleHistory.map((battle, index) => {
                const attackerCountry = getCountryByTag(battle.attackerOriginal?.owner || battle.attacker?.owner);
                const defenderCountry = getCountryByTag(battle.defenderOriginal?.owner || battle.defender?.owner);
                const playerWon =
                  (battle.winner === 'attacker' && (battle.attackerOriginal?.owner === 'IMP' || battle.attacker?.owner === 'IMP')) ||
                  (battle.winner === 'defender' && (battle.defenderOriginal?.owner === 'IMP' || battle.defender?.owner === 'IMP'));

                const retreatInfo = battle.retreatInfo;

                return (
                  <div
                    key={index}
                    className={`battle-history-item ${playerWon ? 'victory' : 'defeat'}`}
                    onClick={() => onViewBattle(battle)}
                  >
                    <div className="battle-history-item-header">
                      <span className="battle-history-date">
                        📅 {formatDate(battle.date)}
                      </span>
                      <span className="battle-history-location">
                        📍 {battle.provinceName || '---'}
                      </span>
                      {retreatInfo?.retreated && (
                        <span className="battle-history-retreat" style={{ marginLeft: 8, color: '#fbbf24', fontSize: '0.8em' }}>
                          🏃 {retreatInfo.troops} → {retreatInfo.toName}
                        </span>
                      )}
                    </div>

                    <div className="battle-history-item-body">
                      <div className="battle-history-army">
                        <span className="battle-history-flag">{attackerCountry?.flag}</span>
                        <span className="battle-history-name">{attackerCountry?.name || battle.attackerOriginal?.owner}</span>
                        <span className="battle-history-casualties">
                          -{safeNum(battle.attackerCasualties)}
                        </span>
                      </div>

                      <div className="battle-history-vs">VS</div>

                      <div className="battle-history-army">
                        <span className="battle-history-flag">{defenderCountry?.flag}</span>
                        <span className="battle-history-name">{defenderCountry?.name || battle.defenderOriginal?.owner}</span>
                        <span className="battle-history-casualties">
                          -{safeNum(battle.defenderCasualties)}
                        </span>
                      </div>
                    </div>

                    <div className="battle-history-item-footer">
                      <span className={`battle-history-result ${playerWon ? 'victory' : 'defeat'}`}>
                        {playerWon ? '🏆 Vitória' : '💀 Derrota'}
                      </span>
                      <span className="battle-history-ratio">
                        Ratio: {safeRatio(battle.powerRatio)}:1
                        {retreatInfo?.retreated ? ` | 🏃 Recuo` : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};