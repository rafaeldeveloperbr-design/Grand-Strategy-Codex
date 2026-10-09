import { AMPHIBIOUS_FRIENDLY_BEACH_LANDING_DAYS, FRIENDLY_BEACH_LANDING_LABEL } from '../engine/naval/friendlyBeachLanding';
import { useState } from 'react';
import { calculateArmySize } from '../engine/combat';
import { amphibiousLandingDays, fleetTransportCapacity, fleetTransportUsed } from '../engine/naval/transport';
import type { InvasionOrder } from '../types/naval';
import type { Army, Country, Province } from '../types';
import type { Fleet, NavalBattle, NavalBuildOrder } from '../types/naval';
import { fleetOrganization, fleetSpeed, fleetStrength, seaNodeById } from '../engine/naval';
export function FleetPanel({fleet,country,provinces,reinforcements=[],embarkedArmies=[],extractingArmies=[],invasion,onDisembark,onPlanFriendlyLanding,onPlanInvasion,onSelectArmy,owner,onReturn,onCancel,onLocate,onClose}:{fleet:Fleet;embarkedArmies?:Army[];extractingArmies?:Army[];invasion?:InvasionOrder;onDisembark?:(armyId:string)=>void;onPlanInvasion?:(armyIds:string[])=>void;onPlanFriendlyLanding?:(armyIds:string[])=>void;onSelectArmy?:(armyId:string)=>void;reinforcements?:readonly NavalBuildOrder[];country?:Country;provinces:readonly Province[];owner:boolean;onReturn:()=>void;onCancel:()=>void;onLocate:()=>void;onClose:()=>void}) {
  const [selectedCargo, setSelectedCargo] = useState<string[]>([]);
  const location=provinces.find(p=>p.id===fleet.portProvinceId)?.name??`${seaNodeById.get(fleet.locationSeaNodeId??'')?.ocean??'Mar'} · ${fleet.locationSeaNodeId??''}`;
  return <aside className="naval-panel" aria-label="Fleet panel"><div className="naval-panel__header"><h3>{fleet.name}</h3><button aria-label="Fechar frota" onClick={onClose}>✕</button></div>
    <p>{country?.flag} {country?.name??fleet.countryTag}</p><p>{location}</p><p>Status: {fleet.status} · {Math.round(fleet.movementProgress*100)}%</p>
    <p>Velocidade: {fleetSpeed(fleet)} · Força: {fleetStrength(fleet).toFixed(0)} · Organização: {fleetOrganization(fleet).toFixed(0)}%</p>
    <p>Destino: {fleet.destinationPortId?provinces.find(p=>p.id===fleet.destinationPortId)?.name:fleet.destinationSeaNodeId??'—'}</p>
    <section aria-label="Transport Capacity"><p>Transport Capacity: {fleetTransportUsed(embarkedArmies).toLocaleString()} / {fleetTransportCapacity(fleet).toLocaleString()}</p>
      {extractingArmies.length > 0 && <p>Reserved for beach extraction: {fleetTransportUsed(extractingArmies).toLocaleString()} tropas</p>}
      <p>Embarked Armies:</p><ul>{embarkedArmies.map(army=><li key={army.id}>{owner&&<input aria-label={`Invade with ${army.name}`} type="checkbox" checked={selectedCargo.includes(army.id)} onChange={e=>setSelectedCargo(ids=>e.target.checked?[...ids,army.id]:ids.filter(id=>id!==army.id))}/>} {owner&&onSelectArmy?<button onClick={()=>onSelectArmy(army.id)}>{army.name}</button>:army.name} — {calculateArmySize(army).toLocaleString()} tropas {owner&&fleet.status==='DOCKED'&&!invasion&&!army.friendlyBeachLanding&&<button onClick={()=>onDisembark?.(army.id)}>Disembark {army.name}</button>}{army.friendlyBeachLanding && <p>{FRIENDLY_BEACH_LANDING_LABEL} {army.friendlyBeachLanding.elapsedDays}/{AMPHIBIOUS_FRIENDLY_BEACH_LANDING_DAYS} dias</p>}</li>)}</ul>
      {invasion&&<p>Invasion: {provinces.find(p=>p.id===invasion.targetProvinceId)?.name} · {invasion.status} · {invasion.landingDays}/{amphibiousLandingDays(invasion.landingType)} dias</p>}
      {owner&&embarkedArmies.length>0&&!invasion&&!embarkedArmies.some(a=>a.friendlyBeachLanding)&&<button disabled={fleet.status==='COMBAT'||fleet.status==='RETREATING'||!selectedCargo.some(id=>embarkedArmies.some(a=>a.id===id))} onClick={()=>onPlanInvasion?.(selectedCargo.filter(id=>embarkedArmies.some(a=>a.id===id)))}>Plan Invasion</button>}
      {owner&&embarkedArmies.length>0&&!invasion&&!embarkedArmies.some(a=>a.friendlyBeachLanding)&&onPlanFriendlyLanding&&<button disabled={fleet.status==='COMBAT'||fleet.status==='RETREATING'||!selectedCargo.some(id=>embarkedArmies.some(a=>a.id===id))} onClick={()=>onPlanFriendlyLanding(selectedCargo.filter(id=>embarkedArmies.some(a=>a.id===id)))}>Desembarcar em costa amiga</button>}
    </section>
    <ul>{fleet.units.map(u=><li key={u.id}>{u.type}: {u.strength.toFixed(0)}/{u.maxStrength} · Org {u.organization.toFixed(0)}</li>)}</ul>
    {!!reinforcements.length&&<p>Reinforcements under construction: {reinforcements.map(b=>`${b.unitType} ${Math.floor(b.progress/b.requiredProgress*100)}%`).join(', ')}</p>}
    <div className="naval-panel__actions"><button onClick={onLocate}>Locate (F)</button>{owner&&<><button disabled={fleet.status==='COMBAT'||fleet.status==='RETREATING'} onClick={onReturn}>Return to Port</button><button disabled={fleet.status==='COMBAT'||fleet.status==='RETREATING'} onClick={onCancel}>Cancel Order</button></>}</div>
    {owner&&<p className="naval-panel__hint">Ative Naval Mode e clique com o botão direito num SeaNode para mover, num porto para atracar ou numa frota hostil para interceptar seu node lógico atual/próximo.</p>}
  </aside>;
}
export function NavalBattlePanel({battle,fleets,armies=[],onLocate,onClose}:{battle:NavalBattle;fleets:readonly Fleet[];armies?:Army[];onLocate:()=>void;onClose:()=>void}) {
  const side=(ids:string[],key:'A'|'B')=>{const snapshots=battle.participantSnapshots?.[key];if(battle.status==='ENDED'&&snapshots?.length)return snapshots.map(p=>`${p.fleetName} (${p.countryTag}) · ${Object.values(p.finalShips).reduce((sum,n)=>sum+(n??0),0)} navios`).join(', ');return ids.map(id=>{const f=fleets.find(f=>f.id===id);return f?`${f.name} (${fleetStrength(f).toFixed(0)})`:`${id} · destruída`;}).join(', ');};
  return <aside className="naval-panel" aria-label="Naval battle panel"><div className="naval-panel__header"><h3>Batalha naval</h3><button onClick={onClose} aria-label="Fechar batalha naval">✕</button></div><p>{battle.seaNodeId} · {battle.status} · {battle.days} dias</p><p>Troops aboard: {fleetTransportUsed(armies.filter(a=>a.embarkedFleetId&&[...battle.sideA,...battle.sideB].includes(a.embarkedFleetId))).toLocaleString()}</p>{!!battle.embarkedTroopLosses&&<p>Embarked troop losses: {battle.embarkedTroopLosses.toLocaleString()}</p>}<p>A: {side(battle.sideA,'A')}</p><p>B: {side(battle.sideB,'B')}</p><p>Dano sofrido · Perdas: A {battle.lossesA.toFixed(0)} / B {battle.lossesB.toFixed(0)}</p>{battle.winner&&<p>Resultado: {battle.winner}</p>}<button onClick={onLocate}>Locate Battle</button></aside>;
}
