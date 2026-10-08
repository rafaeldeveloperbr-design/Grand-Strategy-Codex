import { mapMetadata } from '../../data/map';
import type { MapViewBox } from '../../data/map/types';
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Province, Country, Army, Recruitment, BuildingConstruction, ActiveBattle, War, DiplomaticRelation } from '../../types';
import { useMapControls } from './useMapControls';
import { ProvinceLayer } from './ProvinceLayer';
import { ArmyMovementLayer } from './ArmyMovementLayer';
import { BattleMarkersOverlay } from './BattleMarkersOverlay';
import { GameMapTooltip } from './GameMapTooltip';
import { buildArmyPresentation, buildMapValues, buildWarPresentation, type MapMode, type ArmyVisualGroup } from './mapPresentation';
import { MapModeBar } from './MapModeBar';
import { ArmyStackPopover } from '../ArmyStackPopover';
import { OperationalOverlay } from './OperationalOverlay';
import { buildLogisticsNetworks, type LogisticsSnapshot } from '../../engine/logistics';

const NO_WARS: War[] = [];
const NO_RELATIONS: DiplomaticRelation[] = [];

export interface MapProps {
  initialViewBox?: MapViewBox;
  selectionMode?: boolean;
  selectedCountryTag?: string;
  provinces: Province[];
  countries: Country[];
  armies: Army[];
  recruitments: Recruitment[];
  buildingConstructions: BuildingConstruction[];
  activeBattles: ActiveBattle[];
  wars?: War[];
  diplomaticRelations?: DiplomaticRelation[];
  logistics?: LogisticsSnapshot;
  selectedProvince: string | null;
  hoveredProvince: string | null;
  selectedArmy: string | null;
  selectedArmyIds?: string[];
  playerCountryTag?: string;
  onToggleArmy?: (id: string) => void;
  onToggleStack?: (ids: string[]) => void;
  onToggleStackAdditive?: (ids: string[]) => void;
  onClearSelection?: () => void;
  onProvinceHover: (provinceId: string | null) => void;
  onProvinceClick: (provinceId: string) => void;
  onArmyClick: (armyId: string, additive?: boolean) => void;
  onProvinceRightClick: (provinceId: string, append?: boolean) => void;
}

