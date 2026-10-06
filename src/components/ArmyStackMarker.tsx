import type { Country } from '../types';
import type { ArmyVisualGroup } from './GameMap/mapPresentation';
import { formatArmySize } from '../utils/formatters';

export function ArmyStackMarker({ group, country, selected, expanded, onOpen }: {
  group: ArmyVisualGroup; country?: Country; selected: boolean; expanded: boolean;
  onOpen: (group: ArmyVisualGroup, x: number, y: number) => void;
}) {
  const x = group.x + group.offsetX, y = group.y + group.offsetY;
  return <g className={`army-stack-marker ${selected ? 'army-stack-marker--selected' : ''}`} data-stack-key={group.key} role="button" tabIndex={0}
    aria-label={`${country?.name ?? group.owner}: ${group.armies.length} exércitos, ${group.troops.toLocaleString('pt-BR')} tropas`}
    aria-expanded={expanded} aria-haspopup="dialog"
    onMouseDown={event => { if (!event.shiftKey) event.stopPropagation(); }}
    onClick={event => { event.stopPropagation(); if (!event.shiftKey) onOpen(group, event.clientX, event.clientY); }}
    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.focus(); const rect = event.currentTarget.getBoundingClientRect(); onOpen(group, rect.right, rect.bottom); } }}>
    <title>{country?.name ?? group.owner} · {group.armies.length} exércitos · {group.troops.toLocaleString('pt-BR')} tropas</title>
    <rect x={x - 24} y={y - 12} width="52" height="31" rx="5" fill="var(--bg-app)" stroke="var(--border-light)" />
    <rect x={x - 28} y={y - 16} width="52" height="31" rx="5" fill="var(--bg-panel)" stroke={selected || expanded ? 'var(--gold)' : country?.color ?? 'var(--danger)'} strokeWidth="2" />
    <text x={x - 22} y={y - 5} fontSize="8" fill="var(--text-secondary)">{group.owner.startsWith('rebel_') ? '🏴' : group.owner}</text>
    <text x={x + 18} y={y - 5} textAnchor="end" fontSize="8" fill="var(--text-primary)">×{group.armies.length}</text>
    <text x={x - 22} y={y + 9} fontSize="11" fontWeight="700" fill="var(--text-primary)">{formatArmySize(group.troops)}</text>
    <text x={x + 26} y={y - 16} fontSize="10" fill="var(--gold)">{group.fighting ? '⚔' : ''}{group.moving ? '→' : ''}</text>
  </g>;
}
