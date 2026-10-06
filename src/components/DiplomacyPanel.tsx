import { useState } from 'react';
import type { Country, DiplomacyAction } from '../types';
import { actionBlockReason, agreementResponseBlockReason, diplomacyDay, getAllies, getCasusBelli, getGuarantors, getRelation, hasMilitaryAccess,
  hasNonAggressionPact, opinionLabel, warCallBlockReason, warPenaltyPreview, type DiplomacyContext } from '../engine/diplomacy';

interface Props {
  targetCountry: Country; playerCountry: Country; context: DiplomacyContext;
  onClose: () => void; onAction: (action: DiplomacyAction,cbId?: string) => void;
  onProposal: (id: string,accept: boolean) => void; onCall: (warId: string) => void; feedback?: string;
}
const actionLabels: Record<DiplomacyAction,string> = {
  offerAlliance: 'Oferecer aliança',breakAlliance: 'Romper aliança',offerNap: 'Oferecer NAP',breakNap: 'Romper NAP',
  requestAccess: 'Pedir acesso militar',revokeAccess: 'Revogar acesso concedido',guarantee: 'Garantir independência',
  withdrawGuarantee: 'Retirar garantia',declareWar: 'Declarar guerra',generateConquestCb: 'Gerar CB de conquista',
};
export function DiplomacyPanel({targetCountry,playerCountry,context: ctx,onClose,onAction,onProposal,onCall,feedback}: Props) {
  const [confirming,setConfirming] = useState(false),[cbId,setCbId] = useState('');
  const a = playerCountry.tag,b = targetCountry.tag,r = getRelation(ctx.relations,a,b),day = diplomacyDay(ctx.date);
  const cbs = getCasusBelli(ctx.relations,a,b,day).filter(cb => cb.type === 'conquest');
  const selectedCb = cbs.find(cb => cb.id === cbId);
  const penalties = warPenaltyPreview(ctx,a,b,!!selectedCb);
  const warReason = actionBlockReason(ctx,a,b,'declareWar');
  const incoming = ctx.relations.flatMap(r => r.proposals ?? []).filter(p => p.to === a && p.from === b && p.expiresAt > day);
  const agreements = [
    ['Aliança',r?.alliance ? 'Ativa · acesso automático nos dois sentidos' : 'Inativa'],
    ['Pacto de Não Agressão',hasNonAggressionPact(ctx.relations,a,b,day) ? `Ativo · ${r!.nonAggressionPact!.expiresAt-day} dias restantes` : 'Inativo'],
    ['Acesso militar',`${b} → ${a}: ${hasMilitaryAccess(ctx.relations,a,b) ? 'concedido' : 'não concedido'}; ${a} → ${b}: ${hasMilitaryAccess(ctx.relations,b,a) ? 'concedido' : 'não concedido'}`],
    ['Garantia',`${a} garante ${b}: ${r?.guarantees?.includes(a) ? 'sim' : 'não'}; ${b} garante ${a}: ${r?.guarantees?.includes(b) ? 'sim' : 'não'}`],
  ];
  return <div className="diplomacy-panel" role="dialog" aria-label={`Diplomacia com ${targetCountry.name}`}>
    <div className="diplomacy-panel__header">
      <div className="diplomacy-panel__country-info"><span className="diplomacy-panel__flag">{targetCountry.flag}</span><div>
        <h2 className="diplomacy-panel__name">{targetCountry.name}</h2><span className="diplomacy-panel__tag">[{b}] · Diplomacy V2</span>
      </div></div><button className="diplomacy-panel__close" aria-label="Fechar diplomacia" onClick={onClose}>×</button>
    </div>
    <section className="diplomacy-panel__section">
      <h3 className="diplomacy-panel__subtitle">Relação diplomática</h3>
      <p className="diplomacy-panel__status-text">{r?.status === 'war' ? 'Guerra' : r?.alliance ? 'Aliado' : 'Paz'}</p>
      <p>Opinião: <strong>{r?.opinion ?? 0}</strong> · {opinionLabel(r?.opinion ?? 0)}</p>
      <meter aria-label="Opinião" min={-100} max={100} value={r?.opinion ?? 0} />
      <p>Confiança: <strong>{r?.trust ?? 50}/100</strong></p>
      <meter aria-label="Confiança" min={0} max={100} value={r?.trust ?? 50} />
    </section>
    <section className="diplomacy-panel__section"><h3 className="diplomacy-panel__subtitle">Acordos</h3>
      <dl className="diplomacy-v2-agreements">{agreements.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>
    {incoming.length > 0 && <section className="diplomacy-panel__section"><h3 className="diplomacy-panel__subtitle">Propostas recebidas</h3>
      {incoming.map(p => {
        const reason = p.kind === 'call' ? undefined : agreementResponseBlockReason(ctx,p.from,p.to,p.kind);
        return <div key={p.id} className="diplomacy-v2-proposal"><p>{p.kind === 'call' ? 'Chamada à guerra' : p.kind === 'alliance' ? 'Aliança' : p.kind === 'nap' ? 'Pacto de Não Agressão' : 'Acesso militar'} de {p.from}</p>
          <button disabled={!!reason} title={reason} onClick={() => onProposal(p.id,true)}>Aceitar</button><button onClick={() => onProposal(p.id,false)}>Recusar</button>{reason && <small>{reason}</small>}</div>;
      })}
    </section>}
    <section className="diplomacy-panel__section"><h3 className="diplomacy-panel__subtitle">Ações</h3>
      <div className="diplomacy-panel__actions">{(Object.keys(actionLabels) as DiplomacyAction[]).map(action => {
        let reason = actionBlockReason(ctx,a,b,action);
        if (action === 'generateConquestCb' && cbs.length) reason = 'Casus Belli de conquista já disponível';
        return <div key={action}><button className={`diplomacy-panel__action-btn ${action === 'declareWar' ? 'diplomacy-panel__action-btn--war' : ''}`}
          disabled={!!reason} title={reason} onClick={() => action === 'declareWar' ? setConfirming(true) : onAction(action)}>{actionLabels[action]}</button>
          {reason && <small className="diplomacy-v2-reason">{reason}</small>}</div>;
      })}</div>
      {r?.alliance && ctx.wars.filter(w => [w.attacker,w.defender].includes(a)).map(w => {
        const reason = warCallBlockReason(ctx,a,b,w.id);
        return <div key={w.id}><button className="diplomacy-panel__action-btn" disabled={!!reason} title={reason} onClick={() => onCall(w.id)}>Chamar aliado contra {w.attacker === a ? w.defender : w.attacker}</button>{reason && <small>{reason}</small>}</div>;
      })}
    </section>
    {confirming && <section className="diplomacy-panel__section diplomacy-v2-war-confirm" aria-label="Confirmação de guerra">
      <h3 className="diplomacy-panel__subtitle">Declarar guerra contra {targetCountry.name}</h3>
      <label>Casus Belli<select aria-label="Casus Belli" value={selectedCb?.id ?? ''} onChange={e => setCbId(e.target.value)}>
        <option value="">Sem Casus Belli</option>{cbs.map(cb => <option key={cb.id} value={cb.id}>Conquista · expira em {cb.expiresAt === undefined ? 'nunca' : `${cb.expiresAt-day} dias`}</option>)}
      </select></label>
      <p>Opinião com o alvo: {penalties.opinion}; opinião global: {penalties.globalOpinion}; confiança: {penalties.trust}.</p>
      <p>Aliados a chamar: {getAllies(ctx.relations,a).join(', ') || 'nenhum'}.</p>
      <p>Aliados do defensor: {getAllies(ctx.relations,b).join(', ') || 'nenhum'}.</p>
      <p>Garantidores do defensor: {getGuarantors(ctx.relations,b).join(', ') || 'nenhum'}.</p>
      <button className="diplomacy-panel__action-btn diplomacy-panel__action-btn--war" disabled={!!warReason}
        onClick={() => { onAction('declareWar',selectedCb?.id); setConfirming(false); }}>Confirmar Declaração de Guerra</button>
      {warReason && <small>{warReason}</small>}<button onClick={() => setConfirming(false)}>Cancelar</button>
    </section>}
    {feedback && <p className="diplomacy-panel__section" role="status">{feedback}</p>}
  </div>;
}
