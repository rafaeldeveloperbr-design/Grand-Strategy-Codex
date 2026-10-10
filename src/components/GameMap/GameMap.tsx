import { markerDetailLevel } from './markerDetail';
import { getFriendlyDisembarkError, FRIENDLY_BEACH_LANDING_LABEL } from '../../engine/naval/friendlyBeachLanding';
import { ActiveBattlePanel } from '../ActiveBattlePanel';
import { mapMetadata } from '../../data/map';
import type { MapViewBox } from '../../data/map/types';
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Province, Country, Army, Recruitment, BuildingConstruction, ActiveBattle, War, DiplomaticRelation } from '../../types';
import { useMapControls } from './useMapControls';
import { blocksMapKeyboard, regionalBounds } from './camera';
import { ProvinceLayer } from './ProvinceLayer';
import { CountryLabelsLayer } from './CountryLabelsLayer';
import { ArmyMovementLayer } from './ArmyMovementLayer';
import { BattleMarkersOverlay } from './BattleMarkersOverlay';
import { GameMapTooltip } from './GameMapTooltip';
import { COUNTRY_LABEL_MIN_ZOOM, PROVINCE_LABEL_MIN_ZOOM, buildArmyPresentation, buildMapValues, buildWarPresentation, type MapMode, type ArmyVisualGroup } from './mapPresentation';
import { MapModeBar } from './MapModeBar';
import { ArmyStackPopover } from '../ArmyStackPopover';
import { OperationalOverlay } from './OperationalOverlay';
import { buildLogisticsNetworks, type LogisticsSnapshot } from '../../engine/logistics';
import type { NavalState } from '../../types/naval';
import { buildTransportIndexes, fleetPosition, seaNodeById, planInvasion, portByProvince, amphibiousLandingLabel } from '../../engine/naval';
import { NavalLayer } from './NavalLayer';
import { FleetPanel, NavalBattlePanel } from '../FleetPanel';
import '../../styles/naval.css';
import type { AirState, AirMission } from '../../types/air';
import { AirLayer } from './AirLayer';
import { AirWingPanel } from '../AirWingPanel';
import { AirZonePanel } from '../AirZonePanel';
import { airZoneById, airZoneByProvinceId, canStartAirTarget, resolveAirTarget, type AirTargetCommand } from '../../engine/air';
import '../../styles/air.css';

const NO_WARS: War[] = [];
const NO_RELATIONS: DiplomaticRelation[] = [];

