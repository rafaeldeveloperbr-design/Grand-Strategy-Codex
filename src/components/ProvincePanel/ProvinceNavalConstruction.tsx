import { useState } from 'react';
import type { Country, Province } from '../../types';
import type { NavalState, NavalUnitType } from '../../types/naval';
import { navalConstructionBlockReason, shipyardLevel } from '../../engine/naval/construction';
import { NAVAL_BUILD_CONFIG, SHIPYARD_SPEED, SHIPYARD_UPGRADES } from '../../data/navalConstruction';
export function ProvinceNavalConstruction({ province, country, actor, naval, onBuild, onCancel }: {
  province: Province; country: Country; actor: string; naval: NavalState;
  onBuild?: (provinceId: string, type: NavalUnitType | 'UPGRADE', targetFleetId?: string) => void; onCancel?: (id: string) => void;
}) {
  const [target, setTarget] = useState('');
  const level = shipyardLevel(naval,province.id), own = province.owner===actor;
  const builds = naval.construction?.builds.filter(b=>b.provinceId===province.id) ?? [];
  const upgrade = naval.construction?.upgrades.find(u=>u.provinceId===province.id);
  const reason = (type: NavalUnitType|'UPGRADE') => navalConstructionBlockReason(naval,province,country,actor,type);
  const upgradeCost = SHIPYARD_UPGRADES[level];
  return <section aria-label="Naval construction">
    <h4>Shipyard · nível {level} · velocidade {SHIPYARD_SPEED[level]}×</h4>
    <p>Estoque local: IRON {Math.floor(province.market?.goods.iron.stock??0)} · TOOLS {Math.floor(province.market?.goods.tools.stock??0)}. Ouro nacional: {Math.floor(country.resources.gold)}.</p>
    <p>Pagamento ao encomendar. Cancelamento sem reembolso. Uma produção por porto; até 5 navios na fila.</p>
    {own&&<label>Destino dos reforços <select aria-label="Reinforcement fleet" value={target} onChange={e=>setTarget(e.target.value)}><option value="">Frota docked disponível / nova frota</option>{naval.fleets.filter(f=>f.countryTag===actor&&f.status==='DOCKED'&&f.portProvinceId===province.id).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}
    {upgrade&&<p>Upgrade → nível {upgrade.targetLevel}: {Math.floor(upgrade.progress/upgrade.requiredProgress*100)}% · produção pausada {own&&<button onClick={()=>onCancel?.(upgrade.id)}>Cancelar upgrade</button>}</p>}
    <button disabled={!onBuild||!!reason('UPGRADE')} title={reason('UPGRADE')??`Upgrade: ${upgradeCost?.gold} ouro, ${upgradeCost?.iron} IRON, ${upgradeCost?.tools} TOOLS, ${upgradeCost?.days} dias`} onClick={()=>onBuild?.(province.id,'UPGRADE')}>Upgrade Shipyard</button>
    {reason('UPGRADE')&&<small>{reason('UPGRADE')}</small>}
    {(Object.keys(NAVAL_BUILD_CONFIG) as NavalUnitType[]).map(type=>{
      const c=NAVAL_BUILD_CONFIG[type], block=reason(type);
      return <div key={type}><button disabled={!onBuild||!!block} title={block??'Encomendar navio'} onClick={()=>onBuild?.(province.id,type,target||undefined)}>Build {c.label}</button> <small>{c.gold} ouro · {c.iron} IRON · {c.tools} TOOLS · {level?Math.ceil(c.days/SHIPYARD_SPEED[level]):c.days} dias · {block??'Disponível'}</small></div>;
    })}
    <ol aria-label="Naval build queue">{builds.map((b,i)=><li key={b.id}>{NAVAL_BUILD_CONFIG[b.unitType].label} · {Math.floor(b.progress/b.requiredProgress*100)}% · {upgrade?'Pausado':i?'Na fila':'Ativo'} {b.targetFleetId&&<span>→ {naval.fleets.find(f=>f.id===b.targetFleetId)?.name??'Fallback no porto'}</span>} {own&&<button aria-label={`Cancel naval build ${b.id}`} onClick={()=>onCancel?.(b.id)}>Cancelar</button>}</li>)}</ol>
  </section>;
}
