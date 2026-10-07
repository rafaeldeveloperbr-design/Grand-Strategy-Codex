import React, { useEffect, useId, useRef, useState } from 'react';
import type { CountryTechState } from '../types/technology';
import { NATIONAL_FOCUSES } from '../data/technology';
import { getFocusBlockReason } from '../engine/technology';
import { FocusTree } from './focus/FocusTree';
import { FocusTooltip } from './focus/FocusTooltip';
import { FOCUS_CATEGORIES, getFocusPercent } from './focus/presentation';
import '../styles/tech-modal.css';
import '../styles/focus-tree.css';

interface Props {
  techState: CountryTechState;
  onStartFocus: (id: string) => void;
  onCancelFocus: () => void;
  onClose: () => void;
}
export const FocusModal: React.FC<Props> = ({ techState, onStartFocus, onCancelFocus, onClose }) => {
  const [inspection,setInspection] = useState<{id:string;pinned:boolean;left:number;top:number} | null>(null);
  const detailId = useId(), headingId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const originRef = useRef<HTMLButtonElement | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const clearLeave = () => { clearTimeout(leaveTimer.current); };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => { clearTimeout(leaveTimer.current); previous?.focus(); };
  },[]);
  useEffect(() => {
    const dismiss = () => setInspection(null);
    window.addEventListener('resize',dismiss);
    return () => window.removeEventListener('resize',dismiss);
  },[]);
  const inspect = (id:string,element:HTMLButtonElement,pinned:boolean) => {
    clearLeave();
    if (inspection?.pinned && !pinned) return;
    originRef.current = element;
    const rect = element.getBoundingClientRect();
    const width = Math.min(340,window.innerWidth-24);
    const left = Math.max(12,Math.min(rect.right+12,window.innerWidth-width-12));
    const top = Math.max(12,Math.min(rect.top,window.innerHeight-480));
    setInspection({id,pinned,left,top});
  };
  const leave = () => {
    clearLeave();
    if (!inspection?.pinned) leaveTimer.current = setTimeout(() => {
      if (document.activeElement !== originRef.current && !document.getElementById(detailId)?.contains(document.activeElement)) setInspection(null);
    },160);
  };
  const dismiss = () => { clearLeave(); originRef.current?.focus({preventScroll:true}); setInspection(null); };
  const dismissOnScroll = () => {
    clearLeave();
    // Keyboard focus can scroll a distant node into view; keep its details anchored.
    if (inspection && !inspection.pinned && document.activeElement === originRef.current && originRef.current) {
      inspect(inspection.id,originRef.current,false);
      return;
    }
    if (document.getElementById(detailId)?.contains(document.activeElement)) originRef.current?.focus({preventScroll:true});
    setInspection(null);
  };
  const active = NATIONAL_FOCUSES.find(focus => focus.id === techState.activeFocusId);
  const inspected = NATIONAL_FOCUSES.find(focus => focus.id === inspection?.id);
  const handleKeyDown = (event:React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); if (inspection) dismiss(); else onClose(); }
    if (event.key === 'Tab') {
      const controls = Array.from(containerRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? []);
      const first = controls[0], last = controls[controls.length-1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  return (
    <div className="tech-modal focus-modal">
      <div className="tech-modal__overlay" onClick={onClose} />
      <div ref={containerRef} className="focus-modal__container" role="dialog" aria-modal="true" aria-labelledby={headingId} onKeyDown={handleKeyDown}>
        <header className="focus-modal__header"><div><h2 id={headingId}>Focos Nacionais</h2><p>Escolha uma direção estratégica para o país.</p></div><button ref={closeRef} type="button" aria-label="Fechar focos nacionais" onClick={onClose}>×</button></header>
        <div className="focus-modal__summary" role="status">{active ? `Foco ativo: ${active.title} — ${getFocusPercent(active,techState.focusProgressDays)}%` : 'Nenhum foco ativo'}</div>
        <div className="focus-category-legend" aria-label="Categorias de focos">{Object.entries(FOCUS_CATEGORIES).map(([id,category]) => <h3 key={id} style={{'--focus-color':category.color} as React.CSSProperties}><span aria-hidden="true">{category.icon}</span> {category.label}</h3>)}</div>
        <FocusTree state={techState} inspectedId={inspection?.id ?? null} detailId={detailId} onInspect={inspect} onLeave={leave} onScroll={dismissOnScroll} />
        <p className="focus-modal__hint">Explore os ramos com a rolagem. Selecione um foco para confirmar a ação.</p>
        {inspection && inspected && <FocusTooltip focus={inspected} state={techState} id={detailId} pinned={inspection.pinned} position={inspection}
          onEnter={clearLeave} onLeave={leave} onDismiss={dismiss}
          onStart={() => { if (getFocusBlockReason(techState,inspected.id) === null) { onStartFocus(inspected.id); dismiss(); } }}
          onCancel={() => { onCancelFocus(); dismiss(); }} />}
      </div>
    </div>
  );
};
