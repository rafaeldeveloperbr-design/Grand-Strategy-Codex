import type { Province } from '../../types';
import type { WarPresentation } from './mapPresentation';

export function OperationalOverlay({ provinces, war, selectedArmyLocation }: { provinces: Province[]; war: WarPresentation; selectedArmyLocation?: string | null }) {
  return <g className="operational-overlay" pointerEvents="none">
    <defs><pattern id="occupied-hatch" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M-3 3L3-3M0 12L12 0M9 15L15 9" stroke="var(--gold)" strokeWidth="1.2" opacity=".35" /></pattern></defs>
    {provinces.map(province => {
      const front = war.frontlines.has(province.id), occupied = war.occupied.has(province.id), selected = province.id === selectedArmyLocation;
      return <g key={province.id}>
        {occupied && <path d={province.path} fill="url(#occupied-hatch)" data-occupied-province={province.id} />}
        {(front || selected) && <path d={province.path} fill="none" stroke={selected ? 'var(--accent)' : 'var(--danger)'} strokeWidth={selected ? 2 : 1.3} strokeDasharray={selected ? undefined : '4 4'} vectorEffect="non-scaling-stroke" opacity=".8" data-front-province={front ? province.id : undefined} data-army-province={selected ? province.id : undefined} />}
        {war.capitalsAtRisk.has(province.id) && <circle cx={province.center.x} cy={province.center.y - 15} r="8" fill="none" stroke="var(--danger)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" data-capital-risk={province.id} />}
      </g>;
    })}
  </g>;
}
