import React from 'react';
import type { Technology } from '../../types/technology';
import { RESEARCH_CATEGORIES, STATUS_LABELS, type ResearchNodeStatus } from './presentation';

interface Props {
  research: Technology;
  position: {column:number;row:number};
  status: ResearchNodeStatus;
  percent: number;
  expanded: boolean;
  detailId: string;
  onInspect: (element: HTMLButtonElement, pin: boolean) => void;
  onLeave: () => void;
}

export function ResearchNode({ research, position, status, percent, expanded, detailId, onInspect, onLeave }: Props) {
  const marker = {available:'○',blocked:'🔒',active:'◉',completed:'✓'}[status];
  return (
    <button type="button" className={`research-node research-node--${status}`}
      style={{ gridColumn: position.column + 1, gridRow: position.row + 1, '--research-color': RESEARCH_CATEGORIES[research.category].color } as React.CSSProperties}
      aria-label={`${research.title} — ${STATUS_LABELS[status]}`}
      aria-disabled={status !== 'available' && status !== 'active'}
      aria-haspopup="dialog" aria-expanded={expanded} aria-controls={expanded ? detailId : undefined}
      onMouseEnter={event => onInspect(event.currentTarget, false)} onMouseLeave={onLeave}
      onBlur={onLeave} onFocus={event => onInspect(event.currentTarget, false)} onClick={event => onInspect(event.currentTarget, true)}>
      <span className="research-node__icon" aria-hidden="true">{research.icon}</span>
      <span className="research-node__title">{research.title}</span>
      <span className="research-node__state" aria-hidden="true">{marker} {status === 'active' ? `${percent}%` : STATUS_LABELS[status]}</span>
      {status === 'active' && <span className="research-node__progress" role="progressbar" aria-label={`Progresso de ${research.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{width:`${percent}%`}} /></span>}
    </button>
  );
}