export const GameMap: React.FC<MapProps> = ({
  initialViewBox,
  selectionMode = false,
  selectedCountryTag,
  provinces,
  countries,
  armies,
  recruitments,
  buildingConstructions,
  activeBattles,
  wars = NO_WARS,
  diplomaticRelations = NO_RELATIONS,
  logistics,
  selectedProvince,
  hoveredProvince,
  selectedArmy,
  selectedArmyIds,
  playerCountryTag,
  onToggleArmy,
  onToggleStack,
  onToggleStackAdditive,
  onClearSelection,
  onProvinceHover,
  onProvinceClick,
  onArmyClick,
  onProvinceRightClick,
}) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; province: Province } | null>(null);
  const [hoveredArmyId, setHoveredArmyId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapMode, setMapMode] = useState<MapMode>('political');
  const [openStack, setOpenStack] = useState<{ key: string; anchor: { x: number; y: number } } | null>(null);
  const networks = useMemo(() => logistics ?? buildLogisticsNetworks({ countries, provinces, wars, relations: diplomaticRelations }), [logistics, countries, provinces, wars, diplomaticRelations]);
  const presentation = useMemo(() => buildArmyPresentation(armies, provinces, networks), [armies, provinces, networks]);
  const countryByTag = useMemo(() => new Map(countries.map(country => [country.tag, country])), [countries]);
  const mapValues = useMemo(() => buildMapValues(provinces, mapMode, networks), [provinces, mapMode, networks]);
  const war = useMemo(() => buildWarPresentation(provinces, countries, wars, diplomaticRelations, activeBattles), [provinces, countries, wars, diplomaticRelations, activeBattles]);
  const closeStack = useCallback(() => setOpenStack(null), []);
  useEffect(() => { if (!onToggleArmy) closeStack(); }, [selectedProvince, selectedArmy, onToggleArmy, closeStack]);
  const openGroup = openStack ? presentation.groups.find(group => group.key === openStack.key && group.armies.length > 1) : undefined;
  useEffect(() => { if (openStack && !openGroup) closeStack(); }, [openStack, openGroup, closeStack]);
  const openStackAt = (group: ArmyVisualGroup, x: number, y: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    setTooltip(null);
    setOpenStack({ key: group.key, anchor: { x: rect ? x - rect.left + 12 : 12, y: rect ? y - rect.top + 12 : 70 } });
  };
  const selectArmy = (id: string, additive = false) => { closeStack(); if (additive && onToggleArmy) onToggleArmy(id); else onArmyClick(id); };

  const {
    viewBox,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleMouseDown,
    handleMouseMovePan,
    handleMouseUp,
  } = useMapControls(svgRef, initialViewBox);
  const capitalIds = war.capitals;

  const handleMouseEnter = (e: React.MouseEvent, province: Province) => {
    onProvinceHover(province.id);
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 40,
        province,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent, province: Province) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 40,
        province,
      });
    }
  };

  const handleMouseLeave = () => {
    onProvinceHover(null);
    setTooltip(null);
  };

  const handleClick = (provinceId: string) => {
    closeStack();
    onProvinceClick(provinceId);
  };

  return (
    <div className="map-container" ref={containerRef}>
      {!selectionMode && <MapModeBar mode={mapMode} onChange={setMapMode} max={mapValues.max} />}
      {/* === Controles de Zoom === */}
      <div className="map__zoom-controls">
        <button className="map__zoom-btn" onClick={handleZoomIn} title="Zoom In">
          🔍+
        </button>
        <button className="map__zoom-btn" onClick={handleZoomOut} title="Zoom Out">
          🔍−
        </button>
        <button className="map__zoom-btn" onClick={handleResetZoom} title="Reset">
          ⟲
        </button>
      </div>

      {/* === Instruções === */}
      <div className="map__instructions">
        <span>{selectionMode ? 'Clique: escolher país · Shift+arrastar: mapa' : <>Clique: selecionar · Ctrl+clique: multi-seleção · Direito: mover/substituir · Shift+direito: waypoint · Escape: limpar seleção · Shift+arrastar: mapa</>}</span>
      </div>

      {/* === SVG do Mapa === */}
      <svg
        ref={svgRef}
        className="map__svg"
        style={{ background: "#1a3a5c" }}
        aria-label={mapMetadata.name}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMovePan}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={(e) => {
          e.preventDefault();

          const target = e.target as SVGElement;
          const provinceId = target.closest?.('[data-province-id]')?.getAttribute('data-province-id');
          if (provinceId) { if (e.shiftKey) onProvinceRightClick(provinceId, true); else onProvinceRightClick(provinceId); }
        }}
      >
        {/* Fundo do mar */}
        <rect x={mapMetadata.bounds.x} y={mapMetadata.bounds.y} width={mapMetadata.bounds.w} height={mapMetadata.bounds.h} fill="#1a3a5c" />

        {/* Grid decorativo */}
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#1e4060" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x={mapMetadata.bounds.x} y={mapMetadata.bounds.y} width={mapMetadata.bounds.w} height={mapMetadata.bounds.h} fill="url(#grid)" />

        {/* === Províncias === */}
        <ProvinceLayer
          provinces={provinces}
          countries={countries}
          buildingConstructions={buildingConstructions}
          recruitments={recruitments}
          selectedProvince={selectedProvince}
          selectedCountryTag={selectedCountryTag}
          hoveredProvince={hoveredProvince}
          mapMode={mapMode}
          mapValues={mapValues}
          onProvinceClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        <OperationalOverlay provinces={provinces} war={war} selectedArmyLocation={selectedArmy ? presentation.armyById.get(selectedArmy)?.location : null} />
        {mapMode === 'logistics' && provinces.filter(p => mapValues.origins.has(p.id)).map(p => <g key={`logistics-${p.id}`} aria-label={`Origem logística: ${p.name}`} pointerEvents="none">
          <circle cx={p.center.x} cy={p.center.y - 15} r="10" fill="none" stroke="#ffe088" strokeWidth="2" />
          <text x={p.center.x + 14} y={p.center.y - 15} fontSize="9" fill="#ffe088">★</text>
        </g>)}

        {/* === Marcadores de capitais === */}
        {provinces
          .filter((p) => capitalIds.has(p.id))
          .map((province) => (
            <g key={`cap-${province.id}`}>
              <circle
                cx={province.center.x}
                cy={province.center.y - 15}
                r="4"
                fill="var(--gold)"
                stroke="#000"
                strokeWidth="1"
                pointerEvents="none"
              />
              <text
                x={province.center.x}
                y={province.center.y - 15}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="5"
                fill="#000"
                pointerEvents="none"
              >
                ★
              </text>
            </g>
          ))}

        {/* === Linhas e Marcadores de Exércitos === */}
        <ArmyMovementLayer
          presentation={presentation}
          countries={countryByTag}
          selectedArmy={selectedArmy}
          selectedArmyIds={selectedArmyIds}
          hoveredArmyId={hoveredArmyId}
          openStackKey={openGroup?.key ?? null}
          onStackOpen={(group, x, y) => {
            onToggleStack?.(group.armies.map(army => army.id));
            openStackAt(group, x, y);
          }}
          onStackToggleAdditive={onToggleStackAdditive}
          onArmyClick={selectArmy}
          onArmyHover={setHoveredArmyId}
        />

        {/* === Indicadores de Batalhas Ativas === */}
        <BattleMarkersOverlay
          activeBattles={activeBattles}
          armies={armies}
          countries={countries}
          provinces={provinces}
        />

        {/* === Filtro de Glow para exércitos elevados === */}
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
      </svg>

      {/* === Tooltip === */}
      {!openGroup && <GameMapTooltip tooltip={tooltip} countries={countryByTag} presentation={presentation} war={war} logistics={networks} />}
      {openGroup && openStack && <ArmyStackPopover group={openGroup} province={openGroup.provinceId ? presentation.provinceById.get(openGroup.provinceId) : undefined} countries={countryByTag} presentation={presentation} selectedArmy={selectedArmy} selectedArmyIds={selectedArmyIds} playerCountryTag={playerCountryTag} onToggleStack={onToggleStack} onClearSelection={onClearSelection} anchor={openStack.anchor}
        onSelect={(id, additive) => {
          if (additive) {
            if (onToggleArmy) {
              onToggleArmy(id);
            } else {
              selectArmy(id);
            }
          } else {
            selectArmy(id);
          }
        }} onClose={closeStack} />}
    </div>
  );
};
