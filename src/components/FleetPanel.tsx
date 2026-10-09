import type { Country, Province } from '../types';
import type { Fleet, NavalBattle } from '../types/naval';
import { fleetOrganization, fleetSpeed, fleetStrength, seaNodeById } from '../engine/naval';
export function FleetPanel({fleet,country,provinces,owner,onReturn,onCancel,onLocate,onClose}:{fleet:Fleet;country?:Country;provinces:readonly Province[];owner:boolean;onReturn:()=>void;onCancel:()=>void;onLocate:()=>void;onClose:()=>void}) {
  const location=provinces.find(p=>p.id===fleet.portProvinceId)?.name??`${seaNodeById.get(fleet.locationSeaNodeId??'')?.ocean??'Mar'} · ${fleet.locationSeaNodeId??''}`;
  return <aside className="naval-panel" aria-label="Fleet panel"><div className="naval-panel__header"><h3>{fleet.name}</h3><button aria-label="Fechar frota" onClick={onClose}>✕</button></div>
    <p>{country?.flag} {country?.name??fleet.countryTag}</p><p>{location}</p><p>Status: {fleet.status} · {Math.round(fleet.movementProgress*100)}%</p>
    <p>Velocidade: {fleetSpeed(fleet)} · Força: {fleetStrength(fleet).toFixed(0)} · Organização: {fleetOrganization(fleet).toFixed(0)}%</p>
    <p>Destino: {fleet.destinationPortId?provinces.find(p=>p.id===fleet.destinationPortId)?.name:fleet.destinationSeaNodeId??'—'}</p>
    <ul>{fleet.units.map(u=><li key={u.id}>{u.type}: {u.strength.toFixed(0)}/{u.maxStrength} · Org {u.organization.toFixed(0)}</li>)}</ul>
    <div className="naval-panel__actions"><button onClick={onLocate}>Locate (F)</button>{owner&&<><button disabled={fleet.status==='COMBAT'||fleet.status==='RETREATING'} onClick={onReturn}>Return to Port</button><button disabled={fleet.status==='COMBAT'||fleet.status==='RETREATING'} onClick={onCancel}>Cancel Order</button></>}</div>
    {owner&&<p className="naval-panel__hint">Ative Naval Mode e clique com o botão direito num SeaNode para mover ou num porto para atracar.</p>}
  </aside>;
}
export function NavalBattlePanel({battle,fleets,onLocate,onClose}:{battle:NavalBattle;fleets:readonly Fleet[];onLocate:()=>void;onClose:()=>void}) {
  const side=(ids:string[])=>ids.map(id=>{const f=fleets.find(f=>f.id===id);return f?`${f.name} (${fleetStrength(f).toFixed(0)})`:`${id} · destruída`;}).join(', ');
  return <aside className="naval-panel" aria-label="Naval battle panel"><div className="naval-panel__header"><h3>Batalha naval</h3><button onClick={onClose} aria-label="Fechar batalha naval">✕</button></div><p>{battle.seaNodeId} · {battle.status} · {battle.days} dias</p><p>A: {side(battle.sideA)}</p><p>B: {side(battle.sideB)}</p><p>Perdas: A {battle.lossesA.toFixed(0)} / B {battle.lossesB.toFixed(0)}</p>{battle.winner&&<p>Resultado: {battle.winner}</p>}<button onClick={onLocate}>Locate Battle</button></aside>;
}
