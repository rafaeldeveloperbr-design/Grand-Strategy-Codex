import React, { useEffect, useId, useRef, useState } from 'react';
import type { CountryTechState } from '../types/technology';
import { TECHNOLOGIES } from '../data/technology';
import { getTechnologyBlockReason, getResearchProgress, getActiveTechnologyModifierEntries } from '../engine/technology';
import { ResearchTree } from './research/ResearchTree';
import { ResearchTooltip } from './research/ResearchTooltip';
import { RESEARCH_CATEGORIES } from './research/presentation';
import '../styles/tech-modal.css';
import '../styles/research-tree.css';

import type { Country } from '../types';

interface Props {
  playerCountry: Country;
  techState: CountryTechState;
  onStartResearch: (id: string) => void;
  onCancelResearch: () => void;
  onClose: () => void;
}
export const ResearchModal: React.FC<Props> = ({ playerCountry, techState, onStartResearch, onCancelResearch, onClose }) => {
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
    const dismiss = () => {
      if (document.getElementById(detailId)?.contains(document.activeElement)) originRef.current?.focus({preventScroll:true});
      setInspection(null);
    };
    window.addEventListener('resize',dismiss);
    return () => window.removeEventListener('resize',dismiss);
  },[detailId]);
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
  const progress = getResearchProgress(techState);
  const modifiers = getActiveTechnologyModifierEntries(techState);
  const active = TECHNOLOGIES.find(research => research.id === techState.activeResearchId);
  const inspected = TECHNOLOGIES.find(research => research.id === inspection?.id);
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
    <div className="tech-modal research-modal">
      <div className="tech-modal__overlay" onClick={onClose} />
      <div ref={containerRef} className="research-modal__container" role="dialog" aria-modal="true" aria-labelledby={headingId} onKeyDown={handleKeyDown}>
        <header className="research-modal__header"><div><h2 id={headingId}>Pesquisa Tecnológica</h2><p>Explore as tecnologias e planeje a próxima pesquisa.</p></div><button ref={closeRef} type="button" aria-label="Fechar pesquisa tecnológica" onClick={onClose}>×</button></header>
        <div className="research-modal__summary" role="status">{active ? `Pesquisa atual: ${active.title} — ${Math.round(progress?.percent ?? 0)}%` : 'Nenhuma pesquisa ativa'}</div>
        <div className="research-modal__gold">Ouro disponível: 💰 {playerCountry.resources.gold.toLocaleString('pt-BR')}</div>
        {modifiers.length > 0 && <section className="research-modifiers" aria-label="Modificadores tecnológicos ativos"><h3>Modificadores tecnológicos ativos</h3><div>{modifiers.map(modifier => <span key={modifier.label}>{modifier.label}: <strong>{modifier.percent > 0 ? '+' : ''}{modifier.percent}%</strong></span>)}</div></section>}
        <div className="research-category-legend" aria-label="Categorias de tecnologias">{Object.entries(RESEARCH_CATEGORIES).map(([id,category]) => <h3 key={id} style={{'--research-color':category.color} as React.CSSProperties}><span aria-hidden="true">{category.icon}</span> {category.label}</h3>)}</div>
        <ResearchTree country={playerCountry} state={techState} inspectedId={inspection?.id ?? null} detailId={detailId} onInspect={inspect} onLeave={leave} onScroll={dismissOnScroll} />
        <p className="research-modal__hint">Explore os ramos com a rolagem. Selecione uma tecnologia para ver detalhes e ações.</p>
        {inspection && inspected && <ResearchTooltip country={playerCountry} research={inspected} state={techState} id={detailId} pinned={inspection.pinned} position={inspection}
          onEnter={clearLeave} onLeave={leave} onDismiss={dismiss}
          onStart={() => { if (getTechnologyBlockReason(techState,inspected.id,playerCountry) === null) { onStartResearch(inspected.id); dismiss(); } }}
          onCancel={() => { onCancelResearch(); dismiss(); }} />}
      </div>
    </div>
  );
};
