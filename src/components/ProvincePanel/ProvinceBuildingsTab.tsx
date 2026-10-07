import type { BuildingCategory, BuildingConstruction, BuildingType, Country, Province } from '../../types';
import { BUILDING_CATEGORIES, BUILDING_DEFINITIONS, getBuildingCosts, getBuildingEffect, getBuildingLevel, getBuildingTime } from '../../data/buildings';
import { BUILDING_BLOCK_MESSAGES, getBuildingBlockReasons, getConstructionTargetLevel } from '../../engine/buildings';

export function ProvinceBuildingsTab({ province, provinces, playerCountry, constructions, onBuild }: {
  province: Province; provinces: Province[]; playerCountry: Country; constructions: BuildingConstruction[];
  onBuild: (provinceId: string, type: BuildingType) => void;
}) {
  const pending = constructions.filter(c => c.provinceId === province.id);
  return <div className="province-panel__section">
    <h3 className="province-panel__subtitle">Construir e melhorar</h3>
    {province.buildings.filter(b => b.daysRemaining > 0).map((building, index) => <p key={`${building.type}_${index}`}>
      Obra anterior: {BUILDING_DEFINITIONS[building.type].name} · Nível {building.level} · {Math.ceil(building.daysRemaining)} dias restantes
    </p>)}
    {pending.length > 0 && <section aria-label="Obras em andamento">
      <h4>Obras em andamento</h4>
      {pending.map((item, index) => <div key={item.id}>
        {BUILDING_DEFINITIONS[item.buildingType].name} · Nível {getConstructionTargetLevel(item, province, constructions)}
        {' · '}{Math.ceil(item.daysRemaining)} dias restantes{index > 0 ? ' (aguardando)' : ''}
        <progress aria-label={`Progresso de ${BUILDING_DEFINITIONS[item.buildingType].name}`} max={item.totalDays} value={Math.max(0, item.totalDays - item.daysRemaining)} />
      </div>)}
      <p>Cancelamento e reembolso disponíveis em Atividades.</p>
    </section>}
    {(Object.keys(BUILDING_CATEGORIES) as BuildingCategory[]).map(category => <section key={category} aria-label={BUILDING_CATEGORIES[category]}>
      <h4 className="province-panel__subtitle">{BUILDING_CATEGORIES[category]}</h4>
      <div className="province-panel__build-options">
        {Object.values(BUILDING_DEFINITIONS).filter(def => def.category === category).map(def => {
          const type = def.type, level = getBuildingLevel(province, type), nextLevel = Math.min(def.maxLevel, level + 1);
          const costs = getBuildingCosts(type, level), time = getBuildingTime(type, level);
          const reasons = getBuildingBlockReasons(province, provinces, type, playerCountry.resources.gold, constructions);
          return <article key={type} aria-label={def.name} className={`province-panel__build-option ${reasons.length ? 'province-panel__build-option--disabled' : ''}`}>
            <div className="province-panel__build-option-header">
              <span className="province-panel__build-icon" aria-hidden="true">{def.icon}</span>
              <div className="province-panel__build-info">
                <span className="province-panel__build-name" title={def.description}>{def.name} · Nível {level} / {def.maxLevel}</span>
                <span className="province-panel__build-desc">{def.description}<br />
                  Atual: {getBuildingEffect(type, level)}<br />
                  Próximo nível {nextLevel}: {getBuildingEffect(type, nextLevel)}
                </span>
              </div>
            </div>
            <div className="province-panel__build-costs">
              <span>Ouro {costs.gold}</span><span>WOOD {costs.wood}</span><span>IRON {costs.iron}</span><span>TOOLS {costs.tools}</span><span>Tempo: {time} dias</span>
            </div>
            {reasons.length > 0 && <ul>{reasons.map(reason => <li key={reason}>{BUILDING_BLOCK_MESSAGES[reason]}</li>)}</ul>}
            <button className="province-panel__build-btn" disabled={reasons.length > 0} onClick={() => onBuild(province.id, type)}>
              {level >= def.maxLevel ? 'Nível máximo' : `Construir nível ${nextLevel}`}
            </button>
          </article>;
        })}
      </div>
    </section>)}
  </div>;
}
