import type { ToastType } from '../../types/toast';
import { useState } from 'react';
import type { ActiveBattle, Army, Country, DiplomaticRelation, GameDate, Province, War } from '../../types';
import type { DiplomacyAction } from '../../types/diplomacy';
import { actionBlockReason, breakAlliance, breakNonAggressionPact, callAllyToWar, cancelInvalidDiplomaticRoutes, declareWar, generateConquestCasusBelli,
  guaranteeIndependence, makePeace, offerAgreement, respondAgreement, respondToWarCall,
  resolvePeaceBattles, revokeMilitaryAccess, shouldAcceptAgreement, withdrawGuarantee } from '../../engine/diplomacy';
import type { DiplomacyContext, DiplomacyResult } from '../../engine/diplomacy';
type Params = {
  diplomacyTarget: string | null; playerCountryTag: string;
  countriesRef: {current: Country[]}; provincesRef: {current: Province[]}; armiesRef: {current: Army[]};
  diplomaticRelationsRef: {current: DiplomaticRelation[]}; warsRef: {current: War[]}; dateRef: {current: GameDate};
  setDiplomaticRelations: (r: DiplomaticRelation[]) => void; setWars: (w: War[]) => void;
  setArmies: (a: Army[]) => void;
  activeBattlesRef: {current: ActiveBattle[]}; setActiveBattles: (b: ActiveBattle[]) => void;
  addLog: (message: string) => void;
  addToast: (message: string,type?: ToastType,title?: string) => void;
};
export function useDiplomacyActions(p: Params) {
  const [feedback,setFeedback] = useState('');
  const context = (): DiplomacyContext => ({relations: p.diplomaticRelationsRef.current,wars: p.warsRef.current,
    countries: p.countriesRef.current,provinces: p.provincesRef.current,armies: p.armiesRef.current,date: p.dateRef.current});
  const publish = (r: DiplomacyResult) => {
    p.diplomaticRelationsRef.current = r.relations; p.warsRef.current = r.wars;
    p.setDiplomaticRelations(r.relations); p.setWars(r.wars);
    const armies = cancelInvalidDiplomaticRoutes(p.armiesRef.current,p.provincesRef.current,r.relations);
    p.armiesRef.current = armies; p.setArmies(armies);
    const message = r.message.replace(/\b[A-Z]{2,4}\b/g,tag => p.countriesRef.current.find(c => c.tag === tag)?.name ?? tag);
    setFeedback(message); p.addLog(message); p.addToast(message,r.ok && !message.includes('recusou') ? 'success' : 'warning','Diplomacia');
  };
  const handleAction = (action: DiplomacyAction,cbId?: string) => {
    const a = p.playerCountryTag,b = p.diplomacyTarget; if (!b) return;
    let ctx = context(); const reason = actionBlockReason(ctx,a,b,action);
    if (reason) { publish({...ctx,ok: false,message: reason}); return; }
    if (action === 'offerAlliance' || action === 'offerNap' || action === 'requestAccess') {
      const kind = action === 'offerAlliance' ? 'alliance' : action === 'offerNap' ? 'nap' : 'access';
      const offer = offerAgreement(ctx,a,b,kind); if (!offer.ok) { publish(offer); return; }
      ctx = {...ctx,...offer};
      publish(respondAgreement(ctx,a,b,kind,shouldAcceptAgreement(ctx,a,b,kind))); return;
    }
    const actions = {breakAlliance,breakNap: breakNonAggressionPact,revokeAccess: revokeMilitaryAccess,
      guarantee: guaranteeIndependence,withdrawGuarantee,declareWar: (c: DiplomacyContext,x: string,y: string) => declareWar(c,x,y,cbId),generateConquestCb: generateConquestCasusBelli};
    publish(actions[action](ctx,a,b));
  };
  const handleProposal = (id: string,accept: boolean) => {
    const ctx = context(),proposal = ctx.relations.flatMap(r => r.proposals ?? []).find(q => q.id === id && q.to === p.playerCountryTag);
    if (!proposal) return;
    publish(proposal.kind === 'call' ? respondToWarCall(ctx,id,accept) : respondAgreement(ctx,proposal.from,proposal.to,proposal.kind,accept));
  };
  const handleMakePeace = (warId: string) => {
    const ctx = context(),war = ctx.wars.find(w => w.id === warId);
    if (!war || ![war.attacker,war.defender].includes(p.playerCountryTag)) return;
    const peace = makePeace(ctx,warId);
    if (peace.ok) {
      const resolved = resolvePeaceBattles(p.activeBattlesRef.current,p.armiesRef.current,peace.relations);
      p.activeBattlesRef.current = resolved.battles; p.setActiveBattles(resolved.battles);
      p.armiesRef.current = resolved.armies;
    }
    publish(peace);
  };
  const handleCall = (warId: string) => {
    if (p.diplomacyTarget) publish(callAllyToWar(context(),p.playerCountryTag,p.diplomacyTarget,warId));
  };
  return {handleAction,handleProposal,handleMakePeace,handleCall,feedback};
}
