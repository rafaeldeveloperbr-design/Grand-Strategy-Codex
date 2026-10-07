import React, { useEffect, useRef } from 'react';
import type { Country } from '../../types';
import type { CountryTechState, Technology } from '../../types/technology';
import { TECHNOLOGIES } from '../../data/technology';
import { calculateTechBonuses, formatTechnologyEffect, getResearchProgress, getTechnologyBlockReason } from '../../engine/technology';
import { RESEARCH_CATEGORIES, getResearchNodeStatus, STATUS_LABELS } from './presentation';

interface Props {
  research: Technology;
  country: Country;
  state: CountryTechState;
  id: string;
  pinned: boolean;
  position: {left:number;top:number};
  onEnter: () => void;
  onLeave: () => void;
  onDismiss: () => void;
  onStart: () => void;
  onCancel: () => void;
}
export function ResearchTooltip({research,country,state,id,pinned,position,onEnter,onLeave,onDismiss,onStart,onCancel}: Props) {
  const actionRef = useRef<HTMLButtonElement>(null);
  const reason = getTechnologyBlockReason(state,research.id,country);
  const status = getResearchNodeStatus(research,state,reason);
  const category = RESEARCH_CATEGORIES[research.category];
  const progress = status === 'active' ? getResearchProgress(state) : null;
  const speed = calculateTechBonuses(state).researchSpeedMultiplier;
  useEffect(() => { if (pinned) actionRef.current?.focus(); },[pinned,research.id,status]);
  return (
    <section id={id} role="dialog" aria-label={`Detalhes de ${research.title}`} className="research-tooltip" style={{left:position.left,top:position.top,'--research-color':category.color} as React.CSSProperties}
      onMouseEnter={onEnter} onMouseLeave={onLeave} onFocus={onEnter} onBlur={onLeave}>
      <div className="research-tooltip__heading"><span aria-hidden="true">{research.icon}</span><h3>{research.title}</h3><button type="button" aria-label="Fechar detalhes" onClick={onDismiss}>×</button></div>
      <p className="research-tooltip__category">{category.label}</p>
      <p>{research.description}</p>
      <dl><div><dt>Custo</dt><dd>💰 {research.costGold}</dd></div><div><dt>Duração base</dt><dd>{research.durationDays} dias</dd></div><div><dt>Status</dt><dd>{STATUS_LABELS[status]}</dd></div></dl>
      <h4>Efeitos</h4><ul>{research.effects.map((effect,index) => <li key={index}>{formatTechnologyEffect(effect)}</li>)}</ul>
      <h4>Pré-requisitos</h4><p>{research.prerequisites.map(key => TECHNOLOGIES.find(item => item.id === key)?.title ?? 'Tecnologia indisponível').join(', ') || 'Nenhum'}</p>
      {reason && status === 'blocked' && <p className="research-tooltip__blocked" role="status">{reason}</p>}
      {progress && <p>Progresso: {progress.current.toLocaleString('pt-BR')} / {progress.required} dias ({Math.round(progress.percent)}%). Estimativa: ~{progress.estimatedDaysRemaining} dias restantes.</p>}
      {speed !== 1 && <p>Velocidade por tecnologias e focos: {speed.toLocaleString('pt-BR')}×.</p>}
      {progress && <p className="research-tooltip__hint">Estimativa baseada em tecnologias e focos; leis e dificuldade podem alterar o ritmo diário.</p>}
      {status === 'active' && <p className="research-tooltip__hint">Cancelar perde o progresso e não devolve o ouro investido.</p>}
      {pinned ? <div className="research-tooltip__actions">
        {status === 'available' && <button ref={actionRef} type="button" onClick={onStart}>Iniciar pesquisa</button>}
        {status === 'active' && <button ref={actionRef} type="button" onClick={onCancel}>Cancelar pesquisa</button>}
        {status !== 'available' && status !== 'active' && <button ref={actionRef} type="button" onClick={onDismiss}>Voltar à árvore</button>}
      </div> : <p className="research-tooltip__hint">Clique ou pressione Enter para fixar os detalhes.</p>}
    </section>
  );
}
