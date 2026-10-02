/**
 * ============================================================
 * MÓDULO 4 - Painel de Diplomacia
 * ============================================================
 * Exibe relações diplomáticas e permite ações diplomáticas
 */

import React from 'react';
import { Country } from '../types';
import { DiplomaticRelation, War } from '../types/diplomacy';
import { DIPLOMATIC_COSTS } from '../engine/diplomacy';

interface DiplomacyPanelProps {
  targetCountry: Country;
  playerCountry: Country;
  relation: DiplomaticRelation | null;
  onClose: () => void;
  onImproveRelations: () => void;
  onOfferNonAggression: () => void;
  onDeclareWar: () => void;
}

/**
 * Painel de diplomacia com um país específico
 */
export const DiplomacyPanel: React.FC<DiplomacyPanelProps> = ({
  targetCountry,
  playerCountry,
  relation,
  onClose,
  onImproveRelations,
  onOfferNonAggression,
  onDeclareWar
}) => {
  const opinion = relation?.opinion ?? 0;
  const status = relation?.status ?? 'peace';
  const pactDays = relation?.pactDaysRemaining ?? 0;

  const getOpinionColor = (op: number): string => {
    if (op >= 50) return '#2ecc71';
    if (op >= 0) return '#f39c12';
    if (op >= -50) return '#e67e22';
    return '#e74c3c';
  };

  const getOpinionLabel = (op: number): string => {
    if (op >= 80) return 'Aliado';
    if (op >= 50) return 'Amigável';
    if (op >= 20) return 'Neutro';
    if (op >= -20) return 'Desconfiado';
    if (op >= -50) return 'Hostil';
    return 'Inimigo';
  };

  const getStatusIcon = (s: string): string => {
    switch (s) {
      case 'war': return '⚔️';
      case 'non_aggression_pact': return '🤝';
      default: return '🕊️';
    }
  };

  const canImproveRelations = playerCountry.resources.gold >= DIPLOMATIC_COSTS.improve_relations.gold && status !== 'war';
  const canOfferPact = playerCountry.resources.gold >= DIPLOMATIC_COSTS.offer_non_aggression.gold && status === 'peace';
  const canDeclareWar = status !== 'war' && pactDays <= 0;

  return (
    <div className="diplomacy-panel">
      {/* Cabeçalho */}
      <div className="diplomacy-panel__header">
        <div className="diplomacy-panel__country-info">
          <span className="diplomacy-panel__flag">{targetCountry.flag}</span>
          <div>
            <h2 className="diplomacy-panel__name">{targetCountry.name}</h2>
            <span className="diplomacy-panel__tag">[{targetCountry.tag}]</span>
          </div>
        </div>
        <button className="diplomacy-panel__close" onClick={onClose}>✕</button>
      </div>

      {/* Status da Relação */}
      <div className="diplomacy-panel__section">
        <h3 className="diplomacy-panel__subtitle">Relação Diplomática</h3>
        
        <div className="diplomacy-panel__status-row">
          <span className="diplomacy-panel__status-icon">{getStatusIcon(status)}</span>
          <span className="diplomacy-panel__status-text">
            {status === 'war' ? 'Em Guerra' : status === 'non_aggression_pact' ? 'Pacto de Não Agressão' : 'Em Paz'}
          </span>
          {status === 'non_aggression_pact' && pactDays > 0 && (
            <span className="diplomacy-panel__pact-days">{pactDays} dias restantes</span>
          )}
        </div>

        {/* Barra de Opinião */}
        <div className="diplomacy-panel__opinion-section">
          <div className="diplomacy-panel__opinion-header">
            <span className="diplomacy-panel__opinion-label">Opinião:</span>
            <span className="diplomacy-panel__opinion-value" style={{ color: getOpinionColor(opinion) }}>
              {opinion > 0 ? '+' : ''}{opinion}
            </span>
          </div>
          <div className="diplomacy-panel__opinion-bar">
            <div 
              className="diplomacy-panel__opinion-fill"
              style={{ 
                width: `${(opinion + 100) / 2}%`,
                backgroundColor: getOpinionColor(opinion)
              }}
            />
            <div className="diplomacy-panel__opinion-marker" style={{ left: '50%' }} />
          </div>
          <span className="diplomacy-panel__opinion-label-text" style={{ color: getOpinionColor(opinion) }}>
            {getOpinionLabel(opinion)}
          </span>
        </div>
      </div>

      {/* Ações Diplomáticas */}
      <div className="diplomacy-panel__section">
        <h3 className="diplomacy-panel__subtitle">Ações Diplomáticas</h3>
        
        <div className="diplomacy-panel__actions">
          {/* Melhorar Relações */}
          <button
            className="diplomacy-panel__action-btn"
            disabled={!canImproveRelations}
            onClick={onImproveRelations}
            title={status === 'war' ? 'Não pode melhorar relações durante a guerra' : ''}
          >
            <div className="diplomacy-panel__action-icon">💰</div>
            <div className="diplomacy-panel__action-info">
              <span className="diplomacy-panel__action-name">Melhorar Relações</span>
              <span className="diplomacy-panel__action-cost">
                Custo: {DIPLOMATIC_COSTS.improve_relations.gold} ouro
              </span>
              <span className="diplomacy-panel__action-effect">
                +{DIPLOMATIC_COSTS.improve_relations.opinionChange} opinião
              </span>
            </div>
          </button>

          {/* Pacto de Não Agressão */}
          <button
            className="diplomacy-panel__action-btn"
            disabled={!canOfferPact}
            onClick={onOfferNonAggression}
            title={status !== 'peace' ? 'Só pode oferecer em tempo de paz' : ''}
          >
            <div className="diplomacy-panel__action-icon">🤝</div>
            <div className="diplomacy-panel__action-info">
              <span className="diplomacy-panel__action-name">Pacto de Não Agressão</span>
              <span className="diplomacy-panel__action-cost">
                Custo: {DIPLOMATIC_COSTS.offer_non_aggression.gold} ouro
              </span>
              <span className="diplomacy-panel__action-effect">
                +{DIPLOMATIC_COSTS.offer_non_aggression.opinionChange} opinião, 1 ano de paz
              </span>
            </div>
          </button>

          {/* Declarar Guerra */}
          <button
            className="diplomacy-panel__action-btn diplomacy-panel__action-btn--war"
            disabled={!canDeclareWar}
            onClick={onDeclareWar}
            title={pactDays > 0 ? 'Pacto de não agressão ativo' : status === 'war' ? 'Já em guerra' : ''}
          >
            <div className="diplomacy-panel__action-icon">⚔️</div>
            <div className="diplomacy-panel__action-info">
              <span className="diplomacy-panel__action-name">Declarar Guerra</span>
              <span className="diplomacy-panel__action-effect">
                Inimigos automáticos, pode conquistar território
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
