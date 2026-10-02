/**
 * ============================================================
 * MODAL DE LOG DA IA
 * ============================================================
 * Exibe o histórico de atividades da IA
 */

import React, { useState } from 'react';
import { useAILog } from '../context/AILogContext';
import { AIActionType } from '../types/aiLog';

interface AILogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AILogModal: React.FC<AILogModalProps> = ({ isOpen, onClose }) => {
  const { aiLogs, clearAILogs } = useAILog();
  const [filter, setFilter] = useState<AIActionType | 'all'>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');

  if (!isOpen) return null;

  // Obter países únicos
  const uniqueCountries = Array.from(new Set(aiLogs.map(log => log.countryName)));

  // Filtrar logs
  const filteredLogs = aiLogs.filter(log => {
    const matchesAction = filter === 'all' || log.actionType === filter;
    const matchesCountry = countryFilter === 'all' || log.countryName === countryFilter;
    return matchesAction && matchesCountry;
  });

  const getActionIcon = (type: AIActionType) => {
    switch (type) {
      case 'building': return '🏗️';
      case 'military': return '⚔️';
      case 'tech': return '🔬';
      case 'focus': return '🎯';
      case 'diplomacy': return '🤝';
      default: return '📋';
    }
  };

  const getActionLabel = (type: AIActionType) => {
    switch (type) {
      case 'building': return 'Construção';
      case 'military': return 'Militar';
      case 'tech': return 'Tecnologia';
      case 'focus': return 'Foco';
      case 'diplomacy': return 'Diplomacia';
      default: return 'Outro';
    }
  };

  const getActionColor = (type: AIActionType) => {
    switch (type) {
      case 'building': return 'var(--accent-gold)';
      case 'military': return 'var(--accent-red)';
      case 'tech': return 'var(--accent-blue)';
      case 'focus': return 'var(--accent-green)';
      case 'diplomacy': return 'var(--accent-purple, #9b59b6)';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div className="ai-log-modal-overlay" onClick={onClose}>
      <div className="ai-log-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-log-modal__header">
          <h3>🤖 Log de Atividades da IA</h3>
          <button className="ai-log-modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="ai-log-modal__filters">
          <div className="ai-log-modal__filter-group">
            <label>Tipo:</label>
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value as AIActionType | 'all')}
              className="ai-log-modal__select"
            >
              <option value="all">Todos</option>
              <option value="building">🏗️ Construção</option>
              <option value="military">⚔️ Militar</option>
              <option value="tech">🔬 Tecnologia</option>
              <option value="focus">🎯 Foco</option>
              <option value="diplomacy">🤝 Diplomacia</option>
            </select>
          </div>

          <div className="ai-log-modal__filter-group">
            <label>País:</label>
            <select 
              value={countryFilter} 
              onChange={(e) => setCountryFilter(e.target.value)}
              className="ai-log-modal__select"
            >
              <option value="all">Todos</option>
              {uniqueCountries.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="ai-log-modal__body">
          {filteredLogs.length === 0 ? (
            <p className="ai-log-modal__empty">
              Nenhuma atividade da IA registrada ainda.
            </p>
          ) : (
            <div className="ai-log-modal__list">
              {filteredLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="ai-log-modal__item"
                  style={{ borderLeftColor: getActionColor(log.actionType) }}
                >
                  <div className="ai-log-modal__item-header">
                    <span className="ai-log-modal__item-icon">{getActionIcon(log.actionType)}</span>
                    <strong 
                      className="ai-log-modal__item-country"
                      style={{ color: log.countryColor || 'var(--text-primary)' }}
                    >
                      {log.countryName}
                    </strong>
                    <span className="ai-log-modal__item-type">
                      {getActionLabel(log.actionType)}
                    </span>
                    <small className="ai-log-modal__item-date">{log.dateString}</small>
                  </div>
                  <p className="ai-log-modal__item-message">{log.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ai-log-modal__footer">
          <span className="ai-log-modal__count">
            {filteredLogs.length} de {aiLogs.length} atividades
          </span>
          <button 
            className="ai-log-modal__btn ai-log-modal__btn--secondary"
            onClick={clearAILogs}
            disabled={aiLogs.length === 0}
          >
            🗑️ Limpar Log
          </button>
          <button 
            className="ai-log-modal__btn ai-log-modal__btn--primary"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
