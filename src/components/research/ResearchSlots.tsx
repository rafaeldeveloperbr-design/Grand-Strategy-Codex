import React from 'react';
import type { CountryTechState } from '../../types/technology';
import { TECHNOLOGIES } from '../../data/technology';
import { MAX_RESEARCH_SLOTS } from '../../constants/research';
import { getResearchProgress } from '../../engine/technology';

export function ResearchSlots({state}: {state: CountryTechState}) {
  return <section className="research-slots" aria-label="Slots de pesquisa">
    {Array.from({length: MAX_RESEARCH_SLOTS}, (_,id) => {
      const slot = state.researchSlots.find(item => item.id === id);
      const technology = TECHNOLOGIES.find(item => item.id === slot?.technologyId);
      const progress = getResearchProgress(state,id);
      return <div key={id} className={`research-slot research-slot--${!slot ? 'locked' : technology ? 'active' : 'empty'}`} role="status" aria-label={`Slot ${id+1}`}>
        <strong>Slot {id+1}</strong>
        <span>{!slot ? '🔒 Bloqueado' : technology ? `${technology.title} — ${Math.round(progress?.percent ?? 0)}%` : 'Disponível'}</span>
        {progress && <span className="research-slot__progress" role="progressbar" aria-label={`Progresso do Slot ${id+1}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.percent)}><span style={{width:`${progress.percent}%`}} /></span>}
      </div>;
    })}
  </section>;
}
