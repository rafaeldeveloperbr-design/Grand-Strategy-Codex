import React, { useState } from 'react';
import { AIDifficulty } from '../types/difficulty';
import { DifficultySelector } from './DifficultySelector';
import type { SaveMeta } from '../engine/saveSystem';

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function formatGameDatePt(day: number, month: number, year: number){
  const mes = MESES_PT[(month-1)] || `Mês ${month}`;
  return `${day} de ${mes}, ${year}`;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiDifficulty: AIDifficulty;
  onDifficultyChange: (difficulty: AIDifficulty) => void;
  saves: SaveMeta[];
  autoSaveEnabled: boolean;
  onToggleAutoSave: (v: boolean) => void;
  onSaveNew: (name: string) => void;
  onLoad: (slotId: string) => void;
  onDelete: (slotId: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  const [newName, setNewName] = useState('');
  if (!props.isOpen) return null;

  const formatTs = (ts: number) => new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const handleCreate = () => {
    const name = newName.trim() || `Império - ${new Date().toLocaleTimeString('pt-BR')}`;
    props.onSaveNew(name);
    setNewName('');
  };

  const getDate = (s: SaveMeta) => s.date || { day: s.day!, month: s.month!, year: s.year! };
  const getTs = (s: SaveMeta) => s.timestamp ?? s.ts ?? Date.now();

  return (
    <div className="settings-modal-overlay" onClick={props.onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-modal__header">
          <h2>⚙️ Configurações</h2>
          <button className="settings-modal__close" onClick={props.onClose}>✕</button>
        </div>

        <div className="settings-modal__content">
          <DifficultySelector currentDifficulty={props.aiDifficulty} onDifficultyChange={props.onDifficultyChange} />

          <div className="settings-modal__section">
            <h3>💾 Salvamento</h3>
            <div className="settings-modal__save-create">
              <input 
                className="settings-modal__input"
                placeholder="Nome do save... ex: Antes da guerra"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
              <button className="settings-modal__btn settings-modal__btn--primary" onClick={handleCreate}>
                + Salvar
              </button>
            </div>

            <label className="settings-modal__toggle" style={{margin: '12px 0'}}>
              <input type="checkbox" checked={props.autoSaveEnabled} onChange={e => props.onToggleAutoSave(e.target.checked)} />
              <span>Autosave (dia 1)</span>
            </label>

            <div className="settings-modal__save-list">
              <h4>Seus Saves ({props.saves.length})</h4>
              {props.saves.length === 0 && <p className="settings-modal__empty">Nenhum save ainda.</p>}
              {props.saves.map(s => {
                const d = getDate(s);
                return (
                  <div key={s.id} className="settings-modal__save-item">
                    <div className="settings-modal__save-info">
                      <strong>{s.id === 'autosave' ? '🔄 Autosave' : `💾 ${s.name}`}</strong>
                      <span>{formatGameDatePt(d.day, d.month, d.year)} | {formatTs(getTs(s))}</span>
                    </div>
                    <div className="settings-modal__save-btns">
                      <button className="settings-modal__btn--small" onClick={() => props.onLoad(s.id)}>📂 Carregar</button>
                      <button className="settings-modal__btn--small settings-modal__btn--danger" onClick={() => props.onDelete(s.id)}>🗑️</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="settings-modal__section settings-modal__danger-zone">
            <h4>Começar Novo Jogo</h4>
            <p className="settings-modal__hint">Reiniciar começa um novo jogo sem apagar seus saves manuais. Seus saves continuam aqui.</p>
            <button className="settings-modal__btn settings-modal__btn--danger" onClick={() => {
              if(confirm('Começar novo jogo? Seus saves manuais NÃO serão apagados, apenas o autosave será ignorado.')) {
                window.location.href = window.location.pathname + '?newgame=1';
              }
            }}>
              🔄 Novo Jogo
            </button>
          </div>
        </div>

        <div className="settings-modal__footer">
          <button className="settings-modal__btn" onClick={props.onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
};