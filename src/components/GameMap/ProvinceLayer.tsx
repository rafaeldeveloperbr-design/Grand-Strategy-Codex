import React, { useCallback, useMemo } from 'react';
import { Province, Country, Recruitment, BuildingConstruction } from '../../types';
import { BUILDING_DEFINITIONS } from '../../data/buildings';
import { UNIT_DEFINITIONS } from '../../data/units';
import { getProvinceRebellion, REBELLION_MARKER_THRESHOLD, REBEL_TYPE_LABELS } from '../../engine/rebellion';
import { getTerrainDefinition } from '../../engine/terrain';
import { numericMapColor, buildMapValues, type MapMode } from './mapPresentation';
import { logisticsCategory } from '../../engine/logistics';

interface ProvinceLayerProps {
  showProvinceLabels?: boolean;
  labelSize?: number;
  provinces: Province[];
  countries: Country[];
  buildingConstructions: BuildingConstruction[];
  recruitments: Recruitment[];
  selectedProvince: string | null;
  selectedCountryTag?: string;
  hoveredProvince: string | null;
  mapMode?: MapMode;
  mapValues?: ReturnType<typeof buildMapValues>;
  onProvinceClick: (provinceId: string) => void;
  onMouseEnter: (e: React.MouseEvent, province: Province) => void;
  onMouseMove: (e: React.MouseEvent, province: Province) => void;
  onMouseLeave: () => void;
}

