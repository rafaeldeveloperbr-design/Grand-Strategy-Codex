import React, { useState } from 'react';
import type { AirCombatReport } from '../types/air';
import type { NavalBattle } from '../types/naval';
import { airZoneById } from '../engine/air/world';
import { seaNodeById } from '../engine/naval';
import { formatAirCombatDay } from '../engine/air/reports';
import { CombatResult, Country } from '../types';
import { useMilitaryDialog } from './useMilitaryDialog';

interface BattleHistoryModalProps {
  playerCountryTag: string;
  battleHistory: CombatResult[];
  navalBattles?: NavalBattle[];
  airReports?: AirCombatReport[];
  onViewNavalBattle?: (battle: NavalBattle) => void;
  onViewAirBattle?: (report: AirCombatReport) => void;
  allCountries: Country[];
  onClose: () => void;
  onViewBattle: (battle: CombatResult) => void;
}

export const BattleHistoryModal: React.FC<BattleHistoryModalProps> = ({
  playerCountryTag,
  battleHistory,
  allCountries,
  onClose,
  onViewBattle,
  navalBattles = [], airReports = [], onViewNavalBattle, onViewAirBattle,
}) => {
  const dialogRef = useMilitaryDialog(onClose);
  const [filter, setFilter] = useState<'ALL' | 'LAND' | 'NAVAL' | 'AIR'>('ALL');
  type Entry = {kind: 'LAND'; battle: CombatResult; recent: number; key: string}
    | {kind: 'NAVAL'; battle: NavalBattle; recent: number; key: string}
    | {kind: 'AIR'; battle: AirCombatReport; recent: number; key: string};
  const entries: Entry[] = [
    ...battleHistory.map((battle, index): Entry => ({kind: 'LAND', battle, key: `land-${battle.id ?? index}`,
      recent: battle.date ? Math.floor(Date.UTC(battle.date.year, battle.date.month - 1, battle.date.day) / 86400000) : Number.MIN_SAFE_INTEGER})),
    ...navalBattles.filter(b => b.status === 'ENDED').map((battle): Entry => ({kind: 'NAVAL', battle, key: `naval-${battle.id}`,
      recent: battle.startedAt + Math.max(0, battle.days - 1)})),
    ...airReports.filter(r => r.status === 'ENDED').map((battle): Entry => ({kind: 'AIR', battle, key: `air-${battle.id}`, recent: battle.endedAt ?? battle.lastCombatDay})),
  ];
  const visibleEntries = entries.filter(e => filter === 'ALL' || e.kind === filter)
    .sort((a, b) => b.recent - a.recent || a.key.localeCompare(b.key));
  const activate = (event: React.KeyboardEvent, callback: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); callback(); }
  };
  const getCountryByTag = (tag: string): Country | undefined => {
    return allCountries.find(c => c.tag === tag);
  };

  const formatDate = (date: { year: number; month: number; day: number }): string => {
    if (!date) return '---';
    return `${date.day}/${date.month}/${date.year}`;
  };

  const safeNum = (v: number | null | undefined): string =>
    (v ?? 0).toLocaleString();
  const safeRatio = (v: number | null | undefined): string =>
    (v ?? 1).toFixed(2);

  return (
    <div className="battle-history-overlay">
      <div ref={dialogRef} className="battle-history-modal" role="dialog" aria-modal="true" aria-label="Histórico de Batalhas">
        <div className="battle-history-header">
          <h2>📜 Histórico de Batalhas</h2>
          <button className="battle-history-close" aria-label="Fechar histórico de batalhas" onClick={onClose}>✕</button>
        </div>

        <div className="battle-history-content">
          <div role="group" aria-label="Filtrar histórico" style={{display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12}}>
            {([['ALL', 'Todos'], ['LAND', '⚔️ Terrestres'], ['NAVAL', '⚓ Navais'], ['AIR', '✈️ Aéreos']] as const).map(([value, label]) =>
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
          </div>
          {visibleEntries.length === 0 ? (
            <div className="battle-history-empty">
              <p>Nenhuma batalha registrada ainda.</p>
              <p className="battle-history-empty-subtitle">
                As batalhas aparecerão aqui conforme ocorrem.
              </p>
            </div>
          ) : (
            <div className="battle-history-list">
              {visibleEntries.map(entry => {
                if (entry.kind === 'AIR') {
                  const report = entry.battle;
                  const location = airZoneById.get(report.zoneId)?.name ?? report.zoneId;
                  return <div key={entry.key} className="battle-history-item" role="button" tabIndex={0}
                    aria-label={`Abrir relatório aéreo de ${location}`} onClick={() => onViewAirBattle?.(report)}
                    onKeyDown={event => activate(event, () => onViewAirBattle?.(report))}>
                    <div className="battle-history-item-header"><span>✈️ Combate aéreo</span><span>{location}</span>
                      <span>{formatAirCombatDay(report.startedAt)} → {formatAirCombatDay(report.endedAt ?? report.lastCombatDay)}</span></div>
                    <div className="battle-history-item-body">{Object.entries(report.lossesByCountry).map(([tag, lost]) =>
                      <div key={tag} className="battle-history-army"><span>{tag}</span><span>- {lost} {lost === 1 ? 'aeronave' : 'aeronaves'}</span></div>)}</div>
                  </div>;
                }
                if (entry.kind === 'NAVAL') {
                  const battle = entry.battle, node = seaNodeById.get(battle.seaNodeId);
                  const location = node ? `${node.ocean} · ${node.id}` : battle.seaNodeId;
                  const lostShips = Object.values(battle.participantSnapshots ?? {}).flat().reduce((sum, p) =>
                    sum + Object.values(p.lostShips).reduce((total, lost) => total + (lost ?? 0), 0), 0);
                  return <div key={entry.key} className="battle-history-item" role="button" tabIndex={0}
                    aria-label={`Abrir relatório naval de ${location}`} onClick={() => onViewNavalBattle?.(battle)}
                    onKeyDown={event => activate(event, () => onViewNavalBattle?.(battle))}>
                    <div className="battle-history-item-header"><span>⚓ Batalha naval</span><span>{location}</span>
                      <span>{formatAirCombatDay(battle.startedAt)} · {battle.days} {battle.days === 1 ? 'dia' : 'dias'}</span></div>
                    <div className="battle-history-item-body">Dano: A {battle.lossesA.toFixed(0)} / B {battle.lossesB.toFixed(0)}
                      {battle.participantSnapshots && <span> · Navios perdidos: {lostShips}</span>}</div>
                    <div className="battle-history-item-footer">{battle.winner === 'DRAW' ? 'Empate' : battle.winner ? `Lado ${battle.winner} vencedor` : 'Combate encerrado'}</div>
                  </div>;
                }
                const battle = entry.battle;
                const attackerCountry = getCountryByTag(battle.attackerOriginal?.owner || battle.attacker?.owner);
                const defenderCountry = getCountryByTag(battle.defenderOriginal?.owner || battle.defender?.owner);
                const playerWon = battle.participantDetails?.some(p=>p.owner===playerCountryTag&&p.side===battle.winner) ||
                  (battle.winner === 'attacker' && (battle.attackerOriginal?.owner === playerCountryTag || battle.attacker?.owner === playerCountryTag)) ||
                  (battle.winner === 'defender' && (battle.defenderOriginal?.owner === playerCountryTag || battle.defender?.owner === playerCountryTag));

                const cancelled=battle.endReason==='hostility_ended'||battle.endReason==='territory_invalid';
                const retreatInfo = battle.retreatInfo;

                return (
                  <div
                    key={entry.key}
                    className={`battle-history-item ${cancelled ? '' : playerWon ? 'victory' : 'defeat'}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Abrir relatório de ${battle.provinceName}`}
                    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onViewBattle(battle); } }}
                    onClick={() => onViewBattle(battle)}
                  >
                    <div className="battle-history-item-header">
                      <span className="battle-history-date">
                        ⚔️ Terrestre · {formatDate(battle.date)}
                      </span>
                      <span className="battle-history-location">
                        📍 {battle.provinceName || '---'}
                      </span>
                      {retreatInfo?.retreated && (
                        <span className="battle-history-retreat" style={{ marginLeft: 8, color: '#fbbf24', fontSize: '0.8em' }}>
                          🏃 {retreatInfo.troops} → {retreatInfo.toName}
                        </span>
                      )}
                    </div>

                    <div className="battle-history-item-body">
                      <div className="battle-history-army">
                        <span className="battle-history-flag">{attackerCountry?.flag}</span>
                        <span className="battle-history-name">{attackerCountry?.name || battle.attackerOriginal?.owner}</span>
                        <span className="battle-history-casualties">
                          -{safeNum(battle.attackerCasualties)}
                        </span>
                      </div>

                      <div className="battle-history-vs">VS</div>

                      <div className="battle-history-army">
                        <span className="battle-history-flag">{defenderCountry?.flag}</span>
                        <span className="battle-history-name">{defenderCountry?.name || battle.defenderOriginal?.owner}</span>
                        <span className="battle-history-casualties">
                          -{safeNum(battle.defenderCasualties)}
                        </span>
                      </div>
                    </div>

                    <div className="battle-history-item-footer">
                      <span className={`battle-history-result ${cancelled ? '' : playerWon ? 'victory' : 'defeat'}`}>
                        {cancelled ? 'Combate encerrado' : playerWon ? '🏆 Vitória' : '💀 Derrota'}
                      </span>
                      <span className="battle-history-ratio">
                        Ratio: {safeRatio(battle.powerRatio)}:1
                        {retreatInfo?.retreated ? ` | 🏃 Recuo` : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
