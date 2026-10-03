import React from 'react';
import { Country } from '../types';
import { CountryTechState } from '../types/technology';
import { TECHNOLOGIES } from '../data/technology';
import { formatTechnologyEffect, getActiveTechnologyModifierEntries, getResearchProgress } from '../engine/technology';
import '../styles/tech-modal.css';

interface Props {
    playerCountry: Country;
    techState: CountryTechState;
    onStartResearch: (id: string) => void;
    onCancelResearch: () => void;
    onClose: () => void;
}

export const ResearchModal: React.FC<Props> = ({ playerCountry, techState, onStartResearch, onCancelResearch, onClose }) => {
    const activeModifiers = getActiveTechnologyModifierEntries(techState);
    const activeProgress = getResearchProgress(techState);

    const canStart = (id: string) => {
        const t = TECHNOLOGIES.find(x => x.id === id);
        if (!t || techState.completedTechnologies.includes(id)) return false;
        if (techState.activeResearchId) return false;
        if (t.prerequisites.some(p => !techState.completedTechnologies.includes(p))) return false;
        return playerCountry.resources.gold >= t.costGold;
    };

    // CORES IGUAIS DO FOCO - PADRÃO HOI4
    const categories = [
        { id: 'MILITARY', name: 'MILITAR', icon: '⚔️', color: '#ef4444' },
        { id: 'ECONOMY', name: 'ECONOMIA', icon: '💰', color: '#22c55e' },
        { id: 'SOCIETY', name: 'SOCIEDADE', icon: '🏛️', color: '#3b82f6' },
    ] as const;

    return (
        <div className="tech-modal">
            <div className="tech-modal__overlay" onClick={onClose} />
            <div className="tech-modal__container tree-modal">
                <div className="tech-modal__header">
                    <h2>🔬 Pesquisas Tecnológicas</h2>
                    <button className="tech-modal__close" onClick={onClose}>×</button>
                </div>

                {activeModifiers.length > 0 && (
                    <section className="technology-modifiers" aria-label="Modificadores tecnológicos ativos">
                        <h3>Modificadores tecnológicos ativos</h3>
                        <div className="technology-modifiers__grid">
                            {activeModifiers.map(modifier => (
                                <span key={modifier.label}>{modifier.label}: <strong>{modifier.percent > 0 ? '+' : ''}{modifier.percent}%</strong></span>
                            ))}
                        </div>
                    </section>
                )}

                <div className="research-columns">
                    {categories.map(cat => (
                        <div
                            key={cat.id}
                            className="research-col"
                            style={{
                                borderTopColor: cat.color,
                                boxShadow: `0 -2px 12px ${cat.color}40`
                            }}
                        >
                            <h3 style={{ color: cat.color }}>
                                <span>{cat.icon}</span> {cat.name}
                            </h3>
                            <div className="tree-column">
                                {TECHNOLOGIES.filter(t => t.category === cat.id).map(tech => {
                                    const isActive = techState.activeResearchId === tech.id;
                                    const isDone = techState.completedTechnologies.includes(tech.id);
                                    const progress = isActive ? activeProgress : null;
                                    const prerequisites = tech.prerequisites.map(id => ({
                                        title: TECHNOLOGIES.find(item => item.id === id)?.title ?? id,
                                        completed: techState.completedTechnologies.includes(id),
                                    }));

                                    return (
                                        <div key={tech.id} className="tree-node-wrapper">
                                            <div className={`tree-node research-node ${isDone ? 'completed' : ''} ${isActive ? 'active' : ''} ${!canStart(tech.id) && !isDone && !isActive ? 'locked' : ''}`}>
                                                <span className="tree-node-icon">{tech.icon}</span>
                                                <h4>{tech.title}</h4>
                                                <div className="tree-category">{cat.name}</div>
                                                <p className="tree-desc">{tech.description}</p>
                                                <div className="tree-cost">💰 {tech.costGold} | ⏱ {tech.durationDays}d</div>
                                                <div className="tree-effects">{tech.effects.map(effect => <div key={`${effect.type}-${'good' in effect ? effect.good : ''}`}>⚙️ {formatTechnologyEffect(effect)}</div>)}</div>
                                                {prerequisites.length > 0 && <div className="tree-prerequisites"><strong>Requer:</strong>{prerequisites.map(item => <div key={item.title} className={item.completed ? 'completed' : 'missing'}>{item.completed ? '✓' : '✗'} {item.title}</div>)}</div>}

                                                {!isDone && (
                                                    <div className="tree-progress-wrap">
                                                        <div className="tree-progress"><div style={{ width: `${progress?.percent ?? 0}%` }} /></div>
                                                        <span className="tree-time">
                                                            {progress ? `Pesquisa: ${progress.current.toFixed(1)} / ${progress.required} dias (${Math.floor(progress.percent)}%) • ~${progress.estimatedDaysRemaining} dias restantes` : `${tech.durationDays} dias`}
                                                        </span>
                                                    </div>
                                                )}

                                                <button
                                                    className={`tree-btn ${isActive ? 'cancel-btn' : ''}`}
                                                    disabled={!isActive && !canStart(tech.id)}
                                                    onClick={() => isActive ? onCancelResearch() : onStartResearch(tech.id)}
                                                >
                                                    {isDone ? '✅ Concluída' : isActive ? '⏳ Pesquisando' : canStart(tech.id) ? '🔬 Disponível' : '🔒 Bloqueada'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