export interface MapProps {
  airState?: AirState;
  selectedAirWingId?: string | null;
  onAirWingSelect?: (id: string | null) => void;
  onAirMission?: (mission: AirMission, zone: string) => void;
  onAirRebase?: (province: string) => void;
  onAirCancel?: () => void;
  onAirFeedback?: (message: string, error: boolean) => void;
  onDisembark?: (armyId: string) => void;
  onFriendlyLanding?: (armyIds: string[], provinceId: string) => void;
  onInvasion?: (armyIds: string[], provinceId: string) => void;
  navalState?: NavalState;
  selectedFleetId?: string | null;
  onFleetSelect?: (id: string | null) => void;
  onFleetOrder?: (nodeId: string) => void;
  onFleetIntercept?: (fleetId: string) => void;
  onFleetReturn?: (portId?: string) => void;
  onFleetCancel?: () => void;
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
  airState, selectedAirWingId, onAirWingSelect, onAirMission, onAirRebase, onAirCancel, onAirFeedback,
  onDisembark, onInvasion, onFriendlyLanding,
  navalState,
  selectedFleetId = null,
  onFleetSelect,
  onFleetOrder,
  onFleetIntercept,
  onFleetReturn,
  onFleetCancel,
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
  const [navalMode, setNavalMode] = useState(false);
  const [airMode, setAirMode] = useState(false);
  const [selectedAirZone, setSelectedAirZone] = useState<string | null>(null);
  const [airTarget, setAirTarget] = useState<AirTargetCommand | null>(null);
  const [airFeedback, setAirFeedback] = useState('');
  const airWing = airState?.wings.find(w => w.id === selectedAirWingId);
  const selectedWingZone=airWing?.assignedAirZoneId ?? airZoneByProvinceId.get(airWing?.baseProvinceId ?? '')?.id ?? null;
  const airContext = { provinces, countries, armies, wars, relations: diplomaticRelations };
  const [invasionSelection, setInvasionSelection] = useState<{fleetId:string;armyIds:string[]}|null>(null);
  const [friendlySelection, setFriendlySelection] = useState<{fleetId:string;armyIds:string[]}|null>(null);
  const embarkedSelection = selectedArmy ? armies.find(a => a.id === selectedArmy && a.embarkedFleetId && a.owner === playerCountryTag) : undefined;
  const friendlyTargetIds = friendlySelection?.fleetId === selectedFleetId ? friendlySelection.armyIds : embarkedSelection && !embarkedSelection.friendlyBeachLanding ? [embarkedSelection.id] : undefined;
  const transportIndexes = useMemo(()=>buildTransportIndexes(armies),[armies]);
  const [selectedNavalBattle, setSelectedNavalBattle] = useState<string | null>(null);
  const selectedFleet = navalState?.fleets.find(f => f.id === selectedFleetId);
  const navalBattle = navalState?.battles.find(b => b.id === selectedNavalBattle);
  const [openStack, setOpenStack] = useState<{ key: string; anchor: { x: number; y: number } } | null>(null);
  const networks = useMemo(() => logistics ?? buildLogisticsNetworks({ countries, provinces, wars, relations: diplomaticRelations }), [logistics, countries, provinces, wars, diplomaticRelations]);
  const presentation = useMemo(() => buildArmyPresentation(armies, provinces, networks), [armies, provinces, networks]);
  const countryByTag = useMemo(() => new Map(countries.map(country => [country.tag, country])), [countries]);
  const mapValues = useMemo(() => buildMapValues(provinces, mapMode, networks), [provinces, mapMode, networks]);
  const war = useMemo(() => buildWarPresentation(provinces, countries, wars, diplomaticRelations, activeBattles), [provinces, countries, wars, diplomaticRelations, activeBattles]);
  const closeStack = useCallback(() => setOpenStack(null), []);
  const exitAirSelection = useCallback(() => { setAirMode(false); setAirTarget(null); setAirFeedback(''); setSelectedAirZone(null); onAirWingSelect?.(null); }, [onAirWingSelect]);
  useEffect(() => { setAirTarget(null); setAirFeedback(''); if (selectedAirWingId) { setAirMode(true); setSelectedNavalBattle(null); setSelectedAirZone(selectedWingZone); setInvasionSelection(null); closeStack(); } }, [selectedAirWingId, selectedWingZone, closeStack]); // Selection changes, not simulation ticks, drive map mode.
  useEffect(() => { if (selectedFleetId || selectedArmy || selectedArmyIds?.length || selectedNavalBattle) { setAirMode(false);setAirTarget(null);setAirFeedback('');setSelectedAirZone(null); } }, [selectedFleetId, selectedArmy, selectedArmyIds, selectedNavalBattle]);
  useEffect(() => { if (selectedFleetId || selectedArmy || selectedProvince) setSelectedAirZone(null); }, [selectedFleetId, selectedArmy, selectedProvince]);
  useEffect(() => { if (!onToggleArmy) closeStack(); }, [selectedProvince, selectedArmy, onToggleArmy, closeStack]);
  const openGroup = openStack ? presentation.groups.find(group => group.key === openStack.key && group.armies.length > 1) : undefined;
  useEffect(() => { if (openStack && !openGroup) closeStack(); }, [openStack, openGroup, closeStack]);
  const openStackAt = useCallback((group: ArmyVisualGroup, x: number, y: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    setTooltip(null);
    setOpenStack({ key: group.key, anchor: { x: rect ? x - rect.left + 12 : 12, y: rect ? y - rect.top + 12 : 70 } });
  }, []);
  const selectArmy = useCallback((id: string, additive = false) => { exitAirSelection(); closeStack(); if (additive && onToggleArmy) onToggleArmy(id); else onArmyClick(id); }, [exitAirSelection, closeStack, onToggleArmy, onArmyClick]);
  const handleStackOpen = useCallback((group: ArmyVisualGroup, x: number, y: number) => {
    exitAirSelection();
    onToggleStack?.(group.armies.map(army => army.id)); openStackAt(group, x, y);
  }, [exitAirSelection, onToggleStack, openStackAt]);

