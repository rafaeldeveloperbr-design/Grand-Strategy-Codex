import React from 'react';
import { Country } from '../types';
import { CountryTechState } from '../types/technology';
import { TECHNOLOGIES } from '../data/technology';
import '../styles/tech-modal.css';

interface Props {
    playerCountry: Country;
    techState: CountryTechState;
    onStartResearch: (id: string) => void;
    onCancelResearch: () => void;
    onClose: () => void;
}

export const ResearchModal: React.FC<Props> = ({ playerCountry, techState, onStartResearch, onCancelResearch, onClose }) => {

    const canStart = (id: string) => {
        const t = TECHNOLOGIES.find(x => x.id === id);
        if (!t || t.researched) return false;
        if (techState.activeResearchId) return false;
        if (t.prerequisites.some(p => !techState.completedTechnologies.includes(p))) return false;
        return playerCountry.resources.gold >= t.costGold;
    };

    // CORES IGUAIS DO FOCO - PADRÃO HOI4
    const categories = [
        { id: 'MILITARY', name: 'MILITAR', icon: '⚔️', color: '#ef4444' },
        { id: 'ECONOMY', name: 'ECONOMIA', icon: '💰', color: '#22c55e' },
        { id: 'INFRASTRUCTURE', name: 'INFRA', icon: '🔧', color: '#3b82f6' },
    ] as const;

    return (
        <div className="tech-modal">
            <div className="tech-modal__overlay" onClick={onClose} />
            <div className="tech-modal__container tree-modal">
                <div className="tech-modal__header">
                    <h2>🔬 Pesquisas Tecnológicas</h2>
                    <button className="tech-modal__close" onClick={onClose}>×</button>
                </div>

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
                                    const progressDays = isActive ? techState.researchProgressDays : 0;
                                    const remaining = tech.durationDays - progressDays;
                                    const progress = (progressDays / tech.durationDays) * 100;

                                    return (
                                        <div key={tech.id} className="tree-node-wrapper">
                                            <div className={`tree-node research-node ${isDone ? 'completed' : ''} ${isActive ? 'active' : ''} ${!canStart(tech.id) && !isDone && !isActive ? 'locked' : ''}`}>
                                                <span className="tree-node-icon">{tech.icon}</span>
                                                <h4>{tech.title}</h4>
                                                <p className="tree-desc">{tech.description}</p>
                                                <div className="tree-cost">💰 {tech.costGold} | ⏱ {tech.durationDays}d</div>

                                                {!isDone && (
                                                    <div className="tree-progress-wrap">
                                                        <div className="tree-progress"><div style={{ width: `${isActive ? progress : 0}%` }} /></div>
                                                        <span className="tree-time">
                                                            {isActive ? `⏳ ${remaining} dias restantes` : `${tech.durationDays} dias`}
                                                        </span>
                                                    </div>
                                                )}

                                                <button
                                                    className={`tree-btn ${isActive ? 'cancel-btn' : ''}`}
                                                    disabled={!isActive && !canStart(tech.id)}
                                                    onClick={() => isActive ? onCancelResearch() : onStartResearch(tech.id)}
                                                >
                                                    {isDone ? '✓ Pesquisado' : isActive ? '✕ Cancelar' : 'Pesquisar'}
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