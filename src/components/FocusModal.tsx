import React from 'react';
import type {
  CountryTechState,
  NationalFocus,
  FocusCategory,
} from '../types/technology';
import { NATIONAL_FOCUSES } from '../data/technology';
import { formatFocusEffect, getFocusBlockReason } from '../engine/technology';
import '../styles/tech-modal.css'; 

interface Props {
  techState: CountryTechState;
  onStartFocus: (id: string) => void;
  onCancelFocus: () => void;
  onClose: () => void;
}

export const FocusModal: React.FC<Props> = ({ techState, onStartFocus, onCancelFocus, onClose }) => {

    const categories: { id: FocusCategory; title: string; color: string }[] = [
        { id: 'MILITARY', title: '⚔️ MILITAR', color: '#ef4444' },
        { id: 'ECONOMY', title: '💰 ECONOMIA', color: '#22c55e' },
        { id: 'POLITICS', title: '👑 POLÍTICA', color: '#3b82f6' },
        { id: 'INDUSTRY', title: '🏭 INDÚSTRIA', color: '#f59e0b' },
        { id: 'DIPLOMACY', title: '🌐 DIPLOMACIA', color: '#06b6d4' },
        { id: 'RESEARCH', title: '🔬 PESQUISA', color: '#a855f7' },
    ];

    const renderCard = (focus: NationalFocus) => {
        const isActive = techState.activeFocusId === focus.id;
        const isDone = techState.completedFocuses.includes(focus.id);
        const progressDays = isActive ? techState.focusProgressDays : 0;
        const remaining = focus.durationDays - progressDays;
        const progress = (progressDays / focus.durationDays) * 100;
        const blockReason = getFocusBlockReason(techState, focus.id);
        const locked = blockReason !== null && !isDone && !isActive;

        return (
            <div key={focus.id} className={`tree-node research-node ${isDone ? 'completed' : ''} ${isActive ? 'active' : ''} ${locked ? 'locked' : ''}`}>
                <span className="tree-node-icon">{focus.icon}</span>
                <h4>{focus.title}</h4>
                <p className="tree-desc">{focus.description}</p>

                <div className="tree-reward">
                    {focus.rewardEffects.map(effect => <span key={`${effect.type}-${formatFocusEffect(effect)}`}>{formatFocusEffect(effect)}</span>)}
                </div>
                <div className="tree-prerequisites">
                    Pré-requisito: {(focus.prerequisites ?? []).length
                        ? focus.prerequisites!.map(id => NATIONAL_FOCUSES.find(item => item.id === id)?.title ?? id).join(', ')
                        : 'Nenhum'}
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
                    title={locked ? blockReason ?? undefined : undefined}
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
                    {categories.map(category => (
                        <div key={category.id} className="research-col" style={{ borderTopColor: category.color }}>
                            <h3>{category.title}</h3>
                            <div className="tree-column">{NATIONAL_FOCUSES.filter(focus => focus.category === category.id).map(renderCard)}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
