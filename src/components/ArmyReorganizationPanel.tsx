import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { Army } from '../types';
import { calculateArmySize, getRegimentMaximum, getRegimentOrganization, getRegimentExperience, getArmyReorganizationBlockReason, getArmyPairBlockReason, getMergeGroupBlockReason, getRegimentSelectionBlockReason, REORGANIZATION_BLOCKS, type ReorganizationContext } from '../engine/military';
import { getUnitName } from '../utils/translations';
import { useMilitaryDialog } from './useMilitaryDialog';

type Mode = 'split' | 'transfer' | 'merge';
type Confirm = (mode: Mode, indices?: number[], targetId?: string, expected?: string) => boolean;

export function ArmyReorganizationPanel({ selectedIds, context, onConfirm, onHalf }: { selectedIds: string[]; context: ReorganizationContext; onConfirm: Confirm; onHalf?: () => void }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const source = context.armies.find(a => a.id === selectedIds[0]);
  const multiple = selectedIds.length > 1;
  const block = multiple ? getMergeGroupBlockReason(selectedIds, context) : getArmyReorganizationBlockReason(source, context);
  const targets = source ? context.armies.filter(a => a.id !== source.id && !getArmyPairBlockReason(source, a, context)) : [];
  return <section className="army-reorganization" aria-label="Reorganizar exércitos">
    <h4>Reorganizar</h4>
    {multiple ? <button type="button" className="army-info-panel__action-btn" disabled={!!block} onClick={() => setMode('merge')}>Fundir selecionados</button> : <div className="army-reorganization__actions">
      <button type="button" className="army-info-panel__action-btn" disabled={!!block || (source?.regiments.length ?? 0) < 2} onClick={() => setMode('split')}>Dividir</button>
      <button type="button" className="army-info-panel__action-btn" disabled={!!block || !targets.length} onClick={() => setMode('transfer')}>Transferir</button>
      <button type="button" className="army-info-panel__action-btn" disabled={!!block || !targets.length} onClick={() => setMode('merge')}>Fundir</button>
      {onHalf && <button type="button" className="army-info-panel__action-btn" disabled={!!block || (source?.regiments.length ?? 0) < 2} onClick={onHalf}>Dividir pela metade</button>}
    </div>}
    {block && <p role="status">{block}</p>}
    {!block && !multiple && (source?.regiments.length ?? 0) < 2 && <p>{REORGANIZATION_BLOCKS.insufficient}</p>}
    {!block && !multiple && !targets.length && <small>Nenhum outro exército elegível nesta província.</small>}
    {mode && <ReorganizationModal mode={mode} source={source} selectedIds={selectedIds} context={context} targets={targets} onConfirm={onConfirm} onClose={() => setMode(null)} />}
  </section>;
}

function ReorganizationModal({ mode, source, selectedIds, context, targets, onConfirm, onClose }: { mode: Mode; source?: Army; selectedIds: string[]; context: ReorganizationContext; targets: Army[]; onConfirm: Confirm; onClose: () => void }) {
  const ref = useMilitaryDialog(onClose);
  const [indices, setIndices] = useState<number[]>([]);
  const [targetId, setTargetId] = useState(targets[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [expectedRegiments] = useState(() => source ? JSON.stringify(source.regiments) : undefined);
  const target = context.armies.find(a => a.id === targetId);
  const multiple = selectedIds.length > 1;
  const mergeIds = multiple ? selectedIds : [source?.id ?? '', targetId];
  const block = mode === 'merge' ? getMergeGroupBlockReason(mergeIds, context) : getArmyReorganizationBlockReason(source, context) ?? (expectedRegiments !== JSON.stringify(source?.regiments) ? REORGANIZATION_BLOCKS.stale : null) ?? (mode === 'transfer' ? getArmyPairBlockReason(source, target, context) : null) ?? (source ? getRegimentSelectionBlockReason(source, indices) : REORGANIZATION_BLOCKS.invalid);
  const moved = source?.regiments.filter((_, i) => indices.includes(i)) ?? [];
  const transferredStrength = moved.reduce((sum, r) => sum + r.strength, 0);
  const counts = new Map<string, number>();
  for (const regiment of moved) counts.set(regiment.type, (counts.get(regiment.type) ?? 0) + 1);
  const title = mode === 'split' ? 'Dividir exército' : mode === 'transfer' ? 'Transferir regimentos' : 'Fundir exércitos';
  const confirm = () => {
    if (block) return;
    if (onConfirm(mode, indices, multiple && mode === 'merge' ? undefined : targetId, expectedRegiments)) onClose();
    else setError(REORGANIZATION_BLOCKS.stale);
  };
  return createPortal(<div className="battle-history-overlay"><div ref={ref} className="battle-history-modal army-reorganization-modal" role="dialog" aria-modal="true" aria-label={title}>
    <header className="battle-history-header"><h2>{title}</h2><button type="button" aria-label="Fechar reorganização" onClick={onClose}>✕</button></header>
    <div className="army-reorganization-modal__content">
      <p>{source?.name ?? 'Exército indisponível'}</p>
      {(mode === 'transfer' || (mode === 'merge' && !multiple)) && <label>{mode === 'transfer' ? 'Transferir para:' : 'Fundir com:'}<select value={targetId} onChange={e => { setTargetId(e.target.value); setError(null); }}>{targets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
      {mode !== 'merge' && <fieldset><legend>Selecione regimentos inteiros</legend>{source?.regiments.map((regiment, i) => <label key={i} className="army-reorganization-regiment"><input type="checkbox" checked={indices.includes(i)} onChange={() => { setIndices(prev => prev.includes(i) ? prev.filter(value => value !== i) : [...prev, i]); setError(null); }} /><span>{getUnitName(regiment.type)} — {regiment.strength}/{getRegimentMaximum(regiment)}<small>ORG {getRegimentOrganization(regiment)} · Moral {regiment.morale} · Experiência {getRegimentExperience(regiment)} · Origem {regiment.originProvinceId ?? '—'}</small></span></label>)}</fieldset>}
      <section className="army-reorganization-preview" aria-label="Preview da reorganização">
        {mode === 'merge' ? <><p>Fundir: {mergeIds.map(id => context.armies.find(a => a.id === id)?.name ?? id).join(' + ')}</p><p>Tropas resultantes: {context.armies.filter(a => mergeIds.includes(a.id)).reduce((sum, a) => sum + calculateArmySize(a), 0).toLocaleString('pt-BR')}</p><small>O primeiro exército selecionado mantém ID e nome.</small></> : <><p>Exército atual: {(source ? calculateArmySize(source) : 0).toLocaleString('pt-BR')} → {((source ? calculateArmySize(source) : 0) - transferredStrength).toLocaleString('pt-BR')}</p><p>{mode === 'split' ? 'Novo exército' : target?.name ?? 'Destino'}: {((mode === 'transfer' && target ? calculateArmySize(target) : 0) + transferredStrength).toLocaleString('pt-BR')}</p>{[...counts].map(([type, count]) => <p key={type}>{count}× {getUnitName(type)}</p>)}</>}
      </section>
      {(block || error) && <p role="status">{block ?? error}</p>}
      <div className="army-reorganization__actions"><button type="button" onClick={onClose}>Cancelar</button><button type="button" disabled={!!block} onClick={confirm}>{mode === 'split' ? 'Confirmar divisão' : mode === 'transfer' ? 'Confirmar transferência' : 'Confirmar fusão'}</button></div>
    </div>
  </div></div>, document.body);
}
