import React, { useMemo } from 'react';
import { Army, Country, Province } from '../../types';
import { ArmyMarker } from '../ArmyMarker';
import { calculateArmyOffset } from '../../engine/military';

interface ArmyMovementLayerProps {
  armies: Army[];
  countries: Country[];
  provinces: Province[];
  selectedArmy: string | null;
  hoveredArmyId: string | null;
  onArmyClick: (armyId: string) => void;
  onArmyHover: (armyId: string | null) => void;
}

export const ArmyMovementLayer: React.FC<ArmyMovementLayerProps> = ({
  armies,
  countries,
  provinces,
  selectedArmy,
  hoveredArmyId,
  onArmyClick,
  onArmyHover,
}) => {
  const armyOffsets = useMemo(() => {
    const offsets = new Map<string, { offsetX: number; offsetY: number }>();

    const groups = new Map<string, Army[]>();
    for (const army of armies) {
      if (army.location && !army.destination) {
        const group = groups.get(army.location) ?? [];
        group.push(army);
        groups.set(army.location, group);
      }
    }

    for (const [, group] of groups) {
      if (group.length <= 1) {
        offsets.set(group[0].id, { offsetX: 0, offsetY: 0 });
      } else {
        group.forEach((army, index) => {
          const { offsetX, offsetY } = calculateArmyOffset(index, group.length);
          offsets.set(army.id, { offsetX, offsetY });
        });
      }
    }

    return offsets;
  }, [armies]);

  const sortedArmies = useMemo(() => {
    const sorted = [...armies];
    sorted.sort((a, b) => {
      const aMoving = a.destination ? 0 : 1;
      const bMoving = b.destination ? 0 : 1;
      if (aMoving !== bMoving) return aMoving - bMoving;

      const aSelected = a.id === selectedArmy ? 2 : 0;
      const bSelected = b.id === selectedArmy ? 2 : 0;
      if (aSelected !== bSelected) return aSelected - bSelected;

      const aHovered = a.id === hoveredArmyId ? 1 : 0;
      const bHovered = b.id === hoveredArmyId ? 1 : 0;
      return aHovered - bHovered;
    });
    return sorted;
  }, [armies, selectedArmy, hoveredArmyId]);

  return (
    <g className="army-movement-layer">
      {/* Linhas de movimento dos exércitos (path completo) */}
      {armies
        .filter((a) => a.destination && a.location)
        .map((army) => {
          const country = countries.find((c) => c.tag === army.owner);

          const fullPath = [army.location!, army.destination!, ...army.path];
          const pathPoints = fullPath
            .map((pid) => provinces.find((p) => p.id === pid))
            .filter((p): p is Province => p !== undefined);

          if (pathPoints.length < 2) return null;

          const pointsStr = pathPoints
            .map((p) => `${p.center.x},${p.center.y}`)
            .join(' ');

          return (
            <polyline
              key={`route-${army.id}`}
              points={pointsStr}
              fill="none"
              stroke={country?.colorLight ?? '#FFF'}
              strokeWidth="2"
              strokeDasharray="6,3"
              opacity="0.7"
              pointerEvents="none"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="0"
                to="-18"
                dur="1s"
                repeatCount="indefinite"
              />
            </polyline>
          );
        })}

      {/* Marcadores de Exércitos */}
      {sortedArmies.map((army) => {
        const offset = armyOffsets.get(army.id) ?? { offsetX: 0, offsetY: 0 };
        return (
          <ArmyMarker
            key={army.id}
            army={army}
            provinces={provinces}
            countries={countries}
            isSelected={army.id === selectedArmy}
            isHovered={army.id === hoveredArmyId}
            offsetX={offset.offsetX}
            offsetY={offset.offsetY}
            onClick={onArmyClick}
            onHover={onArmyHover}
          />
        );
      })}
    </g>
  );
};