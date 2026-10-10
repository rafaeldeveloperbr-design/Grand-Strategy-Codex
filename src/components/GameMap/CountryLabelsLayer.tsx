import { useMemo } from 'react';
import type { Country, Province } from '../../types';

export function CountryLabelsLayer({ countries, provinces }: { countries: readonly Country[]; provinces: readonly Province[] }) {
  const territories = useMemo(() => {
    const index = new Map<string, { count: number; x: number; y: number }>();
    for (const province of provinces) {
      const territory = index.get(province.owner) ?? { count: 0, x: 0, y: 0 };
      territory.count++;
      territory.x += province.center.x;
      territory.y += province.center.y;
      index.set(province.owner, territory);
    }
    return index;
  }, [provinces]);

  return <g className="country-labels-layer" pointerEvents="none">
    {countries.map(country => {
      const territory = territories.get(country.tag);
      if (!territory) return null;
      const size = territory.count >= 20 ? 28 : territory.count >= 10 ? 22 : territory.count >= 5 ? 17 : 13;
      return <text key={country.tag} data-country-label={country.tag} className="map__country-label"
        x={territory.x / territory.count} y={territory.y / territory.count}
        textAnchor="middle" dominantBaseline="middle" pointerEvents="none"
        fontSize={Math.min(30, Math.max(12, size))} fontWeight="600" opacity="0.7"
        fill="var(--text-primary, #fff)" stroke="#151821" strokeWidth="1" strokeLinejoin="round"
        style={{ textTransform: 'uppercase', paintOrder: 'stroke' }}>
        {country.name}
      </text>;
    })}
  </g>;
}
