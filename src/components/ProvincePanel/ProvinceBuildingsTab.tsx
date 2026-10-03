import React from 'react';
import { Province, Country, BuildingType } from '../../types';
import {
  BUILDING_DEFINITIONS,
  getBuildingCost,
  getBuildingTime,
  getBuildingResourceCost,
  canBuildBuilding,
} from '../../data/buildings';

interface ProvinceBuildingsTabProps {
  province: Province;
  playerCountry: Country;
  onBuild: (provinceId: string, buildingType: BuildingType) => void;
  constructionTypes: BuildingType[];
}

export const ProvinceBuildingsTab: React.FC<ProvinceBuildingsTabProps> = ({
  province,
  playerCountry,
  onBuild,
  constructionTypes,
}) => {
  const getBuildingLevel = (type: BuildingType): number => {
    const building = province.buildings.find((b) => b.type === type);
    return building?.level ?? 0;
  };

  return (
    <div className="province-panel__section">
      <h3 className="province-panel__subtitle">Construir</h3>
      <div className="province-panel__build-options">
        {(Object.keys(BUILDING_DEFINITIONS) as BuildingType[]).map((type) => {
          const def = BUILDING_DEFINITIONS[type];
          const currentLevel = getBuildingLevel(type);
          const canBuild = canBuildBuilding(type, currentLevel);
          const cost = getBuildingCost(type, currentLevel);
          const buildTime = getBuildingTime(type, currentLevel);
          const resources = getBuildingResourceCost(type, currentLevel);
          const canAfford = playerCountry.resources.gold >= cost;
          const market = province.market;
          const missingResource = (['wood', 'iron', 'tools'] as const).find(id =>
            (market?.goods[id].stock ?? 0) < (resources[id] ?? 0));
          const alreadyBuilding = constructionTypes.includes(type);
          const cantBuildReason = !canBuild
            ? 'Nível máximo'
            : alreadyBuilding ? 'Construção já em andamento'
            : !canAfford
            ? 'Dinheiro insuficiente'
            : missingResource ? `${missingResource.toUpperCase()} insuficiente`
            : null;

          return (
            <div
              key={type}
              className={`province-panel__build-option ${
                !canBuild || !canAfford ? 'province-panel__build-option--disabled' : ''
              }`}
            >
              <div className="province-panel__build-option-header">
                <span className="province-panel__build-icon">{def.icon}</span>
                <div className="province-panel__build-info">
                  <span className="province-panel__build-name">
                    {def.name}
                    <span className="province-panel__build-level"> Nv.{currentLevel} → {currentLevel + 1}</span>
                  </span>
                  <span className="province-panel__build-desc">{def.description}</span>
                  <span className="province-panel__build-desc">
                    Atual: {currentLevel > 0 ? `${currentLevel} × ${def.effectPerLevel}` : 'nenhum'} · Próximo: {currentLevel + 1} × {def.effectPerLevel}
                  </span>
                </div>
              </div>
              <div className="province-panel__build-costs">
                <span className="province-panel__build-cost">💰 {cost}</span>
                <span className="province-panel__build-cost">🪵 {resources.wood ?? 0}</span>
                <span className="province-panel__build-cost">⛏️ {resources.iron ?? 0}</span>
                <span className="province-panel__build-cost">🔧 {resources.tools ?? 0}</span>
                <span className="province-panel__build-cost">📅 {buildTime}d</span>
              </div>
              <button
                className="province-panel__build-btn"
                disabled={!!cantBuildReason}
                onClick={() => onBuild(province.id, type)}
              >
                {cantBuildReason ?? '🔨 Construir'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
