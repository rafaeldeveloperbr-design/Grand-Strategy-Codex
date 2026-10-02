import React from 'react';
import type {
  CountryTechState,
  NationalFocus,
} from '../types/technology';
import { NATIONAL_FOCUSES } from '../data/technology';
import '../styles/tech-modal.css'; 

interface Props {
  techState: CountryTechState;
  onStartFocus: (id: string) => void;
  onCancelFocus: () => void;
  onClose: () => void;
}

export const FocusModal: React.FC<Props> = ({ techState, onStartFocus, onCancelFocus, onClose }) => {

    const canStart = (id: string) => {
        const f = NATIONAL_FOCUSES.find(x => x.id === id);
        if (!f) return false;
        if (techState.completedFocuses.includes(f.id)) return false;
        if (techState.activeFocusId) return false;
        return f.prerequisites?.every(p => techState.completedFocuses.includes(p)) ?? true;
    };

    // SEPARA EM 3 COLUNAS - IGUAL PESQUISA
    const getColumn = (
  focus: NationalFocus
): 'military' | 'economy' | 'political' =>{
        const t = focus.title.toLowerCase();
        if (t.includes('militar') || t.includes('cavalaria') || t.includes('exército') || t.includes('exercito') || t.includes('fortificação') || t.includes('fortificacao') || t.includes('fronteira')) {
            return 'military';
        }
        if (t.includes('econô') || t.includes('econom') || t.includes('agrária') || t.includes('agraria') || t.includes('industrial') || t.includes('comercial') || t.includes('comercio')) {
            return 'economy';
        }
        return 'political';
    };

    const columns = {
        military: NATIONAL_FOCUSES.filter(f => getColumn(f) === 'military'),
        economy: NATIONAL_FOCUSES.filter(f => getColumn(f) === 'economy'),
        political: NATIONAL_FOCUSES.filter(f => getColumn(f) === 'political'),
    };

    const renderCard = (focus: NationalFocus) => {
        const isActive = techState.activeFocusId === focus.id;
        const isDone = techState.completedFocuses.includes(focus.id);
        const progressDays = isActive ? techState.focusProgressDays : 0;
        const remaining = focus.durationDays - progressDays;
        const progress = (progressDays / focus.durationDays) * 100;
        const locked = !canStart(focus.id) && !isDone && !isActive;

        return (
            <div key={focus.id} className={`tree-node research-node ${isDone ? 'completed' : ''} ${isActive ? 'active' : ''} ${locked ? 'locked' : ''}`}>
                <span className="tree-node-icon">{focus.icon}</span>
                <h4>{focus.title}</h4>
                <p className="tree-desc">{focus.description}</p>

                <div className="tree-reward">
                    {focus.rewardEffect.type === 'COMBAT_POWER' && `+${(focus.rewardEffect.value * 100).toFixed(0)}% ${focus.rewardEffect.unitType}`}
                    {focus.rewardEffect.type === 'GOLD_INCOME' && `+${(focus.rewardEffect.value * 100).toFixed(0)}% ouro`}
                    {focus.rewardEffect.type === 'MANPOWER' && `+${(focus.rewardEffect.value * 100).toFixed(0)}% manpower`}
                    {focus.rewardEffect.type === 'DEFENSE_BONUS' && `+${(focus.rewardEffect.value * 100).toFixed(0)}% defesa`}
                </div>

                {!isDone && (
                    <div className="tree-progress-wrap">
                        <div className="tree-progress"><div style={{ width: `${progress}%` }} /></div>
                        <span className="tree-time">
                            {isActive ? `⏳ ${remaining}d restantes (${progressDays}/${focus.durationDays})` : `${focus.durationDays} dias`}
                        </span>
                    </div>
                )}

                <button
                    className={`tree-btn ${isActive ? 'cancel-btn' : ''}`}
                    disabled={locked || isDone}
                    onClick={() => isActive ? onCancelFocus() : onStartFocus(focus.id)}
                >
                    {isDone ? '✓ Concluído' : isActive ? '✕ Cancelar' : 'Iniciar Foco'}
                </button>
            </div>
        );
    };

    return (
        <div className="tech-modal">
            <div className="tech-modal__overlay" onClick={onClose} />
            <div className="tech-modal__container tree-modal">
                <div className="tech-modal__header">
                    <h2>🎯 Focos Nacionais</h2>
                    <button className="tech-modal__close" onClick={onClose}>×</button>
                </div>

                <div className="research-columns focus-columns">
                    <div className="research-col" style={{ borderTopColor: '#ef4444' }}>
                        <h3>⚔️ MILITAR</h3>
                        <div className="tree-column">{columns.military.map(renderCard)}</div>
                    </div>

                    <div className="research-col" style={{ borderTopColor: '#22c55e' }}>
                        <h3>💰 ECONOMIA</h3>
                        <div className="tree-column">{columns.economy.map(renderCard)}</div>
                    </div>

                    <div className="research-col" style={{ borderTopColor: '#3b82f6' }}>
                        <h3>👑 POLÍTICA</h3>
                        <div className="tree-column">{columns.political.map(renderCard)}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};