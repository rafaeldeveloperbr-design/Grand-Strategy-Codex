import React from 'react';
import { Province, Country, Army, UnitType } from '../../types';
import { UNIT_DEFINITIONS } from '../../data/units';
import { calculateArmySize } from '../../engine/combat';

interface ProvinceMilitaryTabProps {
  province: Province;
  playerCountry: Country;
  armiesHere: Army[];
  onRecruit: (provinceId: string, unitType: UnitType) => void;
}

export const ProvinceMilitaryTab: React.FC<ProvinceMilitaryTabProps> = ({
  province,
  playerCountry,
  armiesHere,
  onRecruit,
}) => {
  return (
    <>
      {/* Exércitos presentes */}
      <div className="province-panel__section">
        <h3 className="province-panel__subtitle">Exércitos na Província</h3>
        {armiesHere.length === 0 ? (
          <p className="province-panel__no-armies">Nenhum exército presente</p>
        ) : (
          armiesHere.map((army) => (
            <div key={army.id} className="province-panel__army-card">
              <div className="province-panel__army-card-header">
                <span>{army.name}</span>
                <span className="province-panel__army-card-size">
                  {calculateArmySize(army).toLocaleString()} 👥
                </span>
              </div>
              <div className="province-panel__army-card-regiments">
                {army.regiments.map((reg, i) => (
                  <span key={i} className="province-panel__regiment-badge">
                    {reg.type === 'infantry' ? '🗡️' : reg.type === 'cavalry' ? '🐎' : '💣'}
                    {Math.floor(reg.strength)}
                  </span>
                ))}
              </div>
              {army.destination && (
                <div className="province-panel__army-card-moving">
                  🚶 Marchando... ({Math.round(army.movementProgress * 100)}%)
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Recrutar novas unidades */}
      <div className="province-panel__section">
        <h3 className="province-panel__subtitle">Recrutar Unidades</h3>
        <div className="province-panel__build-options">
          {(Object.keys(UNIT_DEFINITIONS) as UnitType[]).map((type) => {
            const def = UNIT_DEFINITIONS[type];
            const canAffordGold = playerCountry.resources.gold >= def.cost;
            const canAffordManpower = playerCountry.resources.manpower >= def.manpowerCost;
            const canAffordIron = (province.market?.goods.iron.stock ?? 0) >= def.ironCost;
            const canAffordTools = (province.market?.goods.tools.stock ?? 0) >= def.toolsCost;
            const canRecruit = canAffordGold && canAffordManpower && canAffordIron && canAffordTools;
            const cantRecruitReason = !canAffordGold
              ? 'Ouro insuficiente'
              : !canAffordManpower
              ? 'Manpower insuficiente'
              : !canAffordIron ? 'IRON insuficiente'
              : !canAffordTools ? 'TOOLS insuficiente'
              : null;

            return (
              <div
                key={type}
                className={`province-panel__build-option ${
                  !canRecruit ? 'province-panel__build-option--disabled' : ''
                }`}
              >
                <div className="province-panel__build-option-header">
                  <span className="province-panel__build-icon">{def.icon}</span>
                  <div className="province-panel__build-info">
                    <span className="province-panel__build-name">{def.name}</span>
                    <span className="province-panel__build-desc">
                      ATK:{def.attack} DEF:{def.defense} MOB:{def.mobility}
                    </span>
                  </div>
                </div>
                <div className="province-panel__build-costs">
                  <span className="province-panel__build-cost">💰 {def.cost}</span>
                  <span className="province-panel__build-cost">👥 {def.manpowerCost}</span>
                  <span className="province-panel__build-cost">⛏️ {def.ironCost}</span>
                  <span className="province-panel__build-cost">🔧 {def.toolsCost}</span>
                  <span className="province-panel__build-cost">📅 {def.trainingTime}d</span>
                </div>
                <button
                  className="province-panel__build-btn"
                  disabled={!canRecruit}
                  onClick={() => onRecruit(province.id, type)}
                >
                  {cantRecruitReason ?? '🗡️ Recrutar'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