export const ProvinceLayer: React.FC<ProvinceLayerProps> = React.memo(function ProvinceLayer({
  showProvinceLabels = true,
  labelSize = 8,
  provinces,
  countries,
  buildingConstructions,
  recruitments,
  selectedProvince,
  selectedCountryTag,
  hoveredProvince,
  mapMode = 'political',
  mapValues,
  onProvinceClick,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}: ProvinceLayerProps) {
  const values = useMemo(() => mapValues ?? buildMapValues(provinces, mapMode), [mapValues, provinces, mapMode]);
  const countriesByTag = useMemo(() => new Map(countries.map(c => [c.tag, c])), [countries]);
  const provincesById = useMemo(() => new Map(provinces.map(p => [p.id, p])), [provinces]);
  const getProvinceColor = useCallback(
    (province: Province): string => {
      const country = countriesByTag.get(province.owner);
      return country?.color ?? '#555555';
    },
    [countriesByTag]
  );

  const getProvinceLightColor = useCallback(
    (province: Province): string => {
      const country = countriesByTag.get(province.owner);
      return country?.colorLight ?? '#888888';
    },
    [countriesByTag]
  );

  const getProvinceClass = (province: Province): string => {
    const classes = ['map__province'];
    if (province.id === selectedProvince || province.owner === selectedCountryTag) classes.push('map__province--selected');
    if (province.id === hoveredProvince) classes.push('map__province--hovered');
    return classes.join(' ');
  };

  const getProvinceActivities = (provinceId: string, provinceOwner: string) => {
    const constructions = buildingConstructions.filter(
      (c) => c.provinceId === provinceId && c.owner === provinceOwner
    );
    const recruitmentsHere = recruitments.filter(
      (r) => r.provinceId === provinceId && r.owner === provinceOwner
    );

    return {
      hasConstructions: constructions.length > 0,
      hasRecruitments: recruitmentsHere.length > 0,
      constructions,
      recruitments: recruitmentsHere,
    };
  };

  return (
    <g className="provinces-layer">
      {provinces.map((province) => {
        const isHovered = province.id === hoveredProvince;
        const isSelected = province.id === selectedProvince || province.owner === selectedCountryTag;
        const fillColor = mapMode === 'logistics' ? logisticsCategory(values.logisticsByProvince.get(province.id)).color : mapMode === 'terrain' ? getTerrainDefinition(province).color : mapMode !== 'political' ? numericMapColor(values.values.get(province.id) ?? 0, values.max, mapMode) : isHovered || isSelected
          ? getProvinceLightColor(province)
          : getProvinceColor(province);

        const activities = getProvinceActivities(province.id, province.owner);
        const hasActivities = activities.hasConstructions || activities.hasRecruitments;

        const unrest = province.unrest ?? 0;
        const faction = getProvinceRebellion(province, countries);
        const iconY = province.center.y - 12;
        const iconX = province.center.x - 8;

        const getUnrestColor = (val: number) => {
          if (val >= 80) return '#e74c3c';
          if (val >= 60) return '#e67e22';
          if (val >= 40) return '#f39c12';
          if (val >= 20) return '#95a5a6';
          return '#2ecc71';
        };

        const getUnrestDescription = (val: number) => {
          if (val >= 80) return 'Crítico';
          if (val >= 60) return 'Alto';
          if (val >= 40) return 'Moderado';
          if (val >= 20) return 'Baixo';
          return 'Pacífico';
        };

        const needsPulse = unrest >= 50;
        const isCritical = unrest >= 80;

        return (
          <g key={province.id}>
            {/* Sombra da província */}
            <path
              d={province.path}
              fill="rgba(0,0,0,0.3)"
              transform="translate(2, 2)"
            />
            {/* Província principal */}
            <path
              d={province.path}
              fill={fillColor}
              stroke={isSelected ? 'var(--gold)' : isHovered ? 'var(--text-primary)' : 'var(--bg-app)'}
              strokeWidth={isSelected ? 3 : isHovered ? 2 : 1}
              className={getProvinceClass(province)}
              data-province-id={province.id}
              onMouseEnter={(e) => onMouseEnter(e, province)}
              onMouseMove={(e) => onMouseMove(e, province)}
              onMouseLeave={onMouseLeave}
              onClick={() => onProvinceClick(province.id)}
              style={{
                cursor: 'inherit',
                transition: 'fill 0.2s ease, stroke-width 0.15s ease',
              }}
            />
            {/* Nome da província */}
            {showProvinceLabels && <text
              x={province.center.x}
              y={province.center.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="map__province-label"
              fill="var(--text-primary)"
              fontSize={labelSize}
              fontWeight="bold"
              pointerEvents="none"
            >
              {province.name}
            </text>}

            {/* Indicadores de atividades */}
            {hasActivities && (
              <g pointerEvents="none">
                {activities.hasConstructions && (
                  <g>
                    <circle
                      cx={iconX}
                      cy={iconY}
                      r="6"
                      fill="rgba(255, 215, 0, 0.9)"
                      stroke="rgba(0, 0, 0, 0.5)"
                      strokeWidth="0.5"
                    />
                    <text
                      x={iconX}
                      y={iconY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="7"
                      pointerEvents="none"
                    >
                      🔨
                    </text>
                    <title>
                      {activities.constructions.map((c) => {
                        const def = BUILDING_DEFINITIONS[c.buildingType];
                        return `${def.name}: ${c.daysRemaining}d`;
                      }).join('\n')}
                    </title>
                  </g>
                )}

                {activities.hasRecruitments && (
                  <g>
                    <circle
                      cx={iconX + 16}
                      cy={iconY}
                      r="6"
                      fill="rgba(231, 76, 60, 0.9)"
                      stroke="rgba(0, 0, 0, 0.5)"
                      strokeWidth="0.5"
                    />
                    <text
                      x={iconX + 16}
                      y={iconY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="7"
                      pointerEvents="none"
                    >
                      ⚔️
                    </text>
                    <title>
                      {activities.recruitments.map((r) => {
                        const def = UNIT_DEFINITIONS[r.unitType];
                        return `${r.count > 1 ? `${r.count}x ` : ''}${def.name}: ${r.daysRemaining}d`;
                      }).join('\n')}
                    </title>
                  </g>
                )}
              </g>
            )}

            {faction && (province.rebellion?.progress ?? 0) >= REBELLION_MARKER_THRESHOLD && <g aria-label={`Província envolvida na revolta de ${REBEL_TYPE_LABELS[faction.type]} em ${province.name}`}>
              <text x={province.center.x - 35} y={province.center.y - 25} fontSize="12" pointerEvents="none">🏴</text>
              <title>{`Revolta de ${REBEL_TYPE_LABELS[faction.type]} ativa. Origem: ${provincesById.get(faction.originProvince)?.name ?? 'origem desconhecida'}. As tropas podem estar em outra província da região.`}</title>
            </g>}

            {/* Indicador de agitação provincial (unrest) */}
            {(province.rebellion?.progress ?? 0) >= REBELLION_MARKER_THRESHOLD && (!province.rebellion?.factionId || faction) && (!province.owner.startsWith('rebel_') || faction) && (() => {
              // Desloca para o canto superior direito da província
              const unrestX = province.center.x + 35;
              const unrestY = province.center.y - 25;

              return (
                <g pointerEvents="none">
                  {needsPulse && (
                    <circle
                      cx={unrestX}
                      cy={unrestY}
                      r={isCritical ? '14' : '12'}
                      fill={isCritical ? '#ef4444' : '#f97316'}
                      className="unrest-critical-pulse"
                      opacity="0.3"
                    />
                  )}
                  <circle
                    cx={unrestX}
                    cy={unrestY}
                    r="5"
                    fill={getUnrestColor(unrest)}
                    stroke="rgba(0, 0, 0, 0.5)"
                    strokeWidth="0.5"
                    opacity="0.8"
                  />
                  <text
                    x={unrestX}
                    y={unrestY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="6"
                    fill="white"
                    fontWeight="bold"
                    pointerEvents="none"
                  >
                    {Math.round(unrest)}
                  </text>
                  <title>
                    {`Agitação: ${getUnrestDescription(unrest)} (${Math.round(unrest)}%)\n`}
                    {`Organização rebelde: ${Math.round(province.rebellion?.progress ?? 0)}%`}
                  </title>
                </g>
              );
            })()}
          </g>
        );
      })}
    </g>
  );
});
