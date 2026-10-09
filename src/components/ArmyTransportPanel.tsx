import { useState } from 'react';
import type { Army, Province } from '../types';
import type { Fleet } from '../types/naval';
import { buildTransportIndexes, fleetTransportCapacity, fleetTransportUsed, portByProvince } from '../engine/naval';

export function ArmyTransportPanel({ army, armies, fleets, provinces, owner, onEmbark, onDisembark }: { army: Army; armies: Army[]; fleets: Fleet[]; provinces: Province[]; owner: boolean; onEmbark: (fleetId: string) => void; onDisembark: () => void }) {
  const [chosen, setChosen] = useState('');
  const cargo = buildTransportIndexes(armies);
  if (army.embarkedFleetId) {
    const fleet = fleets.find(f => f.id === army.embarkedFleetId);
    return <section aria-label="Army transport"><p>Embarked on {fleet?.name ?? army.embarkedFleetId}</p><p>{fleet?.status} · {provinces.find(p => p.id === fleet?.portProvinceId)?.name ?? fleet?.locationSeaNodeId ?? 'Em movimento naval'}</p>{owner && fleet?.status === 'DOCKED' && <button onClick={onDisembark}>Disembark</button>}</section>;
  }
  if (!owner || !army.location || !portByProvince.has(army.location)) return null;
  const candidates = fleets.filter(f => f.countryTag === army.owner && f.status === 'DOCKED' && f.portProvinceId === army.location);
  if (!candidates.length) return null;
  const fleetId = candidates.some(f => f.id === chosen) ? chosen : candidates[0].id;
  return <section aria-label="Army transport"><label>Fleet <select aria-label="Embark Fleet" value={fleetId} onChange={e => setChosen(e.target.value)}>{candidates.map(f => { const total = fleetTransportCapacity(f), used = fleetTransportUsed(cargo.byFleet.get(f.id) ?? []); return <option key={f.id} value={f.id}>{f.name} · Total {total} · Usada {used} · Disponível {total - used}</option>; })}</select></label><button disabled={army.inCombat} onClick={() => onEmbark(fleetId)}>Embark</button></section>;
}
