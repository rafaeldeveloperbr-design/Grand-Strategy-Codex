import React from 'react';
import { Province, Country, Army } from '../../types';
import { calculateArmySize } from '../../engine/combat';
import { getUnrestDescription, getUnrestColor, isProvincePacified } from '../../engine/unrest';
import { calculateSatisfactionBreakdown, getPopulationCapacity, normalizePopulation } from '../../engine/population';
import { calculateDailyPopulationGrowthBreakdown } from '../../engine/economy';
import { calculateTechnologyBonuses, calculateTechBonuses } from '../../engine/technology';
import type { CountryTechState } from '../../types/technology';
import { ProvinceMarketSection } from './ProvinceMarketSection';

interface ProvinceInfoTabProps {
  province: Province;
  ownerCountry?: Country;
  armiesHere: Army[];
  neighborProvinces: Array<{
    id: string;
    country?: Country;
  }>;
  onProvinceClick: (provinceId: string) => void;
  techState?: CountryTechState;
}

export const ProvinceInfoTab: React.FC<ProvinceInfoTabProps> = ({
  province,
  ownerCountry,
  armiesHere,
  neighborProvinces,
  onProvinceClick,
  techState,
}) => {
  const unrest = province.unrest ?? 0;
  const isPacified = isProvincePacified(province);
  const population = normalizePopulation(province.population);
  const workforce = population.employed + population.unemployed;
  const unemploymentRate = workforce > 0 ? population.unemployed / workforce * 100 : 0;
  const combinedBonuses = techState ? calculateTechBonuses(techState) : undefined;
  const technologyBonuses = techState ? calculateTechnologyBonuses(techState) : undefined;
  const baseCapacity = getPopulationCapacity(province);
  const effectiveCapacity = getPopulationCapacity(province, combinedBonuses?.populationCapacityMultiplier);
  const growth = ownerCountry ? calculateDailyPopulationGrowthBreakdown(province, ownerCountry, combinedBonuses) : undefined;
  const dailyGrowth = growth?.finalGrowth ?? 0;
  const satisfaction = calculateSatisfactionBreakdown(province, ownerCountry?.activeLaws?.taxation || 'taxation_normal', {
    countryStability: ownerCountry?.resources.stability,
  });
  const growthTechPercent = ((technologyBonuses?.populationGrowthMultiplier ?? 1) - 1) * 100;
  const capacityTechPercent = ((technologyBonuses?.populationCapacityMultiplier ?? 1) - 1) * 100;

  return (
    <>
      {/* Informações Gerais */}
      <div className="province-panel__section">
        <div className="province-panel__info-row">
          <span className="province-panel__label">País:</span>
          <span className="province-panel__value province-panel__value--country">
            {ownerCountry?.flag} {ownerCountry?.name ?? 'Desconhecido'}
          </span>
        </div>
        <div className="province-panel__info-row">
          <span className="province-panel__label">Desenvolvimento:</span>
          <span className="province-panel__value">
            {'⭐'.repeat(Math.min(province.development, 5))}
          </span>
        </div>
        <div className="province-panel__info-row">
          <span className="province-panel__label">Defesa:</span>
          <span className="province-panel__value">🛡️ {province.defense}</span>
        </div>
      </div>

      {/* População */}
      <div className="province-panel__section">
        <h3 className="province-panel__subtitle">População</h3>
        <div className="province-panel__info-row">
          <span className="province-panel__label">Habitantes:</span>
          <span className="province-panel__value">
            {population.total.toLocaleString()} / {effectiveCapacity.toLocaleString()}
          </span>
        </div>
        <div className="province-panel__pop-bar">
          <div
            className="province-panel__pop-fill"
            style={{
              width: `${Math.min(100, effectiveCapacity > 0 ? population.total / effectiveCapacity * 100 : 100)}%`,
              backgroundColor: ownerCountry?.color ?? '#666',
            }}
          />
        </div>
        <div className="province-panel__info-row"><span className="province-panel__label">Empregados:</span><span className="province-panel__value">{population.employed.toLocaleString()}</span></div>
        <div className="province-panel__info-row"><span className="province-panel__label">Desempregados:</span><span className="province-panel__value">{population.unemployed.toLocaleString()} ({unemploymentRate.toFixed(1)}%)</span></div>
        <div className="province-panel__info-row" title={growth ? `Base: ${(growth.baseRate * 100).toFixed(3)}% • FOOD: ${(growth.foodRate * 100).toFixed(3)}% • Capacidade: ${(growth.capacityRate * 100).toFixed(3)}% • Satisfação: ${(growth.satisfactionRate * 100).toFixed(3)}% • Estabilidade: ${(growth.stabilityRate * 100).toFixed(3)}% • Guerra: ${(growth.warRate * 100).toFixed(3)}% • Leis/Tecnologia: ×${growth.technologyAndLawMultiplier.toFixed(2)}` : undefined}><span className="province-panel__label">📈 Crescimento:</span><span className="province-panel__value">{dailyGrowth >= 0 ? '+' : ''}{Math.floor(dailyGrowth).toLocaleString()} / dia</span></div>
        {growthTechPercent !== 0 && <div className="province-panel__info-row"><span className="province-panel__label">Tecnologia:</span><span className="province-panel__value">+{Math.round(growthTechPercent)}%</span></div>}
        <div className="province-panel__info-row" title={`Base: ${baseCapacity.toLocaleString()} • Final: ${effectiveCapacity.toLocaleString()}`}><span className="province-panel__label">🏠 Capacidade:</span><span className="province-panel__value">{effectiveCapacity.toLocaleString()}</span></div>
        {capacityTechPercent !== 0 && <div className="province-panel__info-row"><span className="province-panel__label">Tecnologia:</span><span className="province-panel__value">+{Math.round(capacityTechPercent)}%</span></div>}
        <div className="province-panel__info-row" title={`Emprego: ${satisfaction.unemployment.toFixed(1)} • FOOD: ${satisfaction.food.toFixed(1)} • Impostos: ${satisfaction.taxation.toFixed(1)} • Economia: ${satisfaction.economy.toFixed(1)} • Estabilidade: ${satisfaction.stability.toFixed(1)} • Guerra: ${satisfaction.war.toFixed(1)}`}><span className="province-panel__label">Satisfação:</span><span className="province-panel__value">{Math.round(population.satisfaction)}%</span></div>
        {!!population.migrationNet && <div className="province-panel__info-row"><span className="province-panel__label">Migração:</span><span className="province-panel__value">{population.migrationNet > 0 ? '+' : ''}{population.migrationNet.toLocaleString()}</span></div>}
      </div>

      <ProvinceMarketSection province={province} />

      {/* Agitação Provincial */}
      <div className="province-panel__section">
        <h3 className="province-panel__subtitle">
          {isPacified ? '🕊️ Província Pacífica' : '🔥 Agitação Provincial'}
        </h3>
        <div className="province-panel__info-row">
          <span className="province-panel__label">Nível:</span>
          <span
            className="province-panel__value"
            style={{ color: getUnrestColor(unrest) }}
          >
            {getUnrestDescription(unrest)} ({Math.round(unrest)}%)
          </span>
        </div>
        <div className="province-panel__pop-bar">
          <div
            className="province-panel__pop-fill"
            style={{
              width: `${unrest}%`,
              backgroundColor: getUnrestColor(unrest),
            }}
          />
        </div>
        {!isPacified && (
          <div className="province-panel__info-row" style={{ marginTop: '8px' }}>
            <span className="province-panel__label" style={{ fontSize: '10px' }}>
              {unrest >= 80
                ? '⚠️ Revolta iminente!'
                : unrest >= 60
                ? '⚠️ Alta instabilidade'
                : '📉 Decaindo naturalmente...'}
            </span>
          </div>
        )}
        {province.buildings.some((b) => b.type === 'housing') && (
          <div className="province-panel__info-row" style={{ marginTop: '4px' }}>
            <span className="province-panel__label" style={{ fontSize: '10px', color: '#2ecc71' }}>
              ⛪ Templo ativo: pacificação acelerada
            </span>
          </div>
        )}
      </div>

      {/* Exércitos presentes (resumo) */}
      {armiesHere.length > 0 && (
        <div className="province-panel__section">
          <h3 className="province-panel__subtitle">Tropas Presentes</h3>
          {armiesHere.map((army) => (
            <div key={army.id} className="province-panel__army-summary">
              <span>{ownerCountry?.flag} {army.name}</span>
              <span className="province-panel__army-size">
                {calculateArmySize(army).toLocaleString()} 👥
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Fronteiras */}
      <div className="province-panel__section">
        <h3 className="province-panel__subtitle">
          Fronteiras ({province.neighbors.length})
        </h3>
        <div className="province-panel__neighbors">
          {neighborProvinces.map((neighbor) => (
            <button
              key={neighbor.id}
              className="province-panel__neighbor-btn"
              onClick={() => onProvinceClick(neighbor.id)}
              style={{ borderLeftColor: neighbor.country?.color ?? '#666' }}
            >
              <span>{neighbor.country?.flag ?? '?'}</span>
              <span className="province-panel__neighbor-id">{neighbor.id}</span>
              <span className="province-panel__neighbor-country">
                {neighbor.country?.adjective ?? '???'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
