import type { Country } from '../../types';
import type { ArmyVisualGroup } from './mapPresentation';
import { formatArmySize } from '../../utils/formatters';

export function CompactArmyMarker({ group, country, selected, expanded, onArmyClick, onStackOpen, onStackToggleAdditive, onHover }: {
  group: ArmyVisualGroup; country?: Country; selected: boolean; expanded: boolean;
  onArmyClick: (id: string, additive?: boolean) => void;
  onStackOpen: (group: ArmyVisualGroup, x: number, y: number) => void;
  onStackToggleAdditive?: (ids: string[]) => void;
  onHover: (id: string | null) => void;
}) {
  const stack = group.armies.length > 1;
  const x = group.x + group.offsetX, y = group.y + group.offsetY;
  const activate = (additive: boolean, shift: boolean, clientX: number, clientY: number) => {
    if (stack) {
      if (additive) onStackToggleAdditive?.(group.armies.map(army => army.id));
      else if (!shift) onStackOpen(group, clientX, clientY);
    } else onArmyClick(group.armies[0].id, additive);
  };
  const label = `${country?.name ?? group.owner}: ${stack ? `${group.armies.length} exércitos` : group.armies[0].name}, ${group.troops.toLocaleString('pt-BR')} tropas`;
  return <g className="army-compact-marker" data-stack-key={stack ? group.key : undefined} data-army-id={stack ? undefined : group.armies[0].id} role="button" tabIndex={0} aria-label={label} aria-pressed={selected} aria-expanded={stack ? expanded : undefined} aria-haspopup={stack ? 'dialog' : undefined}
    onMouseDown={e => { if (!e.shiftKey) e.stopPropagation(); }}
    onClick={e => { e.stopPropagation(); activate(e.ctrlKey || e.metaKey, e.shiftKey, e.clientX, e.clientY); }}
    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); activate(e.ctrlKey || e.metaKey, e.shiftKey, rect.right, rect.bottom); } }}
    onMouseEnter={() => onHover(stack ? null : group.armies[0].id)} onMouseLeave={() => onHover(null)} style={{ cursor: 'pointer' }}>
    <title>{label}</title>
    <rect x={x - 30} y={y - 16} width="60" height="32" fill="transparent" style={{ pointerEvents: 'all' }} />
    <rect x={x - 29} y={y - 10} width="58" height="20" rx="4" fill={country?.color ?? 'var(--bg-panel)'} stroke={selected || expanded ? 'var(--gold)' : '#111'} pointerEvents="none" />
    <text x={x} y={y + 3} textAnchor="middle" fontSize="9" fill="white" pointerEvents="none">{group.owner.startsWith('rebel_') ? '⚑' : group.owner} {formatArmySize(group.troops)}</text>
  </g>;
}
