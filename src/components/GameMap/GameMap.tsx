import { mapMetadata } from '../../data/map';
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

const NO_WARS: War[] = [];
const NO_RELATIONS: DiplomaticRelation[] = [];

export interface MapProps {
  provinces: Province[];
  countries: Country[];
  armies: Army[];
  recruitments: Recruitment[];
  buildingConstructions: BuildingConstruction[];
  activeBattles: ActiveBattle[];
  wars?: War[];
  diplomaticRelations?: DiplomaticRelation[];
  selectedProvince: string | null;
  hoveredProvince: string | null;
  selectedArmy: string | null;
  onProvinceHover: (provinceId: string | null) => void;
  onProvinceClick: (provinceId: string) => void;
  onArmyClick: (armyId: string) => void;
  onProvinceRightClick: (provinceId: string) => void;
}

export const GameMap: React.FC<MapProps> = ({
  provinces,
  countries,
  armies,
  recruitments,
  buildingConstructions,
  activeBattles,
  wars = NO_WARS,
  diplomaticRelations = NO_RELATIONS,
  selectedProvince,
  hoveredProvince,
  selectedArmy,
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
  const presentation = useMemo(() => buildArmyPresentation(armies, provinces), [armies, provinces]);
  const countryByTag = useMemo(() => new Map(countries.map(country => [country.tag, country])), [countries]);
  const mapValues = useMemo(() => buildMapValues(provinces, mapMode), [provinces, mapMode]);
  const war = useMemo(() => buildWarPresentation(provinces, countries, wars, diplomaticRelations, activeBattles), [provinces, countries, wars, diplomaticRelations, activeBattles]);
  const closeStack = useCallback(() => setOpenStack(null), []);
  const openGroup = openStack ? presentation.groups.find(group => group.key === openStack.key && group.armies.length > 1) : undefined;
  useEffect(closeStack, [selectedProvince, selectedArmy, closeStack]);
  useEffect(() => { if (openStack && !openGroup) closeStack(); }, [openStack, openGroup, closeStack]);
  const openStackAt = (group: ArmyVisualGroup, x: number, y: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    setTooltip(null);
    setOpenStack({ key: group.key, anchor: { x: rect ? x - rect.left + 12 : 12, y: rect ? y - rect.top + 12 : 70 } });
  };
  const selectArmy = (id: string) => { closeStack(); onArmyClick(id); };

  const {
    viewBox,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleMouseDown,
    handleMouseMovePan,
    handleMouseUp,
  } = useMapControls(svgRef);
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
      <MapModeBar mode={mapMode} onChange={setMapMode} max={mapValues.max} />
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
        <span>🖱️ Clique: selecionar | 🖱️ Direito: mover exército | Shift+Arrastar: mover mapa</span>
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
          if (provinceId) onProvinceRightClick(provinceId);
        }}
      >
        {/* Fundo do mar */}
        <rect x={mapMetadata.initialViewBox.x} y={mapMetadata.initialViewBox.y} width={mapMetadata.initialViewBox.w} height={mapMetadata.initialViewBox.h} fill="#1a3a5c" />

        {/* Grid decorativo */}
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#1e4060" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x={mapMetadata.initialViewBox.x} y={mapMetadata.initialViewBox.y} width={mapMetadata.initialViewBox.w} height={mapMetadata.initialViewBox.h} fill="url(#grid)" />

        {/* === Províncias === */}
        <ProvinceLayer
          provinces={provinces}
          countries={countries}
          buildingConstructions={buildingConstructions}
          recruitments={recruitments}
          selectedProvince={selectedProvince}
          hoveredProvince={hoveredProvince}
          mapMode={mapMode}
          mapValues={mapValues}
          onProvinceClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        <OperationalOverlay provinces={provinces} war={war} selectedArmyLocation={selectedArmy ? presentation.armyById.get(selectedArmy)?.location : null} />

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
          hoveredArmyId={hoveredArmyId}
          openStackKey={openGroup?.key ?? null}
          onStackOpen={openStackAt}
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
      {!openGroup && <GameMapTooltip tooltip={tooltip} countries={countryByTag} presentation={presentation} war={war} />}
      {openGroup && openStack && <ArmyStackPopover group={openGroup} province={openGroup.provinceId ? presentation.provinceById.get(openGroup.provinceId) : undefined} countries={countryByTag} presentation={presentation} selectedArmy={selectedArmy} anchor={openStack.anchor} onSelect={selectArmy} onClose={closeStack} />}
    </div>
  );
};
