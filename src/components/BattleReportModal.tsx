import { getUnitName } from '../utils/translations';
import React from 'react';
import { CombatResult, Country } from '../types';
import { formatArmySize } from '../utils/formatters';
import { useMilitaryDialog } from './useMilitaryDialog';

interface BattleReportModalProps {
  battleResult: CombatResult;
  playerCountry: Country;
  allCountries: Country[];
  onClose: () => void;
}

export const BattleReportModal: React.FC<BattleReportModalProps> = ({
  battleResult,
  playerCountry,
  allCountries,
  onClose,
}) => {
  const dialogRef = useMilitaryDialog(onClose);
  const { attackerOriginal, defenderOriginal, attacker, defender, winner, provinceName, duration } = battleResult;
  const playerWon = battleResult.participantDetails?.some(p => p.owner === playerCountry.tag && p.side === winner) || (winner === 'attacker' && attackerOriginal.owner === playerCountry.tag) || (winner === 'defender' && defenderOriginal.owner === playerCountry.tag);
  const attackerCountry = allCountries.find(c => c.tag === attackerOriginal.owner);
  const defenderCountry = allCountries.find(c => c.tag === defenderOriginal.owner);
  const getRealSize = (army: typeof attackerOriginal): number =>
    army.regiments.reduce((sum, regiment) => sum + regiment.strength, 0);

  const retreatInfo = battleResult.retreatInfo;
  const combatReport = battleResult.combatReport;
  const cancelled = battleResult.endReason === 'hostility_ended' || battleResult.endReason === 'territory_invalid';

  const formatPercent = (value: number) =>
    `${Math.round(value)}%`;

  const formatSupply = (status: 'good' | 'low' | 'critical') => {
    switch (status) {
      case 'good':
        return 'Bom';
      case 'low':
        return 'Baixo';
      case 'critical':
        return 'Crítico';
    }
  };

  const formatEndReason = () => {
    switch (battleResult.endReason ?? combatReport?.endReason) {
      case 'organization':
        return 'Colapso de organização';
      case 'morale':
        return 'Colapso de moral';
      case 'annihilation':
        return 'Aniquilação';
      case 'no_retreat': return 'Aniquilação sem rota de retirada';
      case 'hostility_ended': return 'Hostilidade encerrada';
      case 'territory_invalid': return 'Província indisponível';
      case 'side_empty': return 'Lado sem participantes';
      case 'duration':
        return 'Fim da duração do combate';
      default:
        return 'Resultado militar';
    }
  };


  const renderComposition = (
    composition: NonNullable<typeof combatReport>['attacker']['regimentComposition']
  ) => {
    const entries = Object.entries(composition);

    if (entries.length === 0) {
      return null;
    }

    return (
      <div className="battle-report-composition">
        <div className="stat-row">
          <span className="stat-label">Composição:</span>
        </div>

        {entries.map(([type, values]) => {
          if (!values) return null;

          return (
            <div className="stat-row" key={type}>
              <span className="stat-label">
                {getUnitName(type)}
              </span>

              <span className="stat-value">
                {formatArmySize(values.initial)}
                {' → '}
                {formatArmySize(values.final)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const participantDetails = battleResult.participantDetails ?? [];

  const defenderDetails = participantDetails.filter(
    p => p.side === 'defender'
  );

  const attackerDetails = participantDetails.filter(
    p => p.side === 'attacker'
  );

  const isStackwipe = battleResult.isStackwipe ?? false;
  const totalAttackerInitial =
    battleResult.totalAttackerInitial ??
    getRealSize(attackerOriginal);

  const totalDefenderInitial =
    battleResult.totalDefenderInitial ??
    getRealSize(defenderOriginal);
  let totalAttackerFinal =
    attackerDetails.length > 0
      ? attackerDetails.reduce((sum, detail) => sum + detail.final, 0)
      : battleResult.attackerCurrentTroops ?? getRealSize(attacker);

  let totalDefenderFinal =
    defenderDetails.length > 0
      ? defenderDetails.reduce((sum, detail) => sum + detail.final, 0)
      : battleResult.defenderCurrentTroops ?? getRealSize(defender);
  // Força final = 127 se teve recuo
  if (retreatInfo?.retreated) {
    if (retreatInfo.owner === defenderOriginal.owner) {
      totalDefenderFinal = retreatInfo.troops;
    } else {
      totalAttackerFinal = retreatInfo.troops;
    }
  }
  const calculatedAttackerCasualties = Math.max(0, totalAttackerInitial - totalAttackerFinal);
  const calculatedDefenderCasualties = Math.max(0, totalDefenderInitial - totalDefenderFinal);
  const isAttackerLoser = winner === 'defender';
  const isDefenderLoser = winner === 'attacker';
  const attackerAnnihilated = isAttackerLoser && totalAttackerFinal === 0 && !retreatInfo?.retreated;
  const defenderAnnihilated = isDefenderLoser && totalDefenderFinal === 0 && !retreatInfo?.retreated;



  return (
    <div className="battle-report-overlay">
      <div ref={dialogRef} className="battle-report-modal" role="dialog" aria-modal="true" aria-label={`Relatório de batalha em ${provinceName}`}>
        <div className={`battle-report-header ${cancelled ? '' : playerWon ? 'victory' : 'defeat'}`}>
          <div className="battle-report-icon">{cancelled ? '⚔️' : playerWon ? '🏆' : '💀'}</div>
          <h2 className="battle-report-title" tabIndex={0}>{cancelled ? 'COMBATE ENCERRADO' : playerWon ? 'VITÓRIA!' : 'DERROTA'}</h2>
          <p className="battle-report-subtitle">Batalha de {provinceName}</p>
        </div>
        <div className="battle-report-info">
          {(combatReport || battleResult.endReason) && (
            <div className="battle-report-info-item">
              <span className="label">Motivo:</span>
              <span className="value">
                {formatEndReason()}
              </span>
            </div>
          )}
          <div className="battle-report-info-item"><span className="label">Duração:</span><span className="value">{duration} dias</span></div>
          <div className="battle-report-info-item"><span className="label">Ratio:</span><span className="value">{battleResult.powerRatio.toFixed(2)}:1</span></div>
          {isStackwipe && <div className="battle-report-info-item"><span className="label" style={{ color: '#ff4444' }}>💀 STACKWIPE!</span></div>}
          {retreatInfo?.retreated && <div className="battle-report-info-item"><span className="label" style={{ color: '#4ade80' }}>🏃 RECUO para {retreatInfo.toName} com {retreatInfo.troops}</span></div>}
        </div>
        <div className="battle-report-info">
          {battleResult.participantDetails?.map(p => <p key={p.id}>{p.side === 'attacker' ? 'Atacante' : 'Defensor'}: {p.name ?? p.id} ({p.owner}) · {p.initial ?? p.final + (p.loss ?? 0)} → {p.final} · Baixas {p.loss ?? 0}</p>)}
          {Object.entries(battleResult.countryCasualties ?? {}).map(([tag,loss]) => <p key={tag}>Baixas {tag}: {loss}</p>)}
          {Object.entries(battleResult.airModifiers ?? {}).map(([tag,air]) => <p key={tag}>{tag}: Superioridade ×{air.superiority.toFixed(2)} · CAS +{air.cas.toFixed(2)}</p>)}
          {Object.entries(battleResult.retreatOutcomes ?? {}).map(([id,outcome]) => <p key={id}>{battleResult.participantDetails?.find(participant => participant.id === id)?.name ?? id}: {outcome.reason === 'no_retreat' ? 'Aniquilado sem rota' : `Retirada para ${outcome.destinationName ?? outcome.destinationId}`}</p>)}
        </div>
        <div className="battle-report-armies">
          <div className={`battle-report-army ${winner === 'attacker' ? 'winner' : 'loser'}`}>
            <div className="army-header"><span className="army-flag">{attackerCountry?.flag}</span><div className="army-info"><h3>{attackerCountry?.name}</h3><p>{attackerOriginal.name} {isAttackerLoser && (retreatInfo?.retreated && retreatInfo.owner === attackerOriginal.owner ? `🏃 recuou para ${retreatInfo.toName} com ${retreatInfo.troops}` : attackerAnnihilated ? '💀 ANIQUILADO' : '')}</p></div>{!cancelled && winner === 'attacker' && <span className="winner-badge">VENCEDOR</span>}</div>
            <div className="army-stats">
              <div className="stat-row"><span className="stat-label">Tropas Iniciais:</span><span className="stat-value">{formatArmySize(totalAttackerInitial)}</span></div>
              <div className="stat-row"><span className="stat-label">Sobreviventes:</span><span className="stat-value">{totalAttackerFinal === 0 ? '0 💀' : `${formatArmySize(totalAttackerFinal)} ${retreatInfo?.owner === attackerOriginal.owner ? '🏃' : ''}`}</span></div>
              <div className="stat-row casualties"><span className="stat-label">Baixas:</span><span className="stat-value">{formatArmySize(calculatedAttackerCasualties)}</span></div>
              {combatReport && (
                <>
                  <div className="stat-row">
                    <span className="stat-label">Organização:</span>
                    <span className="stat-value">
                      {formatPercent(combatReport.attacker.initialOrganization)}
                      {' → '}
                      {formatPercent(combatReport.attacker.finalOrganization)}
                    </span>
                  </div>

                  <div className="stat-row">
                    <span className="stat-label">Moral:</span>
                    <span className="stat-value">
                      {formatPercent(combatReport.attacker.initialMorale)}
                      {' → '}
                      {formatPercent(combatReport.attacker.finalMorale)}
                    </span>
                  </div>

                  <div className="stat-row">
                    <span className="stat-label">Supply:</span>
                    <span className="stat-value">
                      {formatSupply(combatReport.attacker.initialSupply)}
                      {' → '}
                      {formatSupply(combatReport.attacker.finalSupply)}
                    </span>
                  </div>

                  <div className="stat-row">
                    <span className="stat-label">Ataque:</span>
                    <span className="stat-value">
                      {combatReport.attacker.attack.toFixed(1)}
                    </span>
                  </div>

                  <div className="stat-row">
                    <span className="stat-label">Defesa:</span>
                    <span className="stat-value">
                      {combatReport.attacker.defense.toFixed(1)}
                    </span>
                  </div>

                  <div className="stat-row">
                    <span className="stat-label">Choque:</span>
                    <span className="stat-value">
                      {combatReport.attacker.shock.toFixed(1)}
                    </span>
                  </div>
                  {combatReport &&
                    renderComposition(combatReport.attacker.regimentComposition)}
                </>
              )}
            </div>
          </div>
          <div className="battle-report-vs">VS</div>
          <div className={`battle-report-army ${winner === 'defender' ? 'winner' : 'loser'}`}>
            <div className="army-header"><span className="army-flag">{defenderCountry?.flag}</span><div className="army-info"><h3>{defenderCountry?.name}</h3><p>{defenderOriginal.name} {isDefenderLoser && (retreatInfo?.retreated && retreatInfo.owner === defenderOriginal.owner ? `🏃 recuou para ${retreatInfo.toName} com ${retreatInfo.troops}` : defenderAnnihilated ? '💀 ANIQUILADO' : '')}</p></div>{!cancelled && winner === 'defender' && <span className="winner-badge">VENCEDOR</span>}</div>
            {combatReport && (
              <div
                style={{
                  background: 'rgba(34,197,94,0.12)',
                  border: '1px solid rgba(34,197,94,0.25)',
                  borderRadius: '6px',
                  padding: '8px',
                  margin: '8px 0',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.85em',
                  }}
                >
                  <span>🛡️ Fortificação:</span>
                  <span>
                    Nv.{combatReport.fortLevel}
                  </span>
                </div>
              </div>

            )}
            <div className="army-stats">
              <div className="stat-row"><span className="stat-label">Tropas Iniciais:</span><span className="stat-value">{formatArmySize(totalDefenderInitial)}</span></div>
              <div className="stat-row"><span className="stat-label">Sobreviventes:</span><span className="stat-value">{retreatInfo?.retreated && retreatInfo.owner === defenderOriginal.owner ? `${formatArmySize(totalDefenderFinal)} (${totalDefenderFinal}) 🏃 para ${retreatInfo.toName}` : defenderAnnihilated ? '0 💀' : `${formatArmySize(totalDefenderFinal)} (${totalDefenderFinal})`}</span></div>
              <div className="stat-row casualties"><span className="stat-label">Baixas:</span><span className="stat-value">{formatArmySize(calculatedDefenderCasualties)}</span></div>
              {combatReport && (
                <>
                  <div className="stat-row">
                    <span className="stat-label">Organização:</span>
                    <span className="stat-value">
                      {formatPercent(combatReport.defender.initialOrganization)}
                      {' → '}
                      {formatPercent(combatReport.defender.finalOrganization)}
                    </span>
                  </div>

                  <div className="stat-row">
                    <span className="stat-label">Moral:</span>
                    <span className="stat-value">
                      {formatPercent(combatReport.defender.initialMorale)}
                      {' → '}
                      {formatPercent(combatReport.defender.finalMorale)}
                    </span>
                  </div>

                  <div className="stat-row">
                    <span className="stat-label">Supply:</span>
                    <span className="stat-value">
                      {formatSupply(combatReport.defender.initialSupply)}
                      {' → '}
                      {formatSupply(combatReport.defender.finalSupply)}
                    </span>
                  </div>

                  <div className="stat-row">
                    <span className="stat-label">Ataque:</span>
                    <span className="stat-value">
                      {combatReport.defender.attack.toFixed(1)}
                    </span>
                  </div>

                  <div className="stat-row">
                    <span className="stat-label">Defesa:</span>
                    <span className="stat-value">
                      {combatReport.defender.defense.toFixed(1)}
                    </span>
                  </div>

                  <div className="stat-row">
                    <span className="stat-label">Choque:</span>
                    <span className="stat-value">
                      {combatReport.defender.shock.toFixed(1)}
                    </span>
                  </div>
                </>
              )}
            </div>
            {combatReport &&
              renderComposition(combatReport.defender.regimentComposition)}
          </div>
        </div>
        <div className="battle-report-footer"><button className="battle-report-close-btn" onClick={onClose}>Continuar</button></div>
      </div>
    </div>
  );
};
