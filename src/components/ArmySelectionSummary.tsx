import type { Army, Province } from '../types';
import type { LogisticsSnapshot } from '../engine/logistics';
import { calculateArmySize, calculateArmyOrganization, calculateArmyMorale, getArmySupply } from '../engine/military';
import { armyComposition } from './militaryPresentation';

export function ArmySelectionSummary({ armies, allArmies, provinces, logistics, onClear }: { armies: Army[]; allArmies: Army[]; provinces: Province[]; logistics?: LogisticsSnapshot; onClear: () => void }) {
  const total = armies.reduce((sum, a) => sum + calculateArmySize(a), 0);
  const average = (read: (a: Army) => number) => total ? armies.reduce((sum, a) => sum + read(a) * calculateArmySize(a), 0) / total : 0;
  const supply = average(a => getArmySupply(a, provinces.find(p => p.id === a.location), allArmies, logistics).ratio * 100);
  return <aside className="army-info-panel" aria-label="Seleção múltipla de exércitos">
    <div className="army-info-panel__header"><h3>{armies.length} exércitos selecionados</h3><button type="button" onClick={onClear} aria-label="Limpar seleção">✕</button></div>
    <div className="army-info-panel__stats">
      <div className="army-info-panel__stat"><span>Tropas:</span><strong>{Math.round(total).toLocaleString('pt-BR')}</strong></div>
      <div className="army-info-panel__stat"><span>Organização média:</span><strong>{Math.round(average(calculateArmyOrganization))}%</strong></div>
      <div className="army-info-panel__stat"><span>Moral média:</span><strong>{Math.round(average(calculateArmyMorale))}%</strong></div>
      <div className="army-info-panel__stat"><span>Supply médio:</span><strong>{Math.round(supply)}%</strong></div>
    </div>
    <div className="army-info-panel__regiments"><h4>Composição</h4>{armyComposition(armies).map(r => <div key={r.type} className="army-info-panel__stat"><span>{r.name}</span><span>{Math.round(r.troops).toLocaleString('pt-BR')}</span></div>)}</div>
    <p>Clique direito no mapa para mover os selecionados. Cada exército mantém sua própria rota.</p>
  </aside>;
}
