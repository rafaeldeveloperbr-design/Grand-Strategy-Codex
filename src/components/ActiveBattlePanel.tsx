import type { ActiveBattle, Army, Province } from '../types';
import { getValidParticipantsBySide, calculateArmySize } from '../engine/combat';
import { calculateArmyOrganization } from '../engine/military';
import { getBuildingLevel } from '../data/buildings';

export function ActiveBattlePanel({battle,armies,province}: {battle:ActiveBattle; armies:Army[]; province:Province}) {
  const terrainLabels={plains:'Planície',forest:'Floresta',jungle:'Selva',hills:'Colinas',mountains:'Montanhas',desert:'Deserto'};
  return <details className="active-battle-panel">
    <summary>Batalha em {province.name} · {battle.durationDays ?? Math.max(0,battle.daysTotal-battle.daysRemaining)} dias</summary>
    <p>{terrainLabels[province.terrain ?? 'plains']} · Fortaleza {getBuildingLevel(province,'fortress')}</p>
    {(['attacker','defender'] as const).map(side => {
      const participants=getValidParticipantsBySide(battle,armies,side);
      const troops=participants.reduce((sum,a)=>sum+calculateArmySize(a),0);
      const org=participants.reduce((sum,a)=>sum+calculateArmySize(a)*calculateArmyOrganization(a),0)/Math.max(1,troops);
      return <div key={side}><strong>{side === 'attacker' ? 'Atacantes' : 'Defensores'}</strong>: {troops} tropas · Org {Math.round(org)}% · {participants.length} exércitos
        <ul>{participants.map(a=><li key={a.id}>{a.name} ({a.owner}) · {calculateArmySize(a)} tropas</li>)}</ul>
      </div>;
    })}
    {Object.entries(battle.airModifiers ?? {}).map(([tag,air])=><p key={tag}>{tag}: Superioridade ×{air.superiority.toFixed(2)} · CAS +{air.cas.toFixed(2)}</p>)}
    <p>Baixas: {battle.attackerCasualties} / {battle.defenderCasualties}</p>
  </details>;
}
