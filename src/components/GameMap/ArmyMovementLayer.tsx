import React, { useMemo, useId } from 'react';
import type { Country } from '../../types';
import { ArmyMarker } from '../ArmyMarker';
import { ArmyStackMarker } from '../ArmyStackMarker';
import { SUPPLY_LABELS, type ArmyPresentation, type ArmyVisualGroup } from './mapPresentation';

interface ArmyMovementLayerProps {
  presentation: ArmyPresentation;
  countries: Map<string, Country>;
  selectedArmy: string | null;
  selectedArmyIds?: string[];
  hoveredArmyId: string | null;
  openStackKey: string | null;
  onArmyClick: (armyId: string, additive?: boolean) => void;
  onArmyHover: (armyId: string | null) => void;
  onStackOpen: (group: ArmyVisualGroup, x: number, y: number) => void;
  onStackToggleAdditive?: (ids: string[]) => void;
}

export const ArmyMovementLayer: React.FC<ArmyMovementLayerProps> = ({ presentation, countries, selectedArmy, selectedArmyIds, hoveredArmyId, openStackKey, onArmyClick, onArmyHover, onStackOpen, onStackToggleAdditive }) => {
  const selectedIds = useMemo(() => new Set(selectedArmyIds ?? (selectedArmy ? [selectedArmy] : [])), [selectedArmyIds, selectedArmy]);
  const arrowId = useId().replace(/:/g, '');
  const groups = useMemo(() => [...presentation.groups].sort((a, b) => Number(a.armies.some(army => selectedIds.has(army.id))) - Number(b.armies.some(army => selectedIds.has(army.id))) || Number(a.armies.some(army => army.id === hoveredArmyId)) - Number(b.armies.some(army => army.id === hoveredArmyId))), [presentation.groups, selectedIds, hoveredArmyId]);
  const routes = useMemo(() => {
    const relevant = new Set([...selectedIds, hoveredArmyId]);
    const open = presentation.groups.find(group => group.key === openStackKey);
    open?.armies.forEach(army => relevant.add(army.id));
    return [...relevant].flatMap(id => {
      const army = id ? presentation.armyById.get(id) : undefined;
      if (!army || (!army.destination && !army.movementPlan?.waypoints.length)) return [];
      const origin = army.location ? presentation.provinceById.get(army.location) : undefined;
      const start = army.position ?? origin?.center;
      if (!start) return [];
      // The engine's path includes destination; remove consecutive duplicates only.
      const ids = (army.destination ? [army.destination, ...army.path] : []).filter((value, index, all) => index === 0 || value !== all[index - 1]);
      const steps = ids.flatMap(value => { const province = presentation.provinceById.get(value); return province ? [province.center] : []; });
      const waypoints = (army.movementPlan?.waypoints ?? []).flatMap((id, index) => {
        const province = presentation.provinceById.get(id);
        return province ? [{ id, index: index + 1, point: province.center }] : [];
      });
      const segmentEnd = steps[steps.length - 1] ?? start;
      const future = waypoints.filter(w => !army.destination || w.id !== army.targetDestination || w.index !== 1);
      return [{ army, start, steps, waypoints, future, segmentEnd, final: waypoints[waypoints.length - 1]?.point ?? segmentEnd, visualKey: JSON.stringify([army.owner, start, ids, waypoints.map(w => w.id)]) }];
    }).filter((route, index, all) => !route.waypoints.length || all.findIndex(other => other.visualKey === route.visualKey) === index);
  }, [presentation, selectedIds, hoveredArmyId, openStackKey]);
  const selected = selectedArmy ? presentation.armyById.get(selectedArmy) : undefined;
  const selectedGroup = selectedArmy ? presentation.groups.find(group => group.armies.some(army => selectedIds.has(army.id))) : undefined;
  const stats = selectedArmy ? presentation.readouts.get(selectedArmy) : undefined;
  return <g className="army-movement-layer">
    <defs><marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" /></marker></defs>
    <g className="army-routes" pointerEvents="none">
      {routes.map(({ army, start, steps, final, waypoints, future, segmentEnd }) => <g key={army.id} data-route-army={army.id}>
        {steps.length > 0 && <polyline data-route-segment="active" points={[start, ...steps].map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke={selectedIds.has(army.id) ? 'var(--gold)' : 'var(--accent)'} strokeWidth={selectedIds.has(army.id) ? 3 : 1.5} vectorEffect="non-scaling-stroke" opacity={selectedIds.has(army.id) ? 1 : .55} markerEnd={`url(#${arrowId})`} />}
        {future.length > 0 && <polyline data-route-segment="planned" points={[segmentEnd, ...future.map(w => w.point)].map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" opacity=".7" />}
        {waypoints.filter((_, index) => index < 8 || index === waypoints.length - 1).map(w => <g key={`${w.index}-${w.id}`} data-waypoint={w.id}><circle cx={w.point.x} cy={w.point.y} r="9" fill="var(--bg-app)" stroke="var(--gold)" /><text x={w.point.x} y={w.point.y + 3} textAnchor="middle" fill="var(--gold)" fontSize="9">{w.index}</text></g>)}
        <circle cx={final.x} cy={final.y} r="8" fill="none" stroke={selectedIds.has(army.id) ? 'var(--gold)' : 'var(--accent)'} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {selectedIds.has(army.id) && <text x={final.x} y={final.y - 12} textAnchor="middle" className="army-route-label">Destino</text>}
      </g>)}
    </g>
    {groups.map(group => {
      const army = group.armies[0];
      const selectedInGroup = group.armies.some(item => selectedIds.has(item.id));
      const effectiveOwner = army.owner.startsWith('rebel_') && army.originalOwner ? army.originalOwner : army.owner;
      if (group.armies.length > 1) return (
        <ArmyStackMarker
          key={group.key}
          group={group}
          country={countries.get(group.owner)}
          selected={selectedInGroup}
          expanded={group.key === openStackKey}
          onOpen={onStackOpen}
          onToggleSelection={onStackToggleAdditive}
        />
      );
      return <ArmyMarker key={army.id} army={army} countries={[]} provinces={[]} resolvedCountry={countries.get(effectiveOwner)} resolvedProvince={army.location ? presentation.provinceById.get(army.location) : undefined} markerPosition={{ x: group.x + group.offsetX, y: group.y + group.offsetY }} isSelected={selectedInGroup} isHovered={army.id === hoveredArmyId} offsetX={0} offsetY={0} onClick={onArmyClick} onHover={onArmyHover} />;
    })}
    {selectedIds.size === 1 && selected && selectedGroup && stats && <g className="army-mini-status" pointerEvents="none" transform={`translate(${selectedGroup.x + selectedGroup.offsetX}, ${selectedGroup.y + selectedGroup.offsetY + 36})`}>
      <rect x="-70" y="-9" width="140" height={selected.destination ? 35 : 25} rx="4" fill="var(--bg-app)" stroke="var(--border-subtle)" />
      <text y="0" textAnchor="middle">{stats.troops.toLocaleString('pt-BR')} · Org {Math.round(stats.organization)} · Moral {Math.round(stats.morale)}</text>
      <text y="10" textAnchor="middle">Supply {SUPPLY_LABELS[stats.supply]} · {Math.round(stats.supplyRatio * 100)}%</text>
      {selected.destination && <text y="20" textAnchor="middle">Trecho atual: {Math.round(Math.min(1, Math.max(0, selected.movementProgress)) * 100)}%</text>}
    </g>}
  </g>;
};
