import React from 'react';
import type { NationalFocus } from '../../types/technology';
import { FOCUS_CATEGORIES, STATUS_LABELS, type FocusNodeStatus } from './presentation';

interface Props {
  focus: NationalFocus;
  status: FocusNodeStatus;
  percent: number;
  expanded: boolean;
  detailId: string;
  onInspect: (element: HTMLButtonElement, pin: boolean) => void;
  onLeave: () => void;
}

export function FocusNode({ focus, status, percent, expanded, detailId, onInspect, onLeave }: Props) {
  const marker = {available:'○',blocked:'🔒',active:'◉',completed:'✓','exclusive-blocked':'×'}[status];
  return (
    <button type="button" className={`focus-node focus-node--${status}`}
      style={{ gridColumn: focus.position.column + 1, gridRow: focus.position.row + 1, '--focus-color': FOCUS_CATEGORIES[focus.category].color } as React.CSSProperties}
      aria-label={`${focus.title} — ${STATUS_LABELS[status]}`}
      aria-disabled={status !== 'available' && status !== 'active'}
      aria-haspopup="dialog" aria-expanded={expanded} aria-controls={expanded ? detailId : undefined}
      onMouseEnter={event => onInspect(event.currentTarget, false)} onMouseLeave={onLeave}
      onBlur={onLeave} onFocus={event => onInspect(event.currentTarget, false)} onClick={event => onInspect(event.currentTarget, true)}>
      <span className="focus-node__icon" aria-hidden="true">{focus.icon}</span>
      <span className="focus-node__title">{focus.title}</span>
      <span className="focus-node__state" aria-hidden="true">{marker} {status === 'active' ? `${percent}%` : STATUS_LABELS[status]}</span>
      {status === 'active' && <span className="focus-node__progress" role="progressbar" aria-label={`Progresso de ${focus.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{width:`${percent}%`}} /></span>}
    </button>
  );
}
