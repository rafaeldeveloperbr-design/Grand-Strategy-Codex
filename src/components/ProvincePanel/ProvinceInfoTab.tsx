import React from 'react';
import { REBELLION_BALANCE, REBEL_TYPE_LABELS, OBJECTIVE_LABELS, UNREST_SOURCE_LABELS, type RebellionAction, type RebellionFaction } from '../../engine/rebellion';
import { Province, Country, Army } from '../../types';
import { calculateArmySize } from '../../engine/combat';
import { getUnrestDescription, getUnrestColor, isProvincePacified } from '../../engine/unrest';
import { calculateSatisfactionBreakdown, getPopulationCapacity, normalizePopulation } from '../../engine/population';
import { calculateDailyPopulationGrowthBreakdown } from '../../engine/economy';
import { calculateTechnologyBonuses, calculateTechBonuses } from '../../engine/technology';
import type { CountryTechState } from '../../types/technology';
import { ProvinceMarketSection } from './ProvinceMarketSection';

interface ProvinceInfoTabProps {
  faction?: RebellionFaction;
  factionArmies?: Army[];
  provinces?: Province[];
  onRebellionAction?: (provinceId: string, action: RebellionAction) => void;
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
  onRebellionAction,
  faction,
  factionArmies = [],
  provinces = [],
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
        <div className="province-panel__info-row"><span>Organização rebelde:</span><strong>{Math.round(province.rebellion?.progress ?? 0)}%</strong></div>
        <div className="province-panel__info-row"><span>Autonomia / ressentimento:</span><strong>{Math.round(province.rebellion?.autonomy ?? 0)} / {Math.round(province.rebellion?.resentment ?? 0)}</strong></div>
        {faction?.status === 'active' && <p>{REBEL_TYPE_LABELS[faction.type]}: {OBJECTIVE_LABELS[faction.objective.kind]} · {faction.militaryStrength.toLocaleString()} tropas · Controle {faction.objective.heldDays}/{faction.objective.requiredDays} dias</p>}
        {faction?.status === 'active' && <p>Reforços: +{faction.reinforcementRate ?? 0}/dia · Mobilizados: {faction.recruitedTroops ?? 0}</p>}
        {faction?.status === 'active' && <div>
          <p>Província envolvida na revolta. Origem: {provinces.find(p => p.id === faction.originProvince)?.name ?? faction.originProvince}.</p>
          {factionArmies.map(army => <p key={army.id}>Exército rebelde: {calculateArmySize(army).toLocaleString()} tropas em {provinces.find(p => p.id === army.location)?.name ?? 'movimento'}{army.destination ? ` → ${provinces.find(p => p.id === army.destination)?.name ?? army.destination}` : ''}.{army.rebellionMovement && ` ${army.rebellionMovement.reason}`}{army.rebellionMovement?.powerRatio !== undefined && ` Proporção de força: ${army.rebellionMovement.powerRatio.toFixed(2)} / ${army.rebellionMovement.requiredRatio?.toFixed(2)}.`}</p>)}
        </div>}
        <details><summary>Causas da pressão social (alvo {Math.round(province.unrestExplanation?.total ?? unrest)}%)</summary>
          {province.unrestExplanation?.modifiers.map(m => <div key={m.source}>{UNREST_SOURCE_LABELS[m.source] ?? m.source}: {m.value > 0 ? '+' : ''}{m.value.toFixed(1)}</div>)}
        </details>
        {onRebellionAction && <div className="province-panel__neighbors">
          {([
            ['repression', 'Reprimir', 'Exige tropas; aumenta ressentimento, custa vidas e prestígio.'],
            ['tax_relief', 'Alívio fiscal', 'Receita local −20% por 180 dias.'],
            ['concessions', 'Concessões', 'Alívio temporário; reduz receita e ressentimento.'],
            ['autonomy', 'Autonomia', 'Reduz pressão, receita e manpower.'],
            ['investment', 'Investir', 'Melhora pressão social por 360 dias.'],
            ['negotiate', 'Negociar', 'Encerra facção camponesa ou separatista com concessões.'],
          ] satisfies [RebellionAction, string, string][]).map(([action, label, explanation]) => <button className="province-panel__neighbor-btn" key={action} title={explanation} onClick={() => onRebellionAction(province.id, action)}>{label} ({REBELLION_BALANCE.costs[action]} ouro)</button>)}
        </div>}

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