  const {
    viewBox,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleMouseDown,
    handleMouseMovePan,
    handleMouseUp,
    handleClickCapture,
    isPanning,
    isDragging,
    unitsPerPixel,
    panBy, focusProvince, focusCountry, fitBounds, focusWorldPoint,
  } = useMapControls(svgRef, initialViewBox);
  const mapZoom = mapMetadata.initialViewBox.w / viewBox.w;
  const detailLevel = markerDetailLevel(mapZoom);
  const activateCompactAir = useCallback((baseId: string) => {
    setAirMode(true); setNavalMode(false); setAirTarget(null); setAirFeedback('');
    closeStack(); onClearSelection?.(); onFleetSelect?.(null); setSelectedNavalBattle(null);
    setSelectedAirZone(airZoneByProvinceId.get(baseId)?.id ?? null);
  }, [closeStack, onClearSelection, onFleetSelect]);
  const selectFleet = useCallback((id: string) => {
    exitAirSelection(); closeStack(); setSelectedNavalBattle(null); onFleetSelect?.(id);
  }, [exitAirSelection, closeStack, onFleetSelect]);
  const activateCompactNaval = useCallback((id: string) => {
    setNavalMode(true); onClearSelection?.(); selectFleet(id);
  }, [onClearSelection, selectFleet]);
  const focusPlayer = useCallback(() => {
    const country = countryByTag.get(playerCountryTag ?? '');
    if (country) focusCountry(country, provinces);
  }, [countryByTag, playerCountryTag, focusCountry, provinces]);
  const focusSelected = useCallback(() => {
    const wing = airState?.wings.find(w => w.id === selectedAirWingId);
    if (wing) { const base = provinces.find(p => p.id === wing.baseProvinceId); if (base) focusProvince(base); return; }
    const fleet = navalState?.fleets.find(f => f.id === selectedFleetId);
    const point = fleet ? fleetPosition(fleet) : undefined;
    if (point) { focusWorldPoint(point); return; }
    const army = selectedArmy ? presentation.armyById.get(selectedArmy) : undefined;
    const province = presentation.provinceById.get(army?.location ?? selectedProvince ?? '');
    if (province) focusProvince(province);
  }, [selectedArmy, selectedProvince, presentation, focusProvince, navalState, selectedFleetId, focusWorldPoint, airState, selectedAirWingId, provinces]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || blocksMapKeyboard(event.target)
        || window.cheatPanelOpen || document.querySelector('[role="dialog"], .modal-overlay')) return;
      const directions: Record<string, [number, number]> = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] };
      if (directions[event.key]) panBy(...directions[event.key]);
      else if (event.key === '0') handleResetZoom();
      else if (event.key === '+' || event.key === '=') handleZoomIn();
      else if (event.key === '-') handleZoomOut();
      else if (!selectionMode && event.key === 'Home') focusPlayer();
      else if (!selectionMode && event.key.toLowerCase() === 'f') focusSelected();
      else if (!selectionMode && event.key === 'Escape') { setAirTarget(null);setAirFeedback(''); onAirWingSelect?.(null); setSelectedAirZone(null); onFleetSelect?.(null); setSelectedNavalBattle(null); }
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [panBy, handleResetZoom, handleZoomIn, handleZoomOut, selectionMode, focusPlayer, focusSelected, onFleetSelect, onAirWingSelect]);
  const capitalIds = war.capitals;
  const capitalProvinces = useMemo(() => provinces.filter(p => capitalIds.has(p.id)), [provinces, capitalIds]);
  const logisticsOrigins = useMemo(() => provinces.filter(p => mapValues.origins.has(p.id)), [provinces, mapValues]);

  const handleMouseEnter = useCallback((e: React.MouseEvent, province: Province) => {
    if (isDragging()) return;
    onProvinceHover(province.id);
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 40,
        province,
      });
    }
  }, [onProvinceHover, isDragging]);

  const handleMouseMove = useCallback((e: React.MouseEvent, province: Province) => {
    if (isDragging()) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 40,
        province,
      });
    }
  }, [isDragging]);

  const handleMouseLeave = useCallback(() => {
    if (isDragging()) return;
    onProvinceHover(null);
    setTooltip(null);
  }, [onProvinceHover, isDragging]);

  const dispatchAirTarget = (provinceId: string): boolean => {
    if (!airTarget) return false;
    if (!airState) return true;
    const result = resolveAirTarget(airState, airTarget, provinceId, playerCountryTag ?? '', airContext);
    const message = result.error ?? result.message ?? '';
    setAirFeedback(message); onAirFeedback?.(message, !!result.error);
    if (result.wing && !result.error) {
      if (airTarget.kind==='MISSION') { onAirMission?.(airTarget.mission, result.wing.assignedAirZoneId!);setSelectedAirZone(result.wing.assignedAirZoneId!); }
      else onAirRebase?.(provinceId);
      setAirTarget(null);
    }
    return true;
  };
  const handleClick = (provinceId: string) => {
    if (dispatchAirTarget(provinceId)) return;
    closeStack();
    if (invasionSelection && invasionSelection.fleetId === selectedFleetId) { onInvasion?.(invasionSelection.armyIds, provinceId); setInvasionSelection(null); return; }
    if (friendlySelection && friendlySelection.fleetId === selectedFleetId) { onFriendlyLanding?.(friendlySelection.armyIds, provinceId); setFriendlySelection(null); return; }
    onProvinceClick(provinceId);
  };

  const renderAirLayer = (part: 'zones' | 'markers') => !selectionMode && (airMode || part==='markers') && airState && <AirLayer detailLevel={detailLevel} onCompactActivate={activateCompactAir} part={part} mode={airMode} viewport={viewBox} state={airState} ctx={airContext} player={playerCountryTag ?? ''} selected={selectedAirWingId} selectedZone={selectedAirZone} scale={unitsPerPixel} onWing={id=>{setAirTarget(null);setAirFeedback('');setAirMode(true);closeStack();setSelectedNavalBattle(null);onAirWingSelect?.(id);}} onZone={(id,provinceId,inspect)=>{if(airTarget){dispatchAirTarget(provinceId);return;}if(!inspect){handleClick(provinceId);return;}closeStack();onClearSelection?.();onFleetSelect?.(null);onAirWingSelect?.(null);setSelectedNavalBattle(null);setSelectedAirZone(id);}} onBase={handleClick}/>;

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
        <button className="map__zoom-btn" onClick={handleResetZoom} title="Reset" aria-label="Reset View">
          ⟲
        </button>
        {!selectionMode && <>
          <button className="map__zoom-btn" onClick={focusPlayer} title="Focus Player (Home)" aria-label="Focus Player" disabled={!playerCountryTag}>◎</button>
          <button className="map__zoom-btn" onClick={focusSelected} title="Locate selected AirWing / Fleet / Army / Province (F)" aria-label="Locate selected entity" disabled={!selectedArmy && !selectedProvince && !selectedFleet && !airWing}>⌖</button>
          {!selectionMode && airState && <button className="map__zoom-btn" aria-label="Air Mode" aria-pressed={airMode} onClick={() => {setAirMode(v=>!v);setAirTarget(null);setAirFeedback('');setSelectedAirZone(null);}}>✈</button>}
          {navalState && <button className="map__zoom-btn" aria-label="Naval Mode" aria-pressed={navalMode} onClick={() => setNavalMode(v => !v)}>⚓</button>}
          {!!navalState?.battles.length && <select aria-label="Naval battles" value="" onChange={e => {setSelectedNavalBattle(e.target.value);const b=navalState.battles.find(b=>b.id===e.target.value),node=b?seaNodeById.get(b.seaNodeId):undefined;if(node)focusWorldPoint(node);}}><option value="" disabled>Batalhas navais…</option>{navalState.battles.map(b=><option key={b.id} value={b.id}>{b.seaNodeId} · {b.status}</option>)}</select>}
          <select aria-label="Regional jump" value="" onChange={event => {
            if (event.target.value === 'World') handleResetZoom();
            else if (regionalBounds[event.target.value]) fitBounds(regionalBounds[event.target.value]);
          }}><option value="" disabled>Region…</option>{['Americas', 'Europe', 'Africa', 'Asia', 'Oceania', 'World'].map(name => <option key={name}>{name}</option>)}</select>
          {activeBattles.length > 0 && <select aria-label="Locate battle" value="" onChange={event => {
            exitAirSelection();const province = presentation.provinceById.get(event.target.value); if (province) focusProvince(province);
          }}><option value="" disabled>Battle…</option>{activeBattles.map(battle => <option key={battle.id} value={battle.provinceId}>{presentation.provinceById.get(battle.provinceId)?.name ?? battle.provinceId}</option>)}</select>}
        </>}
      </div>

      {/* === Instruções === */}
      {!selectionMode && activeBattles.length > 0 && <aside className="map__battle-panels" aria-label="Batalhas terrestres">
        {activeBattles.map(battle => {const province = presentation.provinceById.get(battle.provinceId);return province ? <ActiveBattlePanel key={battle.id} battle={battle} armies={armies} province={province}/> : null;})}
      </aside>}
      <div className="map__instructions">
        <span>{selectionMode ? 'Clique: escolher país · Arrastar: mapa · Wheel: zoom · Setas: navegar' : <>Clique: selecionar · Ctrl+clique: multi-seleção · Direito: mover/substituir · Shift+direito: waypoint · Escape: limpar seleção · Arrastar: mapa · Wheel: zoom · Setas: navegar</>}</span>
      </div>

      {/* === SVG do Mapa === */}
      <svg
        ref={svgRef}
        className="map__svg"
        style={{ background: "#1a3a5c", cursor: isPanning ? 'grabbing' : airTarget ? 'crosshair' : 'grab', userSelect: 'none' }}
        aria-label={mapMetadata.name}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        onMouseDown={handleMouseDown}
        onClickCapture={handleClickCapture}
        onDoubleClick={event => {
          const id = (event.target as Element).closest('[data-province-id]')?.getAttribute('data-province-id');
          const province = id ? presentation.provinceById.get(id) : undefined;
          if (province) focusProvince(province);
        }}
        onMouseMove={handleMouseMovePan}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenuCapture={e=>{if(!airTarget)return;e.preventDefault();e.stopPropagation();const id=(e.target as Element).closest('[data-province-id]')?.getAttribute('data-province-id');if(id)dispatchAirTarget(id);}}
        onContextMenu={(e) => {
          e.preventDefault();

          const target = e.target as SVGElement;
          const provinceId = target.closest?.('[data-province-id]')?.getAttribute('data-province-id');
          if (airTarget) { if (provinceId) dispatchAirTarget(provinceId); return; }
          if (provinceId && (invasionSelection?.fleetId === selectedFleetId || friendlySelection?.fleetId === selectedFleetId)) { handleClick(provinceId); return; }
          if (provinceId && embarkedSelection && onFriendlyLanding) { onFriendlyLanding([embarkedSelection.id], provinceId); return; }
          if (provinceId) { if (selectedFleetId && onFleetReturn) onFleetReturn(provinceId); else if (e.shiftKey) onProvinceRightClick(provinceId, true); else onProvinceRightClick(provinceId); }
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
          showProvinceLabels={mapZoom >= PROVINCE_LABEL_MIN_ZOOM}
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
          labelSize={Math.min(8, 12 * unitsPerPixel)}
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        {mapZoom >= COUNTRY_LABEL_MIN_ZOOM && mapZoom < PROVINCE_LABEL_MIN_ZOOM && <CountryLabelsLayer countries={countries} provinces={provinces} />}
        <OperationalOverlay provinces={provinces} war={war} selectedArmyLocation={selectedArmy ? presentation.armyById.get(selectedArmy)?.location : null} />
        {mapMode === 'logistics' && logisticsOrigins.map(p => <g key={`logistics-${p.id}`} aria-label={`Origem logística: ${p.name}`} pointerEvents="none">
          <circle cx={p.center.x} cy={p.center.y - 15} r="10" fill="none" stroke="#ffe088" strokeWidth="2" />
          <text x={p.center.x + 14} y={p.center.y - 15} fontSize="9" fill="#ffe088">★</text>
        </g>)}

        {/* === Marcadores de capitais === */}
        {capitalProvinces
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
        {renderAirLayer('zones')}
        <ArmyMovementLayer
          detailLevel={detailLevel}
          markerScale={unitsPerPixel}
          presentation={presentation}
          countries={countryByTag}
          selectedArmy={selectedArmy}
          selectedArmyIds={selectedArmyIds}
          hoveredArmyId={hoveredArmyId}
          openStackKey={openGroup?.key ?? null}
          onStackOpen={handleStackOpen}
          onStackToggleAdditive={ids=>{exitAirSelection();onToggleStackAdditive?.(ids);}}
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
        {renderAirLayer('markers')}
        {!selectionMode && navalState && <NavalLayer detailLevel={detailLevel} onCompactActivate={activateCompactNaval} fleets={navalState.fleets} battles={navalState.battles} wars={wars} viewport={viewBox} mode={navalMode} selected={selectedFleetId} countries={countryByTag} provinces={provinces} scale={unitsPerPixel} onSelect={selectFleet} onOrder={id=>{if(selectedFleet?.countryTag===playerCountryTag)onFleetOrder?.(id);}} onIntercept={id=>{if(selectedFleet?.countryTag===playerCountryTag)onFleetIntercept?.(id);}} onPort={handleClick} onReturnPort={id=>onFleetReturn?.(id)} onBattle={id=>{exitAirSelection();onFleetSelect?.(null);setSelectedNavalBattle(id);const b=navalState.battles.find(b=>b.id===id),n=b?seaNodeById.get(b.seaNodeId):undefined;if(n)focusWorldPoint(n);}}/>}

        {/* === Filtro de Glow para exércitos elevados === */}
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
      </svg>
      {friendlyTargetIds && navalState && <div className="amphibious-target-hint" role="status">Desembarque amigável: clique com o botão direito numa província costeira acessível. {hoveredProvince && <span>{getFriendlyDisembarkError({ armies, naval: navalState, provinces, wars, relations: diplomaticRelations, activeBattles, actor: playerCountryTag ?? '' }, friendlyTargetIds, hoveredProvince) ?? (selectedFleet?.status === 'DOCKED' && selectedFleet.portProvinceId === hoveredProvince || navalState.fleets.some(f => f.id === embarkedSelection?.embarkedFleetId && f.status === 'DOCKED' && f.portProvinceId === hoveredProvince) ? 'Desembarcar pelo porto' : FRIENDLY_BEACH_LANDING_LABEL)}</span>} {friendlySelection && <button onClick={()=>setFriendlySelection(null)}>Cancelar seleção</button>}</div>}
      {invasionSelection&&invasionSelection.fleetId===selectedFleetId&&<div className="amphibious-target-hint" role="status">Amphibious Invasion: clique com botão esquerdo ou direito numa província costeira inimiga. {hoveredProvince && <span>{planInvasion({ armies, naval: navalState!, provinces, wars, relations: diplomaticRelations, actor: playerCountryTag ?? '' }, invasionSelection.fleetId, invasionSelection.armyIds, hoveredProvince).error ?? amphibiousLandingLabel(portByProvince.has(hoveredProvince) ? 'PORT' : 'BEACH')}</span>} <button onClick={()=>setInvasionSelection(null)}>Cancelar seleção</button></div>}{!selectionMode && selectedFleet && <FleetPanel key={selectedFleet.id} onSelectArmy={selectArmy} embarkedArmies={transportIndexes.byFleet.get(selectedFleet.id)??[]} extractingArmies={transportIndexes.extractionsByFleet.get(selectedFleet.id)??[]} invasion={navalState?.invasions?.find(o=>o.fleetId===selectedFleet.id)} onDisembark={onDisembark} onPlanFriendlyLanding={armyIds=>{setInvasionSelection(null);setFriendlySelection({fleetId:selectedFleet.id,armyIds});}} onPlanInvasion={armyIds=>{setFriendlySelection(null);setInvasionSelection({fleetId:selectedFleet.id,armyIds});}} reinforcements={navalState?.construction?.builds.filter(b=>b.targetFleetId===selectedFleet.id)} fleet={selectedFleet} country={countryByTag.get(selectedFleet.countryTag)} provinces={provinces} owner={selectedFleet.countryTag===playerCountryTag} onReturn={()=>onFleetReturn?.()} onCancel={()=>onFleetCancel?.()} onLocate={focusSelected} onClose={()=>onFleetSelect?.(null)}/>}
      {!selectionMode && airWing && airState && <AirWingPanel key={airWing.id} wing={airWing} state={airState} ctx={airContext} owner={airWing.countryTag===playerCountryTag}
        onTargetMission={mission=>{if(canStartAirTarget(airWing,playerCountryTag??'',mission)){setAirMode(true);setAirFeedback('');setAirTarget({wingId:airWing.id,kind:'MISSION',mission});}}}
        onTargetRebase={()=>{if(canStartAirTarget(airWing,playerCountryTag??'')){setAirMode(true);setAirFeedback('');setAirTarget({wingId:airWing.id,kind:'REBASE'});}}}
        onSelectWing={id=>{setAirTarget(null);setAirFeedback('');onAirWingSelect?.(id);}}
        onMission={(mission,zone)=>{setAirTarget(null);onAirMission?.(mission,zone);}} onRebase={id=>{setAirTarget(null);onAirRebase?.(id);}} onCancel={()=>{setAirTarget(null);setAirFeedback('');onAirCancel?.();}} onLocate={focusSelected} onClose={()=>{setAirTarget(null);setAirFeedback('');onAirWingSelect?.(null);}}/>}
      {!selectionMode && (airTarget || airFeedback) && <div className="air-target-hint" role="status">{airTarget ? airTarget.kind==='MISSION' ? 'Botão direito em uma província para selecionar a região aérea.' : 'Botão direito em uma província com AirBase para rebase.' : ''} {airFeedback} {airTarget && <button onClick={()=>{setAirTarget(null);setAirFeedback('');}}>Cancelar seleção aérea</button>}</div>}
      {!selectionMode && airMode && selectedAirZone && !airWing && <AirZonePanel id={selectedAirZone} state={airState ?? {wings:[],engagements:[]}} ctx={airContext} player={playerCountryTag ?? ''} battles={activeBattles} onClose={()=>setSelectedAirZone(null)} onLocate={()=>{const z=airZoneById.get(selectedAirZone);if(z)focusWorldPoint(z.center);}}/>}
      {!selectionMode && navalBattle && navalState && <NavalBattlePanel armies={armies} battle={navalBattle} fleets={navalState.fleets} onLocate={()=>{const n=seaNodeById.get(navalBattle.seaNodeId);if(n)focusWorldPoint(n);}} onClose={()=>setSelectedNavalBattle(null)}/>}

      {/* === Tooltip === */}
      {!openGroup && <GameMapTooltip tooltip={tooltip} countries={countryByTag} presentation={presentation} war={war} logistics={networks} />}
      {openGroup && openStack && <ArmyStackPopover group={openGroup} province={openGroup.provinceId ? presentation.provinceById.get(openGroup.provinceId) : undefined} countries={countryByTag} presentation={presentation} selectedArmy={selectedArmy} selectedArmyIds={selectedArmyIds} playerCountryTag={playerCountryTag} onToggleStack={onToggleStack} onClearSelection={onClearSelection} anchor={openStack.anchor}
        onSelect={(id, additive) => {
          if (additive) {
            if (onToggleArmy) {
              exitAirSelection();onToggleArmy(id);
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
