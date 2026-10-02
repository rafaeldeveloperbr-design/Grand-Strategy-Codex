import React from 'react';
import { Province, Country } from '../../types';

interface GameMapTooltipProps {
  tooltip: { x: number; y: number; province: Province } | null;
  countries: Country[];
}

export const GameMapTooltip: React.FC<GameMapTooltipProps> = ({ tooltip, countries }) => {
  if (!tooltip) return null;

  const getProvinceColor = (province: Province): string => {
    const country = countries.find((c) => c.tag === province.owner);
    return country?.color ?? '#555555';
  };

  const getTooltipCountry = (province: Province) => {
    return countries.find((c) => c.tag === province.owner);
  };

  return (
    <div
      className="map__tooltip"
      style={{
        left: tooltip.x,
        top: tooltip.y,
      }}
    >
      <div className="map__tooltip-name">{tooltip.province.name}</div>
      <div className="map__tooltip-country">
        <span
          className="map__tooltip-color"
          style={{ backgroundColor: getProvinceColor(tooltip.province) }}
        />
        {getTooltipCountry(tooltip.province)?.name ?? 'Desconhecido'}
      </div>
      <div className="map__tooltip-pop">
        👥 {tooltip.province.population.total.toLocaleString()}
      </div>
    </div>
  );
};
