import { mapMetadata } from '../../data/map';
import React, { useState, useRef } from 'react';
import { Province, Country, Army, Recruitment, BuildingConstruction, ActiveBattle } from '../../types';
import { useMapControls } from './useMapControls';
import { ProvinceLayer } from './ProvinceLayer';
import { ArmyMovementLayer } from './ArmyMovementLayer';
import { BattleMarkersOverlay } from './BattleMarkersOverlay';
import { GameMapTooltip } from './GameMapTooltip';

export interface MapProps {
  provinces: Province[];
  countries: Country[];
  armies: Army[];
  recruitments: Recruitment[];
  buildingConstructions: BuildingConstruction[];
  activeBattles: ActiveBattle[];
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

  const {
    viewBox,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleMouseDown,
    handleMouseMovePan,
    handleMouseUp,
  } = useMapControls(svgRef);
  const capitalIds = new Set(countries.map(country => country.capitalId ?? country.capital));

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
    onProvinceClick(provinceId);
  };

  return (
    <div className="map-container">
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
          onProvinceClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {/* === Marcadores de capitais === */}
        {provinces
          .filter((p) => capitalIds.has(p.id))
          .map((province) => (
            <g key={`cap-${province.id}`}>
              <circle
                cx={province.center.x}
                cy={province.center.y - 15}
                r="4"
                fill="#FFD700"
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
          armies={armies}
          countries={countries}
          provinces={provinces}
          selectedArmy={selectedArmy}
          hoveredArmyId={hoveredArmyId}
          onArmyClick={onArmyClick}
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
      <GameMapTooltip tooltip={tooltip} countries={countries} />
    </div>
  );
};
