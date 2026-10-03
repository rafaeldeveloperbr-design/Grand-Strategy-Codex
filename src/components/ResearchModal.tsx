import React from 'react';
import type { Country } from '../types';
import type { CountryTechState, TechnologyCategory } from '../types/technology';
import { TECHNOLOGIES } from '../data/technology';
import { canResearchTechnology, formatTechnologyEffect } from '../engine/technology';
import '../styles/tech-modal.css';

interface Props { playerCountry: Country; techState: CountryTechState; onStartResearch: (id: string) => void; onCancelResearch: () => void; onClose: () => void }
const CATEGORIES: Array<{ id: TechnologyCategory; name: string; icon: string; color: string }> = [
  { id: 'AGRICULTURE', name: 'AGRICULTURA', icon: '🌾', color: '#84cc16' },
  { id: 'INDUSTRY', name: 'INDÚSTRIA', icon: '⚙️', color: '#f59e0b' },
  { id: 'INFRASTRUCTURE', name: 'INFRAESTRUTURA', icon: '🏗️', color: '#3b82f6' },
  { id: 'MILITARY', name: 'MILITAR', icon: '⚔️', color: '#ef4444' },
];
export const ResearchModal: React.FC<Props> = ({ playerCountry, techState, onStartResearch, onCancelResearch, onClose }) => (
  <div className="tech-modal">
    <div className="tech-modal__overlay" onClick={onClose} />
    <div className="tech-modal__container tree-modal">
      <div className="tech-modal__header"><h2>🔬 Pesquisas · {(techState.researchSpeed ?? 1).toFixed(2)} pts/dia</h2><button className="tech-modal__close" onClick={onClose}>×</button></div>
      <div className="research-columns">
        {CATEGORIES.map(category => <div key={category.id} className="research-col" style={{ borderTopColor: category.color }}>
          <h3 style={{ color: category.color }}>{category.icon} {category.name}</h3>
          <div className="tree-column">{TECHNOLOGIES.filter(technology => technology.category === category.id).map(technology => {
            const active = techState.activeResearchId === technology.id;
            const done = techState.completedTechnologies.includes(technology.id);
            const available = canResearchTechnology(techState, technology.id) && playerCountry.resources.gold >= technology.goldCost;
            const progress = active ? Math.min(100, techState.researchProgressDays / technology.researchCost * 100) : 0;
            const missing = technology.prerequisites.filter(id => !techState.completedTechnologies.includes(id));
            return <div key={technology.id} className={`tree-node research-node ${done ? 'completed' : ''} ${active ? 'active' : ''} ${!available && !done && !active ? 'locked' : ''}`}>
              <span className="tree-node-icon">{technology.icon}</span><h4>{technology.name}</h4><p className="tree-desc">{technology.description}</p>
              {technology.effects.map((effect, index) => <p className="tree-desc" key={index}>{formatTechnologyEffect(effect)}</p>)}
              <div className="tree-cost">💰 {technology.goldCost} | 🔬 {technology.researchCost} pts</div>
              <p className="tree-desc">Pré-requisitos: {technology.prerequisites.length ? technology.prerequisites.map(id => TECHNOLOGIES.find(item => item.id === id)?.name ?? id).join(', ') : 'nenhum'}</p>
              {missing.length > 0 && <p className="tree-desc">🔒 Bloqueada</p>}
              {!done && <div className="tree-progress-wrap"><div className="tree-progress"><div style={{ width: `${progress}%` }} /></div><span className="tree-time">{active ? `${techState.researchProgressDays.toFixed(1)} / ${technology.researchCost}` : available ? 'Disponível' : 'Bloqueada'}</span></div>}
              <button className={`tree-btn ${active ? 'cancel-btn' : ''}`} disabled={done || (!active && !available)} onClick={() => active ? onCancelResearch() : onStartResearch(technology.id)}>{done ? '✓ Concluída' : active ? '✕ Cancelar' : 'Pesquisar'}</button>
            </div>;
          })}</div>
        </div>)}
      </div>
    </div>
  </div>
);
