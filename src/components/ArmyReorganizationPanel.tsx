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
  const currentStrength = source ? calculateArmySize(source) : 0;

  const remainingStrength =
    currentStrength - transferredStrength;

  const destinationStrength =
    mode === 'transfer' && target
      ? calculateArmySize(target) + transferredStrength
      : transferredStrength;

  const selectedCount = indices.length;
  const counts = new Map<string, number>();
  for (const regiment of moved) counts.set(regiment.type, (counts.get(regiment.type) ?? 0) + 1);
  const title = mode === 'split' ? 'Dividir exército' : mode === 'transfer' ? 'Transferir regimentos' : 'Fundir exércitos';
  const confirm = () => {
    if (block) return;
    if (onConfirm(mode, indices, multiple && mode === 'merge' ? undefined : targetId, expectedRegiments)) onClose();
    else setError(REORGANIZATION_BLOCKS.stale);
  };
  return createPortal(
    <div className="battle-history-overlay">
      <div
        ref={ref}
        className="battle-history-modal army-reorganization-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="battle-history-header army-reorganization-modal__header">
          <div>
            <h2>{title}</h2>

            <span>
              {source?.name ?? 'Exército indisponível'}
            </span>
          </div>

          <button
            type="button"
            className="army-reorganization-modal__close"
            aria-label="Fechar reorganização"
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        <div className="army-reorganization-modal__content">
          {(mode === 'transfer' ||
            (mode === 'merge' && !multiple)) && (
              <div className="army-reorganization-target">
                <label htmlFor="reorganization-target">
                  {mode === 'transfer'
                    ? 'Transferir para'
                    : 'Fundir com'}
                </label>

                <select
                  id="reorganization-target"
                  value={targetId}
                  onChange={e => {
                    setTargetId(e.target.value);
                    setError(null);
                  }}
                >
                  {targets.map(army => (
                    <option
                      key={army.id}
                      value={army.id}
                    >
                      {army.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

          {mode !== 'merge' && (
            <fieldset className="army-reorganization-regiments">
              <legend>
                <span>Selecione os regimentos</span>

                <strong>
                  {selectedCount} de {source?.regiments.length ?? 0}
                </strong>
              </legend>

              <div className="army-reorganization-regiments__list">
                {source?.regiments.map((regiment, i) => {
                  const checked = indices.includes(i);

                  const originName =
                    regiment.originProvinceId
                      ? context.provinces.find(
                        province =>
                          province.id === regiment.originProvinceId
                      )?.name ?? regiment.originProvinceId
                      : '—';

                  return (
                    <label
                      key={i}
                      className={`army-reorganization-regiment ${checked
                          ? 'army-reorganization-regiment--selected'
                          : ''
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setIndices(prev =>
                            prev.includes(i)
                              ? prev.filter(value => value !== i)
                              : [...prev, i]
                          );

                          setError(null);
                        }}
                      />

                      <div className="army-reorganization-regiment__body">
                        <div className="army-reorganization-regiment__title">
                          <strong>
                            {getUnitName(regiment.type)}
                          </strong>

                          <span>
                            {Math.floor(
                              regiment.strength
                            ).toLocaleString('pt-BR')}
                            {' / '}
                            {getRegimentMaximum(
                              regiment
                            ).toLocaleString('pt-BR')}
                          </span>
                        </div>

                        <div className="army-reorganization-regiment__stats">
                          <span>
                            Org{' '}
                            <strong>
                              {Math.round(
                                getRegimentOrganization(regiment)
                              )}
                            </strong>
                          </span>

                          <span>
                            Moral{' '}
                            <strong>
                              {Math.round(regiment.morale)}
                            </strong>
                          </span>

                          <span>
                            Exp.{' '}
                            <strong>
                              {Math.round(
                                getRegimentExperience(regiment)
                              )}
                            </strong>
                          </span>
                        </div>

                        <small>
                          Origem: {originName}
                        </small>
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          <section
            className="army-reorganization-preview"
            aria-label="Preview da reorganização"
          >
            <h3>Resumo</h3>

            {mode === 'merge' ? (
              <>
                <div className="army-reorganization-preview__merge">
                  {mergeIds.map(id => {
                    const army =
                      context.armies.find(
                        a => a.id === id
                      );

                    return army ? (
                      <span key={id}>
                        {army.name}
                      </span>
                    ) : null;
                  })}
                </div>

                <div className="army-reorganization-preview__result">
                  <span>
                    Exército resultante
                  </span>

                  <strong>
                    {context.armies
                      .filter(a =>
                        mergeIds.includes(a.id)
                      )
                      .reduce(
                        (sum, a) =>
                          sum + calculateArmySize(a),
                        0
                      )
                      .toLocaleString('pt-BR')}{' '}
                    homens
                  </strong>
                </div>

                <small>
                  O primeiro exército selecionado mantém o nome e o ID.
                </small>
              </>
            ) : (
              <>
                <div className="army-reorganization-preview__grid">
                  <div>
                    <span>
                      Exército atual
                    </span>

                    <strong>
                      {currentStrength.toLocaleString('pt-BR')}
                      {' → '}
                      {remainingStrength.toLocaleString('pt-BR')}
                    </strong>
                  </div>

                  <div>
                    <span>
                      {mode === 'split'
                        ? 'Novo exército'
                        : target?.name ?? 'Destino'}
                    </span>

                    <strong>
                      {destinationStrength.toLocaleString('pt-BR')}{' '}
                      homens
                    </strong>
                  </div>
                </div>

                {counts.size > 0 && (
                  <div className="army-reorganization-preview__composition">
                    {[...counts].map(
                      ([type, count]) => (
                        <span key={type}>
                          {count}× {getUnitName(type)}
                        </span>
                      )
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          {(block || error) && (
            <p
              className="army-reorganization-error"
              role="status"
            >
              {block ?? error}
            </p>
          )}
        </div>

        <footer className="army-reorganization-modal__footer">
          <button
            type="button"
            className="army-reorganization-modal__cancel"
            onClick={onClose}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="army-reorganization-modal__confirm"
            disabled={!!block}
            onClick={confirm}
          >
            {mode === 'split'
              ? 'Criar destacamento'
              : mode === 'transfer'
                ? 'Transferir regimentos'
                : 'Fundir exércitos'}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
