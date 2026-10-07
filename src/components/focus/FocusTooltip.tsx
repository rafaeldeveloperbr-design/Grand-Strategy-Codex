import React, { useEffect, useRef } from 'react';
import type { CountryTechState, NationalFocus } from '../../types/technology';
import { NATIONAL_FOCUSES } from '../../data/technology';
import { formatFocusEffect, getFocusBlockReason } from '../../engine/technology';
import { FOCUS_CATEGORIES, getFocusNodeStatus, getFocusPercent, STATUS_LABELS } from './presentation';

interface Props {
  focus: NationalFocus;
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
const names = (ids: string[]) => ids.map(id => NATIONAL_FOCUSES.find(f => f.id === id)?.title ?? 'Foco indisponível').join(', ') || 'Nenhum';
export function FocusTooltip({focus,state,id,pinned,position,onEnter,onLeave,onDismiss,onStart,onCancel}: Props) {
  const actionRef = useRef<HTMLButtonElement>(null);
  const reason = getFocusBlockReason(state,focus.id);
  const status = getFocusNodeStatus(focus,state,reason);
  const category = FOCUS_CATEGORIES[focus.category];
  useEffect(() => { if (pinned) actionRef.current?.focus(); },[pinned,focus.id,status]);
  return (
    <section id={id} role="dialog" aria-label={`Detalhes de ${focus.title}`} className="focus-tooltip" style={{left:position.left,top:position.top,'--focus-color':category.color} as React.CSSProperties}
      onMouseEnter={onEnter} onMouseLeave={onLeave} onFocus={onEnter} onBlur={onLeave}>
      <div className="focus-tooltip__heading"><span aria-hidden="true">{focus.icon}</span><h3>{focus.title}</h3><button type="button" aria-label="Fechar detalhes" onClick={onDismiss}>×</button></div>
      <p className="focus-tooltip__category">{category.label}</p>
      <p>{focus.description}</p>
      <dl><div><dt>Duração</dt><dd>{focus.durationDays} dias</dd></div><div><dt>Status</dt><dd>{STATUS_LABELS[status]}</dd></div></dl>
      <h4>Efeitos</h4><ul>{focus.rewardEffects.map((effect,index) => <li key={index}>{formatFocusEffect(effect)}</li>)}</ul>
      <h4>Pré-requisitos</h4><p>{names(focus.prerequisites ?? [])}</p>
      <h4>Exclusivo com</h4><p>{names(focus.mutuallyExclusive ?? [])}</p>
      {reason && status !== 'active' && status !== 'completed' && <p className="focus-tooltip__blocked" role="status">{reason}</p>}
      {status === 'active' && <p>Progresso: {state.focusProgressDays.toLocaleString('pt-BR')} / {focus.durationDays} dias ({getFocusPercent(focus,state.focusProgressDays)}%). Restam {Math.max(0,focus.durationDays-state.focusProgressDays).toLocaleString('pt-BR')} dias de progresso.</p>}
      {status === 'active' && <p className="focus-tooltip__hint">Cancelar perde todo o progresso deste foco.</p>}
      {pinned ? <div className="focus-tooltip__actions">
        {status === 'available' && <button ref={actionRef} type="button" onClick={onStart}>Iniciar foco</button>}
        {status === 'active' && <button ref={actionRef} type="button" onClick={onCancel}>Cancelar foco</button>}
        {status !== 'available' && status !== 'active' && <button ref={actionRef} type="button" onClick={onDismiss}>Voltar à árvore</button>}
      </div> : <p className="focus-tooltip__hint">Clique ou pressione Enter para fixar os detalhes.</p>}
    </section>
  );
}
