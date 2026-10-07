import type { Army, Province } from '../types';

export function ArmyMovementPlanPanel({ army, provinces, onClear }: { army: Army; provinces: Province[]; onClear: () => void }) {
  const name = (id: string) => provinces.find(p => p.id === id)?.name ?? id;
  const waypoints = army.movementPlan?.waypoints ?? [];
  const final = waypoints[waypoints.length - 1] ?? army.targetDestination ?? army.destination;
  return <section className="army-movement-plan" aria-label="Plano de movimento">
    <div className="army-info-panel__stat"><span>Destino atual:</span><span>{army.destination ? name(army.destination) : army.inCombat && waypoints.length ? 'Pausado em batalha' : 'Parado'}</span></div>
    {final ? <div className="army-info-panel__stat"><span>Destino final:</span><span>{name(final)}</span></div> : <p>Sem rota planejada</p>}
    {waypoints.length > 0 && <><p>Rota: {waypoints.length} pontos restantes</p><ol>{waypoints.map((id, index) => <li key={`${index}-${id}`}>{name(id)}</li>)}</ol></>}
    {(army.destination || waypoints.length > 0) && <button type="button" className="army-info-panel__action-btn" onClick={onClear}>Limpar rota</button>}
    <small>Direito: mover/substituir · Shift+direito: adicionar waypoint</small>
  </section>;
}
