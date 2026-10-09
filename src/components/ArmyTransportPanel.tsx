import { useMemo, useState } from 'react';
import type { ActiveBattle, Army, DiplomaticRelation, Province, War } from '../types';
import type { Fleet, NavalState } from '../types/naval';
import { buildNavalIndexes, buildTransportIndexes, fleetTransportCapacity, fleetTransportUsed, getArmyEmbarkError, portByProvince, coastalLandingError, resolveAmphibiousLandingSeaNode, AMPHIBIOUS_BEACH_EXTRACTION_DAYS, BEACH_EXTRACTION_LABEL, FRIENDLY_BEACH_LANDING_LABEL, AMPHIBIOUS_FRIENDLY_BEACH_LANDING_DAYS } from '../engine/naval';

type Props = {
  army: Army; armies: Army[]; fleets: Fleet[]; provinces: Province[]; owner: boolean;
  navalState?: NavalState; wars?: War[]; relations?: DiplomaticRelation[]; activeBattles?: readonly ActiveBattle[];
  onEmbark: (fleetId: string) => void; onDisembark: () => void; onCancelExtraction?: () => void; onCancelFriendlyLanding?: () => void;
};
export function ArmyTransportPanel({ army, armies, fleets, provinces, owner, navalState, wars = [], relations = [], activeBattles = [], onEmbark, onDisembark, onCancelExtraction, onCancelFriendlyLanding }: Props) {
  const [chosen, setChosen] = useState('');
  const fleetIndexes = useMemo(() => buildNavalIndexes(fleets), [fleets]);
  const cargo = useMemo(() => buildTransportIndexes(armies), [armies]);
  if (army.embarkedFleetId) {
    const fleet = fleetIndexes.byId.get(army.embarkedFleetId);
    return <section aria-label="Army transport"><p>Embarked on {fleet?.name ?? army.embarkedFleetId}</p><p>{fleet?.status} · {provinces.find(p => p.id === fleet?.portProvinceId)?.name ?? fleet?.locationSeaNodeId ?? 'Em movimento naval'}</p>{army.friendlyBeachLanding ? <><p>{FRIENDLY_BEACH_LANDING_LABEL}</p><p>{provinces.find(p => p.id === army.friendlyBeachLanding!.provinceId)?.name} {army.friendlyBeachLanding.elapsedDays}/{AMPHIBIOUS_FRIENDLY_BEACH_LANDING_DAYS} dias</p>{owner && <button onClick={onCancelFriendlyLanding}>Cancelar desembarque</button>}</> : owner && <>{fleet?.status === 'DOCKED' && <><p>Desembarcar pelo porto</p><button onClick={onDisembark}>Disembark</button></>}<p>Clique com o botão direito numa província costeira amiga para desembarcar.</p></>}</section>;
  }
  if (army.beachExtraction) {
    const order = army.beachExtraction, fleet = fleetIndexes.byId.get(order.fleetId);
    return <section aria-label="Army transport"><p>{BEACH_EXTRACTION_LABEL}</p><p>{fleet?.name ?? order.fleetId} · {order.elapsedDays}/{AMPHIBIOUS_BEACH_EXTRACTION_DAYS} dias</p><p>Army permanece na província durante a extração.</p>{owner && <button onClick={onCancelExtraction}>Cancelar extração</button>}</section>;
  }
  if (!owner || !army.location) return null;
  const port = portByProvince.has(army.location), node = resolveAmphibiousLandingSeaNode(army.location);
  const coastError = coastalLandingError(army.location);
  if (!port && coastError) return <section aria-label="Army transport"><p>{coastError}</p></section>;
  const candidates = (port ? fleetIndexes.byPort.get(army.location) ?? [] : fleetIndexes.bySeaNode.get(node!.id) ?? [])
    .filter(f => f.countryTag === army.owner && (!port || f.status === 'DOCKED'))
    .sort((a,b) => a.id.localeCompare(b.id));
  if (!candidates.length) {
    if (port) return null; // Preserve the existing docked-port UI.
    const ownFleet = fleetIndexes.byCountry.get(army.owner)?.[0];
    const error = ownFleet ? getArmyEmbarkError({ armies, naval: navalState ?? { fleets, battles: [] }, provinces, wars, relations, activeBattles, actor: army.owner }, army.id, ownFleet.id) : 'Nenhuma Fleet própria na costa.';
    return <section aria-label="Army transport"><p>{BEACH_EXTRACTION_LABEL}</p><p>{error ?? 'Fleet não está parada no SeaNode correto da costa.'}</p></section>;
  }
  const fleetId = candidates.some(f => f.id === chosen) ? chosen : candidates[0].id;
  const error = getArmyEmbarkError({ armies, naval: navalState ?? { fleets, battles: [] }, provinces, wars, relations, activeBattles, actor: army.owner }, army.id, fleetId);
  return <section aria-label="Army transport">{!port && <p>{BEACH_EXTRACTION_LABEL}</p>}<label>Fleet <select aria-label="Embark Fleet" value={fleetId} onChange={e => setChosen(e.target.value)}>{candidates.map(f => {
    const total = fleetTransportCapacity(f), used = fleetTransportUsed(cargo.byFleet.get(f.id) ?? []), reserved = fleetTransportUsed(cargo.extractionsByFleet.get(f.id) ?? []);
    return <option key={f.id} value={f.id}>{f.name} · Total {total} · Usada {used} · Reservada {reserved} · Disponível {total - used - reserved}</option>;
  })}</select></label><button disabled={!!error} onClick={() => onEmbark(fleetId)}>Embark</button>{error && <p>{error}</p>}</section>;
}
