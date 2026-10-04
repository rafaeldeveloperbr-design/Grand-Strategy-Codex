import React from 'react';
import type { Country } from '../types';
import type { LawCategory } from '../types/government';
import { LAWS, LAWS_BY_CATEGORY, LAW_CATEGORIES } from '../constants/laws';
import { canEnactLaw, formatLawModifierEntries, normalizeActiveLaws } from '../engine/government';

interface Props { playerCountry: Country; atWar: boolean; onEnactLaw: (category: LawCategory, lawId: string) => void; onClose: () => void }
const CATEGORY_INFO: Record<LawCategory,{icon:string;name:string;description:string}> = {
  conscription:{icon:'🎖️',name:'Recrutamento',description:'Mobilização, reservas e impacto sobre a população'},
  taxation:{icon:'💰',name:'Tributação',description:'Arrecadação, consumo e bem-estar'},
  governance:{icon:'🏛️',name:'Governança',description:'Autonomia, coordenação e administração'},
  economy:{icon:'🏭',name:'Economia de Guerra',description:'Prioridades produtivas civis e militares'},
  intelligence:{icon:'🕵️',name:'Inteligência',description:'Pesquisa e planejamento estratégico'},
  agrarian:{icon:'🌾',name:'Política Agrária',description:'Produção de alimentos e capacidade rural'},
  trade:{icon:'📦',name:'Política Comercial',description:'Redistribuição entre mercados provinciais'},
};

export const GovernmentModal: React.FC<Props> = ({playerCountry,atWar,onEnactLaw,onClose}) => {
  const active = normalizeActiveLaws(playerCountry.activeLaws);
  return <div className="government-modal-overlay" onClick={onClose}><div className="government-modal" onClick={event=>event.stopPropagation()}>
    <div className="government-modal__header"><div><h2>🏛️ Governo e Leis</h2><small>{atWar?'País em guerra':'País em paz'}</small></div><button className="government-modal__close" onClick={onClose}>✕</button></div>
    <div className="government-modal__content">{LAW_CATEGORIES.map(category=>{
      const info=CATEGORY_INFO[category];
      return <section key={category} className="government-modal__category"><div className="government-modal__category-header"><span className="government-modal__category-icon">{info.icon}</span><div><h3>{info.name}</h3><p>{info.description}</p></div></div>
        <div className="government-modal__laws">{LAWS_BY_CATEGORY[category].map(lawId=>{
          const law=LAWS[lawId]; const isActive=active[category]===lawId;
          const validation=canEnactLaw(active,lawId,playerCountry.resources.gold,{atWar});
          const effects=formatLawModifierEntries(law);
          return <article key={lawId} className={`government-modal__law-card ${isActive?'active':''}`}>
            <div className="government-modal__law-header"><h4>{law.name}</h4>{isActive&&<span className="government-modal__law-badge">ATIVA</span>}</div>
            <p className="government-modal__law-description">{law.description}</p>
            <div className="government-modal__law-bonuses">{effects.length?effects.map(effect=><span title={effect.text.includes('Produção')?'Afeta diretamente a produção provincial do bem.':undefined} key={effect.text} className={`government-modal__law-bonus ${effect.positive?'positive':'negative'}`}>{effect.positive?'▲':'▼'} {effect.text}</span>):<span className="government-modal__law-bonus">Sem modificadores</span>}</div>
            {law.requirements?.atWar&&<div className="government-modal__requirement">Requisito: país em guerra</div>}
            {!isActive&&<div className="government-modal__law-footer"><span className="government-modal__law-cost">💰 {law.costGold.toLocaleString()} ouro</span><button className="government-modal__law-button" disabled={!validation.allowed} title={validation.reason??undefined} onClick={()=>onEnactLaw(category,lawId)}>{validation.allowed?'Promulgar':validation.reason}</button></div>}
          </article>})}</div></section>})}</div>
  </div></div>;
};
