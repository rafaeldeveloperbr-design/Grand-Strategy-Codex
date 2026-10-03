import type { BuildingConstruction, BuildingType, Country, Province } from '../../types';
import { BUILDING_DEFINITIONS, getBuildingCosts, getBuildingEffect, getBuildingTime } from '../../data/buildings';
import { getBuildingBlockReason } from '../../engine/buildings';

export function ProvinceBuildingsTab({ province, playerCountry, constructions, onBuild }: { province: Province; playerCountry: Country; constructions: BuildingConstruction[]; onBuild: (provinceId: string, type: BuildingType) => void }) {
  return <div className="province-panel__section"><h3 className="province-panel__subtitle">Construir e melhorar</h3><div className="province-panel__build-options">
    {(Object.keys(BUILDING_DEFINITIONS) as BuildingType[]).map(type => {
      const def = BUILDING_DEFINITIONS[type]; const level = province.buildings.find(b => b.type === type)?.level ?? 0;
      const costs = getBuildingCosts(type, level); const reason = getBuildingBlockReason(province, type, playerCountry.resources.gold, constructions);
      return <div key={type} className={`province-panel__build-option ${reason ? 'province-panel__build-option--disabled' : ''}`}>
        <div className="province-panel__build-option-header"><span className="province-panel__build-icon">{def.icon}</span><div className="province-panel__build-info">
          <span className="province-panel__build-name">{def.name} · Nv.{level} → {Math.min(5, level + 1)}</span>
          <span className="province-panel__build-desc">Atual: {getBuildingEffect(type, level)}<br/>Próximo: {getBuildingEffect(type, Math.min(5, level + 1))}</span>
        </div></div>
        <div className="province-panel__build-costs"><span>💰 {costs.gold}</span><span>🪵 {costs.wood}</span><span>⛓️ {costs.iron}</span><span>🔧 {costs.tools}</span><span>📅 {getBuildingTime(type, level)}d</span></div>
        <button className="province-panel__build-btn" disabled={!!reason} onClick={() => onBuild(province.id, type)}>{reason ?? (level ? '⬆️ Melhorar' : '🔨 Construir')}</button>
      </div>;
    })}
  </div></div>;
}
