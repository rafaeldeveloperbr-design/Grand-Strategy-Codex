import React, { useState } from 'react';
import type { Country, Province, Army, War, GameDate } from '../types';
import type { LawCategory } from '../types/government';
import { LAWS, LAWS_BY_CATEGORY } from '../constants/laws';
import { formatLawModifierEntries, normalizeActiveLaws } from '../engine/government';
import { calculatePoliticalGroups, governmentSupport, GOVERNMENT_DEFINITIONS, normalizePolitics, legitimacyDescription, legitimacyFactors, validatePolicyChange, POLITICS_BALANCE as B, GROUP_LABELS, GROUP_IDS } from '../engine/politics';

interface Props { playerCountry: Country; atWar: boolean; provinces?:Province[];armies?:Army[];wars?:War[];date?:GameDate;onEnactLaw: (category: LawCategory, lawId: string) => void; onClose: () => void }
const POLICIES:LawCategory[]=['taxation','militarySpending','social','governance'];
const LEGACY:LawCategory[]=['conscription','economy','intelligence','agrarian','trade'];
const LABELS:Record<LawCategory,string>={taxation:'Impostos',militarySpending:'Gasto militar',social:'Política social',governance:'Governança',conscription:'Recrutamento',economy:'Economia de guerra',intelligence:'Inteligência',agrarian:'Política agrária',trade:'Política comercial'};
export const GovernmentModal: React.FC<Props> = ({playerCountry,atWar,provinces=[],armies=[],wars=[],date={year:1444,month:11,day:11},onEnactLaw,onClose}) => {
  const [pending,setPending]=useState<string|null>(null),active=normalizeActiveLaws(playerCountry.activeLaws),politics=normalizePolitics(playerCountry.politics,playerCountry.tag),ctx={provinces,armies,wars,date};
  const groups=calculatePoliticalGroups(playerCountry,ctx),support=governmentSupport(groups),government=GOVERNMENT_DEFINITIONS[politics.governmentType];
  const factors=legitimacyFactors(playerCountry,ctx),validation=pending ? validatePolicyChange(playerCountry,pending,date,atWar) : null;
  const renderPolicies=(categories:LawCategory[]) => categories.map(category => <section key={category} className="government-modal__category">
    <h3>{LABELS[category]}</h3><p>Atual: {LAWS[active[category]!]?.name}</p>
    <div className="government-modal__laws">{LAWS_BY_CATEGORY[category].map(id => {
      const law=LAWS[id],current=active[category]===id,result=validatePolicyChange(playerCountry,id,date,atWar),effects=formatLawModifierEntries(law);
      const reaction=GROUP_IDS.map(group => ({group,value:(B.policyApproval[id]?.[group] ?? 0)-(B.policyApproval[active[category]!]?.[group] ?? 0)})).filter(r => r.value!==0);
      return <article key={id} className={`government-modal__law-card ${current?'active':''}`}>
        <h4>{law.name}{current && <span className="government-modal__law-badge"> ATIVA</span>}</h4><p>{law.description}</p>
        <div className="government-modal__law-bonuses">{effects.map(effect => <span key={effect.text} className={`government-modal__law-bonus ${effect.positive?'positive':'negative'}`}>{effect.text}</span>)}</div>
        <small>{reaction.map(r => `${GROUP_LABELS[r.group]} ${r.value>0?'+':''}${r.value}`).join(' · ')}</small>
        {!current && <div className="government-modal__law-footer"><span>{result.cost} capital político · {result.goldCost} ouro · cooldown {B.policyChangeCooldown} dias</span>
          <button type="button" className="government-modal__law-button" disabled={!result.allowed} title={result.reason ?? undefined} onClick={() => setPending(id)}>{result.allowed ? `Adotar ${law.name}` : result.reason}</button></div>}
      </article>;
    })}</div>
  </section>);
  return <div className="government-modal-overlay" onClick={onClose}><div className="government-modal" role="dialog" aria-modal="true" aria-label="Governo" onClick={e => e.stopPropagation()}>
    <div className="government-modal__header"><div><h2>Governo — {playerCountry.name}</h2><p>{government.label} · {atWar?'Em guerra':'Em paz'}</p></div><button aria-label="Fechar Governo" className="government-modal__close" onClick={onClose}>✕</button></div>
    <div className="government-modal__content">
      <section className="government-modal__category politics-summary">
        <div title={factors.map(f => `${f.label}: ${f.value.toFixed(1)}`).join('\n')}>Legitimidade: <strong>{politics.legitimacy.toFixed(1)} / 100</strong> — {legitimacyDescription(politics.legitimacy)}<progress aria-label="Legitimidade" max={100} value={politics.legitimacy}/></div>
        <div title="Funcionamento institucional e ordem política, distintos do reconhecimento de legitimidade.">Estabilidade: <strong>{playerCountry.resources.stability.toFixed(1)} / 100</strong><progress aria-label="Estabilidade" max={100} value={playerCountry.resources.stability}/></div>
        <div>Apoio ao governo: <strong>{support.toFixed(1)}%</strong><progress aria-label="Apoio ao governo" max={100} value={support}/></div>
        <div>Capital político: <strong>{politics.politicalCapital.toFixed(1)} / 100</strong><progress aria-label="Capital político" max={100} value={politics.politicalCapital}/></div>
      </section>
      <section className="government-modal__category"><h3>Grupos políticos</h3><div className="government-modal__laws">{groups.map(g => <article key={g.id} className="government-modal__law-card" title={g.effects.map(e => `${e.label}: ${e.value>=0?'+':''}${e.value.toFixed(1)}`).join('\n')}>
        <h4>{g.name}</h4><p>Influência {g.influence.toFixed(1)}%</p><progress aria-label={`Influência ${g.name}`} max={100} value={g.influence}/><p>Aprovação {g.approval>=0?'+':''}{g.approval.toFixed(1)}</p><progress aria-label={`Aprovação ${g.name}`} max={200} value={g.approval+100}/>
      </article>)}</div></section>
      <h3>Políticas governamentais</h3>{renderPolicies(POLICIES)}
      <details><summary>Outras leis existentes</summary>{renderPolicies(LEGACY)}</details>
      {pending && validation && <section role="alertdialog" aria-label="Confirmar mudança de política" className="government-modal__category politics-confirmation">
        <h3>Confirmar {LAWS[pending].name}?</h3><p>Custo: {validation.cost} capital político e {validation.goldCost} ouro. Legitimidade −{B.policyLegitimacyCost}; estabilidade −{B.policyStabilityCost}. Cooldown: {B.policyChangeCooldown} dias.</p>
        {!validation.allowed && <p role="alert">{validation.reason}</p>}
        <button type="button" disabled={!validation.allowed} onClick={() => {onEnactLaw(LAWS[pending].category,pending);setPending(null);}}>Confirmar mudança</button><button type="button" onClick={() => setPending(null)}>Cancelar</button>
      </section>}
    </div>
  </div></div>;
};
