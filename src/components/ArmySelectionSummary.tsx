import type { Army, Province } from '../types';
import type { ReactNode } from 'react';
import type { LogisticsSnapshot } from '../engine/logistics';
import {
  calculateArmySize,
  calculateArmyOrganization,
  calculateArmyMorale,
  getArmySupply,
} from '../engine/military';
import { armyComposition } from './militaryPresentation';

export function ArmySelectionSummary({
  armies,
  allArmies,
  provinces,
  logistics,
  onClear,
  onClearRoutes,
  children,
}: {
  armies: Army[];
  allArmies: Army[];
  provinces: Province[];
  logistics?: LogisticsSnapshot;
  onClear: () => void;
  onClearRoutes?: () => void;
  children?: ReactNode;
}) {
  const total = armies.reduce((sum, army) => sum + calculateArmySize(army), 0);

  const average = (read: (army: Army) => number) =>
    total
      ? armies.reduce(
          (sum, army) => sum + read(army) * calculateArmySize(army),
          0,
        ) / total
      : 0;

  const supply = average(
    army =>
      getArmySupply(
        army,
        provinces.find(province => province.id === army.location),
        allArmies,
        logistics,
      ).ratio * 100,
  );

  const composition = armyComposition(armies);

  return (
  <aside
    className="army-info-panel army-info-panel--multi"
    aria-label="Seleção múltipla de exércitos"
  >
    <div className="army-info-panel__header">
      <div>
        <h3>{armies.length} exércitos selecionados</h3>
        <span>{Math.round(total).toLocaleString('pt-BR')} homens</span>
      </div>

      <button
        type="button"
        onClick={onClear}
        aria-label="Limpar seleção"
      >
        ✕
      </button>
    </div>

    <div className="army-info-panel__content">
      <div className="army-info-panel__stats">
        <div className="army-info-panel__stat">
          <span>Organização média</span>
          <strong>{Math.round(average(calculateArmyOrganization))}%</strong>
        </div>

        <div className="army-info-panel__stat">
          <span>Moral média</span>
          <strong>{Math.round(average(calculateArmyMorale))}%</strong>
        </div>

        <div className="army-info-panel__stat">
          <span>Supply médio</span>
          <strong>{Math.round(supply)}%</strong>
        </div>
      </div>

      <div className="army-info-panel__regiments">
        <h4>Composição</h4>

        {composition.map(regiment => (
          <div key={regiment.type} className="army-info-panel__stat">
            <span>{regiment.name}</span>
            <strong>
              {Math.round(regiment.troops).toLocaleString('pt-BR')}
            </strong>
          </div>
        ))}
      </div>

      {children}
      <div className="army-info-panel__group-command">
        <strong>Comando em grupo</strong>
        <span>{armies.filter(a => a.destination && !a.inCombat).length} com rota ativa · {armies.filter(a => !a.destination || a.inCombat).length} sem movimento ativo</span>
        <span>Direito: mover/substituir · Shift+direito: adicionar waypoint para todos.</span>
        {onClearRoutes && <button type="button" className="army-info-panel__action-btn" onClick={onClearRoutes}>Limpar rotas</button>}
        <small>Cada exército mantém sua própria rota.</small>
      </div>
    </div>
  </aside>
);
}
