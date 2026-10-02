/**
 * ============================================================
 * MODAL DE HISTÓRICO DE NOTIFICAÇÕES
 * ============================================================
 * Exibe o histórico completo de avisos e notificações do jogo
 */

import React from 'react';
import { useToast } from '../context/ToastContext';

interface NotificationLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationLogModal: React.FC<NotificationLogModalProps> = ({ isOpen, onClose }) => {
  const { notificationHistory, clearHistory } = useToast();

  if (!isOpen) return null;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📢';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'var(--accent-green)';
      case 'error': return 'var(--accent-red)';
      case 'warning': return 'var(--accent-gold)';
      case 'info': return 'var(--accent-blue)';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div className="notification-modal-overlay" onClick={onClose}>
      <div className="notification-modal" onClick={(e) => e.stopPropagation()}>
        <div className="notification-modal__header">
          <h3>🔔 Histórico de Avisos</h3>
          <button className="notification-modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="notification-modal__body">
          {notificationHistory.length === 0 ? (
            <p className="notification-modal__empty">
              Nenhum aviso registrado até o momento.
            </p>
          ) : (
            <div className="notification-modal__list">
              {notificationHistory.map((item) => (
                <div 
                  key={item.id} 
                  className={`notification-modal__item notification-modal__item--${item.type}`}
                  style={{ borderLeftColor: getTypeColor(item.type) }}
                >
                  <div className="notification-modal__item-header">
                    <span className="notification-modal__item-icon">{getTypeIcon(item.type)}</span>
                    <strong className="notification-modal__item-title">{item.title}</strong>
                    {item.dateString && (
                      <small className="notification-modal__item-date">{item.dateString}</small>
                    )}
                  </div>
                  <p className="notification-modal__item-message">{item.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="notification-modal__footer">
          <button 
            className="notification-modal__btn notification-modal__btn--secondary"
            onClick={clearHistory}
            disabled={notificationHistory.length === 0}
          >
            🗑️ Limpar Histórico
          </button>
          <button 
            className="notification-modal__btn notification-modal__btn--primary"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
