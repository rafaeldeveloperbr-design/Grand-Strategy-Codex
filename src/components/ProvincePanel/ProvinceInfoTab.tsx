import React from 'react';
import { Province, Country, Army } from '../../types';
import { calculateArmySize } from '../../engine/combat';
import { getUnrestDescription, getUnrestColor, isProvincePacified } from '../../engine/unrest';
import { normalizePopulation } from '../../engine/population';
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
}

export const ProvinceInfoTab: React.FC<ProvinceInfoTabProps> = ({
  province,
  ownerCountry,
  armiesHere,
  neighborProvinces,
  onProvinceClick,
}) => {
  const unrest = province.unrest ?? 0;
  const isPacified = isProvincePacified(province);
  const population = normalizePopulation(province.population);
  const workforce = population.employed + population.unemployed;
  const unemploymentRate = workforce > 0 ? population.unemployed / workforce * 100 : 0;

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
            {population.total.toLocaleString()} / {province.maxPopulation.toLocaleString()}
          </span>
        </div>
        <div className="province-panel__pop-bar">
          <div
            className="province-panel__pop-fill"
            style={{
              width: `${(population.total / province.maxPopulation) * 100}%`,
              backgroundColor: ownerCountry?.color ?? '#666',
            }}
          />
        </div>
        <div className="province-panel__info-row"><span className="province-panel__label">Empregados:</span><span className="province-panel__value">{population.employed.toLocaleString()}</span></div>
        <div className="province-panel__info-row"><span className="province-panel__label">Desempregados:</span><span className="province-panel__value">{population.unemployed.toLocaleString()} ({unemploymentRate.toFixed(1)}%)</span></div>
        <div className="province-panel__info-row"><span className="province-panel__label">Crescimento:</span><span className="province-panel__value">{(population.growthRate * 100).toFixed(2)}%/dia</span></div>
        <div className="province-panel__info-row"><span className="province-panel__label">Satisfação:</span><span className="province-panel__value">{Math.round(population.satisfaction)}%</span></div>
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
              🏘️ Habitação adequada: pressão social reduzida
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
