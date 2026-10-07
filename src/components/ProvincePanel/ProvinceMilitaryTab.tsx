import React from 'react';
import { getProvinceLogistics, type LogisticsSnapshot } from '../../engine/logistics';
import { Province, Country, Army, UnitType } from '../../types';
import { UNIT_DEFINITIONS, RECRUITABLE_UNIT_IDS, getUnitTechnologyName } from '../../data/units';
import { calculateArmyMorale, calculateArmyOrganization, calculateArmySize, getArmySupply, getEffectiveRecruitmentCost, getRecruitmentBlockReason } from '../../engine/military';
import type { CountryTechState } from '../../types/technology';

interface ProvinceMilitaryTabProps {
  logistics?: LogisticsSnapshot;
  province: Province;
  playerCountry: Country;
  armiesHere: Army[];
  technology: CountryTechState;
  onRecruit: (provinceId: string, unitType: UnitType) => void;
}

export const ProvinceMilitaryTab: React.FC<ProvinceMilitaryTabProps> = ({
  logistics,
  province,
  playerCountry,
  armiesHere,
  technology,
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
                    {UNIT_DEFINITIONS[reg.type].icon} {Math.floor(reg.strength)} · ORG {Math.round(reg.organization ?? UNIT_DEFINITIONS[reg.type].maxOrganization)}
                  </span>
                ))}
              </div>
              <div className="province-panel__build-desc">Moral {Math.round(calculateArmyMorale(army))} · Organização {Math.round(calculateArmyOrganization(army))} · Supply {`${Math.round(getArmySupply(army, province, armiesHere, logistics).ratio*100)}%`}</div>
              {getProvinceLogistics(logistics,army.owner,province.id) && <div className="province-panel__build-desc">Logística: {getProvinceLogistics(logistics,army.owner,province.id)?.connected ? 'Conectada' : 'Desconectada'} · Distância: {getProvinceLogistics(logistics,army.owner,province.id)?.distance ?? '—'}</div>}
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
          {RECRUITABLE_UNIT_IDS.map((type) => {
            const def = UNIT_DEFINITIONS[type];
            const context = { country: playerCountry, province, technology };
            const cost = getEffectiveRecruitmentCost(type, context);
            const cantRecruitReason = getRecruitmentBlockReason(type, context);
            const canRecruit = cantRecruitReason === null;

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
                      {def.role} ATK {def.attack} · DEF {def.defense} · CHOQUE {def.shock} · CERCO {def.siege}
                    </span>
                  </div>
                </div>
                <div className="province-panel__build-desc">
                  Força {def.maxStrength} · Mobilidade {def.mobility} · Supply {def.supplyUse} · Manutenção {def.maintenance}/dia
                  <br />Requisitos: {def.requiredArsenalLevel ? `Arsenal Militar nível ${def.requiredArsenalLevel}` : 'Sem Arsenal'}
                  {def.requiredTechnology ? ` · Tecnologia: ${getUnitTechnologyName(def.requiredTechnology)}` : ''}
                </div>
                <div className="province-panel__build-costs">
                  <span className="province-panel__build-cost">💰 {cost.gold}</span>
                  <span className="province-panel__build-cost">👥 {cost.manpower}</span>
                  <span className="province-panel__build-cost">⛓️ {cost.iron}</span>
                  <span className="province-panel__build-cost">🔧 {cost.tools}</span>
                  <span className="province-panel__build-cost">📅 {cost.days}d</span>
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
