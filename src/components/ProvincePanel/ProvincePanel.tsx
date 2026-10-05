import React, { useState } from 'react';
import { Province, Country, BuildingType, Army, Recruitment, UnitType, BuildingConstruction } from '../../types';
import { getCountryByTag } from '../../data/countries';

import { ProvinceInfoTab } from './ProvinceInfoTab';
import { ProvinceBuildingsTab } from './ProvinceBuildingsTab';
import { ProvinceMilitaryTab } from './ProvinceMilitaryTab';
import { ProvinceSidebar } from './ProvinceSidebar';
import type { CountryTechState } from '../../types/technology';

export interface ProvincePanelProps {
  province: Province;
  provinces: Province[];
  countries: Country[];
  playerCountry: Country;
  armies: Army[];
  recruitments: Recruitment[];
  buildingConstructions: BuildingConstruction[];
  playerTechState: CountryTechState;
  botTechStates: Map<string, CountryTechState>;
  onClose: () => void;
  onProvinceClick: (provinceId: string) => void;
  onBuild: (provinceId: string, buildingType: BuildingType) => void;
  onRecruit: (provinceId: string, unitType: UnitType) => void;
  onCancelRecruitment: (recruitmentId: string) => void;
  onCancelBuilding: (constructionId: string) => void;
}

type PanelTab = 'info' | 'buildings' | 'military';

export const ProvincePanel: React.FC<ProvincePanelProps> = ({
  province,
  provinces,
  countries,
  playerCountry,
  armies,
  recruitments,
  buildingConstructions,
  playerTechState,
  botTechStates,
  onClose,
  onProvinceClick,
  onBuild,
  onRecruit,
  onCancelRecruitment,
  onCancelBuilding,
}) => {
  const [activeTab, setActiveTab] = useState<PanelTab>('info');
  const ownerCountry = getCountryByTag(province.owner);
  const isPlayerOwned = province.owner === playerCountry.tag;
  const ownerTechState = isPlayerOwned ? playerTechState : botTechStates.get(province.owner);

  const armiesHere = armies.filter((a) => a.location === province.id);
  const recruitmentsHere = recruitments.filter((r) => r.provinceId === province.id);

  const neighborProvinces = province.neighbors.map((nId) => {
    const allProvinces = countries.flatMap((c) =>
      c.provinces.map((pId) => ({ id: pId, owner: c.tag }))
    );
    const neighborData = allProvinces.find((p) => p.id === nId);
    const neighborCountry = neighborData ? getCountryByTag(neighborData.owner) : undefined;
    return { id: nId, country: neighborCountry };
  });

  const provinceConstructions = buildingConstructions.filter(
    (c) => c.provinceId === province.id && c.owner === province.owner
  );

  return (
    <div className="province-panel">
      {/* Cabeçalho */}
      <div className="province-panel__header">
        <h2 className="province-panel__title">{province.name}</h2>
        <button className="province-panel__close" onClick={onClose}>✕</button>
      </div>

      {/* Layout Principal */}
      <div className="province-panel__layout">
        <div className="province-panel__main">
          {/* Navegação por Abas */}
          <div className="province-panel__tabs">
            <button
              className={`province-panel__tab ${activeTab === 'info' ? 'province-panel__tab--active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              📊 Info
            </button>
            <button
              className={`province-panel__tab ${activeTab === 'buildings' ? 'province-panel__tab--active' : ''}`}
              onClick={() => setActiveTab('buildings')}
              disabled={!isPlayerOwned}
            >
              🏗️ Obras
            </button>
            <button
              className={`province-panel__tab ${activeTab === 'military' ? 'province-panel__tab--active' : ''}`}
              onClick={() => setActiveTab('military')}
              disabled={!isPlayerOwned}
            >
              ⚔️ Militar
            </button>
          </div>

          {/* Conteúdo Ativo */}
          <div className="province-panel__content">
            {activeTab === 'info' && (
              <ProvinceInfoTab
                province={province}
                ownerCountry={ownerCountry}
                armiesHere={armiesHere}
                neighborProvinces={neighborProvinces}
                onProvinceClick={onProvinceClick}
                techState={ownerTechState}
              />
            )}

            {activeTab === 'buildings' && isPlayerOwned && (
              <ProvinceBuildingsTab
                province={province}
                provinces={provinces}
                playerCountry={playerCountry}
                constructions={buildingConstructions}
                onBuild={onBuild}
              />
            )}

            {activeTab === 'military' && isPlayerOwned && (
              <ProvinceMilitaryTab
                province={province}
                playerCountry={playerCountry}
                armiesHere={armiesHere}
                technology={playerTechState}
                onRecruit={onRecruit}
              />
            )}

            {(activeTab === 'buildings' || activeTab === 'military') && !isPlayerOwned && (
              <div className="province-panel__section">
                <p className="province-panel__no-access">
                  ⚠️ Esta província não pertence ao seu país.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Lateral */}
        {isPlayerOwned && (
          <ProvinceSidebar
            provinceConstructions={provinceConstructions}
            recruitmentsHere={recruitmentsHere}
            onCancelBuilding={onCancelBuilding}
            onCancelRecruitment={onCancelRecruitment}
          />
        )}
      </div>

      {/* Rodapé */}
      <div className="province-panel__footer">
        <div className="province-panel__color-swatch" style={{ backgroundColor: province.color }} />
        <span className="province-panel__footer-text">
          {province.id} | Pop: {province.population.total.toLocaleString()}
        </span>
      </div>
    </div>
  );
};
