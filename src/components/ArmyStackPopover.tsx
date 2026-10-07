import { useEffect, useRef, type CSSProperties } from 'react';
import type { Country, Province } from '../types';
import { SUPPLY_LABELS, type ArmyPresentation, type ArmyVisualGroup } from './GameMap/mapPresentation';
import { compositionText } from './militaryPresentation';

export function ArmyStackPopover({ group, province, countries, presentation, selectedArmy, selectedArmyIds, playerCountryTag, onToggleStack, onClearSelection, anchor, onSelect, onClose }: {
  group: ArmyVisualGroup; province?: Province; countries: Map<string, Country>; presentation: ArmyPresentation;
  selectedArmy: string | null; anchor: { x: number; y: number }; onSelect: (id: string, additive: boolean) => void; onClose: () => void;
  selectedArmyIds?: string[]; playerCountryTag?: string; onToggleStack?: (ids: string[]) => void; onClearSelection?: () => void;
}) {
  const selected = new Set(selectedArmyIds ?? (selectedArmy ? [selectedArmy] : []));
  const controllable = group.armies.filter(a => a.owner === playerCountryTag).map(a => a.id);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const trigger = document.activeElement instanceof SVGElement ? document.activeElement : null;
    ref.current?.querySelector<HTMLButtonElement>('[data-army-choice]')?.focus({ preventScroll: true });
    const dismiss = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) onClose(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); (trigger as SVGElement & { focus?: () => void })?.focus?.(); } };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, [onClose]);
  return <div ref={ref} className="army-stack-popover" role="dialog" aria-label={`Exércitos em ${province?.name ?? 'movimento'}`} style={{ '--anchor-x': `${anchor.x}px`, '--anchor-y': `${anchor.y}px` } as CSSProperties}>
    <header><div><h3>{province?.name ?? 'Em movimento'}</h3><p>{group.armies.length} exércitos · {group.troops.toLocaleString('pt-BR')} tropas</p></div><button type="button" aria-label="Fechar stack" onClick={onClose}>✕</button></header>
    <div className="army-stack-popover__list">
      {onToggleStack && controllable.length > 0 && <div className="military-stack-controls"><button type="button" onClick={() => onToggleStack(controllable)}>{controllable.every(id => selected.has(id)) ? 'Desmarcar todos' : 'Selecionar todos'}</button><button type="button" onClick={onClearSelection} disabled={!selected.size}>Limpar seleção</button></div>}
      {group.armies.map(army => {
        const stats = presentation.readouts.get(army.id)!;
        const country = countries.get(army.owner);
        return (
          <button
            type="button"
            key={army.id}
            data-army-choice={army.id}
            className={`army-stack-popover__army ${selected.has(army.id)
              ? 'army-stack-popover__army--selected'
              : ''
              }`}
            style={{
              '--army-country-color':
                country?.color ?? 'var(--border-subtle)',
            } as CSSProperties} aria-pressed={selected.has(army.id)} disabled={playerCountryTag !== undefined && army.owner !== playerCountryTag} onClick={(event) =>
              onSelect(army.id, event.ctrlKey || event.metaKey)
            }>
            <strong>{army.name}</strong><span>{country?.flag ?? '🏴'} {country?.name ?? army.owner} · {stats.status}</span>
            <span className="army-stack-popover__stats"><span>{stats.troops.toLocaleString('pt-BR')} tropas</span><span>Org {Math.round(stats.organization)}%</span><span>Moral {Math.round(stats.morale)}%</span><span>Supply {SUPPLY_LABELS[stats.supply]} ({Math.round(stats.supplyRatio * 100)}%)</span></span>
            {stats.logistics && <span>Logística: {stats.logistics.connected ? 'Conectada' : 'Desconectada'} · Distância: {stats.logistics.distance ?? '—'}</span>}
            <span className="military-composition">{compositionText([army])}</span>
          </button>);
      })}
    </div>
    <footer>
      Clique: selecionar · Ctrl+clique: multi-seleção · Direito: mover/substituir · Shift+direito: waypoint · Escape: limpar seleção
    </footer>
  </div>;
}
