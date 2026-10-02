/**
 * ============================================================
 * MODAL DE GOVERNO E LEIS
 * ============================================================
 */

import React from 'react';
import { Country } from '../types';
import { LawCategory, ActiveLaws } from '../types/government';
import { LAWS, LAWS_BY_CATEGORY } from '../constants/laws';

interface GovernmentModalProps {
  playerCountry: Country;
  onEnactLaw: (category: LawCategory, lawId: string) => void;
  onClose: () => void;
}

const CATEGORY_INFO: Record<LawCategory, { icon: string; name: string; description: string }> = {
  conscription: {
    icon: '🎖️',
    name: 'Recrutamento',
    description: 'Políticas de recrutamento militar',
  },
  taxation: {
    icon: '💰',
    name: 'Tributação',
    description: 'Sistema de impostos e arrecadação',
  },
  governance: {
    icon: '🏛️',
    name: 'Governança',
    description: 'Estrutura administrativa do estado',
  },
  economy: {
    icon: '🏭',
    name: 'Economia de Guerra',
    description: 'Mobilização industrial e produção',
  },
  intelligence: {
    icon: '🕵️',
    name: 'Inteligência',
    description: 'Pesquisa, focos e espionagem',
  },
};

export const GovernmentModal: React.FC<GovernmentModalProps> = ({
  playerCountry,
  onEnactLaw,
  onClose,
}) => {
  const activeLaws: ActiveLaws = playerCountry.activeLaws || {
    conscription: 'conscription_peacetime',
    taxation: 'taxation_normal',
    governance: 'governance_balanced',
    economy: 'economy_civilian',
    intelligence: 'intel_disorganized',
  };

  const renderBonuses = (law: typeof LAWS[string]) => {
    const bonuses: string[] = [];
    const fmt = (v: number) => {
      const p = ((v - 1) * 100).toFixed(0);
      return `${Number(p) > 0? '+' : ''}${p}%`;
    };

    if (law.bonuses.goldMultiplier!== undefined) bonuses.push(`💰 Ouro: ${fmt(law.bonuses.goldMultiplier)}`);
    if (law.bonuses.manpowerMultiplier!== undefined) bonuses.push(`👥 Manpower: ${fmt(law.bonuses.manpowerMultiplier)}`);
    if (law.bonuses.popGrowthMultiplier!== undefined) bonuses.push(`📈 População: ${fmt(law.bonuses.popGrowthMultiplier)}`);
    if (law.bonuses.buildTimeMultiplier!== undefined) bonuses.push(`🏗️ Construção: ${fmt(law.bonuses.buildTimeMultiplier)}`);
    if (law.bonuses.armyCostMultiplier!== undefined) bonuses.push(`⚔️ Custo Exército: ${fmt(law.bonuses.armyCostMultiplier)}`);

    // NOVOS
    if (law.bonuses.civilianBuildTimeMultiplier!== undefined) bonuses.push(`🏠 Civil: ${fmt(law.bonuses.civilianBuildTimeMultiplier)}`);
    if (law.bonuses.militaryFactoryCostMultiplier!== undefined) bonuses.push(`🏭 Fab. Militar: ${fmt(law.bonuses.militaryFactoryCostMultiplier)}`);
    if (law.bonuses.researchSpeedMultiplier!== undefined) bonuses.push(`🔬 Pesquisa: ${fmt(law.bonuses.researchSpeedMultiplier)}`);
    if (law.bonuses.focusTimeMultiplier!== undefined) bonuses.push(`🎯 Focos: ${fmt(law.bonuses.focusTimeMultiplier)}`);

    return bonuses;
  };

  return (
    <div className="government-modal-overlay" onClick={onClose}>
      <div className="government-modal" onClick={(e) => e.stopPropagation()}>
        <div className="government-modal__header">
          <h2>🏛️ Governo e Leis</h2>
          <button className="government-modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="government-modal__content">
          {(Object.keys(CATEGORY_INFO) as LawCategory[]).map((category) => {
            const categoryInfo = CATEGORY_INFO[category];
            const lawIds = LAWS_BY_CATEGORY[category];
            const activeLawId = activeLaws[category];

            return (
              <div key={category} className="government-modal__category">
                <div className="government-modal__category-header">
                  <span className="government-modal__category-icon">{categoryInfo.icon}</span>
                  <div>
                    <h3>{categoryInfo.name}</h3>
                    <p>{categoryInfo.description}</p>
                  </div>
                </div>

                <div className="government-modal__laws">
                  {lawIds.map((lawId) => {
                    const law = LAWS[lawId];
                    const isActive = lawId === activeLawId;
                    const canAfford = playerCountry.resources.gold >= law.costGold;
                    const bonuses = renderBonuses(law);

                    return (
                      <div
                        key={lawId}
                        className={`government-modal__law-card ${isActive? 'active' : ''}`}
                      >
                        <div className="government-modal__law-header">
                          <h4>{law.name}</h4>
                          {isActive && <span className="government-modal__law-badge">ATIVA</span>}
                        </div>

                        <p className="government-modal__law-description">{law.description}</p>

                        {bonuses.length > 0 && (
                          <div className="government-modal__law-bonuses">
                            {bonuses.map((bonus, idx) => (
                              <span key={idx} className="government-modal__law-bonus">
                                {bonus}
                              </span>
                            ))}
                          </div>
                        )}

                        {!isActive && (
                          <div className="government-modal__law-footer">
                            <span className="government-modal__law-cost">
                              💰 {law.costGold.toLocaleString()} ouro
                            </span>
                            <button
                              className="government-modal__law-button"
                              disabled={!canAfford}
                              onClick={() => onEnactLaw(category, lawId)}
                            >
                              {canAfford? 'Promulgar Lei' : 'Ouro Insuficiente'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};