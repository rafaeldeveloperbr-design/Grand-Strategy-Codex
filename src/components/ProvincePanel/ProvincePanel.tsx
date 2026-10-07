import React, { useState } from 'react';
import type { LogisticsSnapshot } from '../../engine/logistics';
import { Province, Country, BuildingType, Army, Recruitment, UnitType, BuildingConstruction } from '../../types';
import { getCountryByTag } from '../../data/countries';

import { ProvinceInfoTab } from './ProvinceInfoTab';
import { ProvinceBuildingsTab } from './ProvinceBuildingsTab';
import { ProvinceMilitaryTab } from './ProvinceMilitaryTab';
import { ProvinceSidebar } from './ProvinceSidebar';
import { getProvinceRebellion, type RebellionAction } from '../../engine/rebellion';
import type { CountryTechState } from '../../types/technology';

export interface ProvincePanelProps {
  logistics?: LogisticsSnapshot;
  onRebellionAction?: (provinceId: string, action: RebellionAction) => void;
  selectedArmyIds?: string[];
  onSelectArmy?: (id: string) => void;
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
  logistics,
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
  onRebellionAction,
  selectedArmyIds,
  onSelectArmy,
}) => {
  const [activeTab, setActiveTab] = useState<PanelTab>('info');
  const ownerCountry = countries.find(c => c.tag === province.owner);
  const isPlayerOwned = province.owner === playerCountry.tag;
  const ownerTechState = isPlayerOwned ? playerTechState : botTechStates.get(province.owner);
  const faction = getProvinceRebellion(province, countries);

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
        <div><h2 className="province-panel__title">{province.name}</h2><p className="province-panel__identity">
          {ownerCountry?.flag} {ownerCountry?.name ?? province.owner}
        </p></div>
        <button className="province-panel__close" aria-label={"Fechar painel da prov\u00edncia"} onClick={onClose}>✕</button>
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
                faction={faction}
                factionArmies={armies.filter(army => army.rebellionFactionId === faction?.id && army.owner === faction?.id)}
                provinces={provinces}
                onRebellionAction={isPlayerOwned || playerCountry.rebellions?.some(f => f.id === province.owner && f.status === 'active') ? onRebellionAction : undefined}
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
                logistics={logistics}
                province={province}
                playerCountry={playerCountry}
                armiesHere={armiesHere}
                technology={playerTechState}
                allArmies={armies}
                countries={countries}
                selectedArmyIds={selectedArmyIds}
                onSelectArmy={onSelectArmy}
                recruitments={recruitmentsHere}
                onCancelRecruitment={onCancelRecruitment}
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
            recruitmentsHere={activeTab === 'military' ? [] : recruitmentsHere}
            onCancelBuilding={onCancelBuilding}
            onCancelRecruitment={onCancelRecruitment}
          />
        )}
      </div>

      {/* Rodapé */}
      <div className="province-panel__footer">
        <div className="province-panel__color-swatch" style={{ backgroundColor: province.color }} />
        <span className="province-panel__footer-text">
          {province.name} | Pop: {province.population.total.toLocaleString('pt-BR')}
        </span>
      </div>
    </div>
  );
};
