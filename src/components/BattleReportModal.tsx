import React from 'react';
import { CombatResult, Country } from '../types';
import { formatArmySize } from '../utils/formatters';

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
  const { attackerOriginal, defenderOriginal, attacker, defender, winner, provinceName, duration } = battleResult;
  const playerWon = (winner === 'attacker' && attackerOriginal.owner === playerCountry.tag) || (winner === 'defender' && defenderOriginal.owner === playerCountry.tag);
  const attackerCountry = allCountries.find(c => c.tag === attackerOriginal.owner);
  const defenderCountry = allCountries.find(c => c.tag === defenderOriginal.owner);
  const getRealSize = (army: typeof attackerOriginal): number =>
    army.regiments.reduce((sum, regiment) => sum + regiment.strength, 0);

  const retreatInfo = battleResult.retreatInfo;
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
    console.log(`🏃 Modal recebeu recuo: ${retreatInfo.troops} para ${retreatInfo.toName}`);
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
  const prov = battleResult.province;
  const fortLevel = prov?.fortLevel ?? 0;
  const terrain = prov?.terrain ?? 'plains';
  const totalBonus = Math.min(50, 5 + fortLevel * 5 + (terrain === 'mountain' ? 15 : terrain === 'hill' ? 10 : terrain === 'forest' ? 5 : 0));
  const perDayLoss = Math.floor((totalDefenderInitial * (1 + totalBonus / 100)) / Math.max(1, duration));

 
    console.log('📊 BattleReportModal - CORRIGIDO:');
    if (retreatInfo?.retreated) console.log(`🏃 RECUO: ${retreatInfo.owner} com ${retreatInfo.troops} para ${retreatInfo.toName}`);
    console.log(` Atacante - Inicial: ${totalAttackerInitial}, Final: ${totalAttackerFinal}`);
    console.log(` Defensor - Inicial: ${totalDefenderInitial}, Final: ${totalDefenderFinal}`);
  

  return (
    <div className="battle-report-overlay">
      <div className="battle-report-modal">
        <div className={`battle-report-header ${playerWon ? 'victory' : 'defeat'}`}>
          <div className="battle-report-icon">{playerWon ? '🏆' : '💀'}</div>
          <h2 className="battle-report-title">{playerWon ? 'VITÓRIA!' : 'DERROTA'}</h2>
          <p className="battle-report-subtitle">Batalha de {provinceName}</p>
        </div>
        <div className="battle-report-info">
          <div className="battle-report-info-item"><span className="label">Duração:</span><span className="value">{duration} dias</span></div>
          <div className="battle-report-info-item"><span className="label">Ratio:</span><span className="value">{battleResult.powerRatio.toFixed(2)}:1</span></div>
          {isStackwipe && <div className="battle-report-info-item"><span className="label" style={{ color: '#ff4444' }}>💀 STACKWIPE!</span></div>}
          {retreatInfo?.retreated && <div className="battle-report-info-item"><span className="label" style={{ color: '#4ade80' }}>🏃 RECUO para {retreatInfo.toName} com {retreatInfo.troops}</span></div>}
        </div>
        <div className="battle-report-armies">
          <div className={`battle-report-army ${winner === 'attacker' ? 'winner' : 'loser'}`}>
            <div className="army-header"><span className="army-flag">{attackerCountry?.flag}</span><div className="army-info"><h3>{attackerCountry?.name}</h3><p>{attackerOriginal.name} {isAttackerLoser && (retreatInfo?.retreated && retreatInfo.owner === attackerOriginal.owner ? `🏃 recuou para ${retreatInfo.toName} com ${retreatInfo.troops}` : attackerAnnihilated ? '💀 ANIQUILADO' : '')}</p></div>{winner === 'attacker' && <span className="winner-badge">VENCEDOR</span>}</div>
            <div className="army-stats">
              <div className="stat-row"><span className="stat-label">Tropas Iniciais:</span><span className="stat-value">{formatArmySize(totalAttackerInitial)}</span></div>
              <div className="stat-row"><span className="stat-label">Sobreviventes:</span><span className="stat-value">{totalAttackerFinal === 0 ? '0 💀' : `${formatArmySize(totalAttackerFinal)} ${retreatInfo?.owner === attackerOriginal.owner ? '🏃' : ''}`}</span></div>
              <div className="stat-row casualties"><span className="stat-label">Baixas:</span><span className="stat-value">{formatArmySize(calculatedAttackerCasualties)}</span></div>
            </div>
          </div>
          <div className="battle-report-vs">VS</div>
          <div className={`battle-report-army ${winner === 'defender' ? 'winner' : 'loser'}`}>
            <div className="army-header"><span className="army-flag">{defenderCountry?.flag}</span><div className="army-info"><h3>{defenderCountry?.name}</h3><p>{defenderOriginal.name} {isDefenderLoser && (retreatInfo?.retreated && retreatInfo.owner === defenderOriginal.owner ? `🏃 recuou para ${retreatInfo.toName} com ${retreatInfo.troops}` : defenderAnnihilated ? '💀 ANIQUILADO' : '')}</p></div>{winner === 'defender' && <span className="winner-badge">VENCEDOR</span>}</div>
            <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '6px', padding: '8px', margin: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85em' }}><span>🛡️ Bônus Defesa:</span><span style={{ color: '#4ade80', fontWeight: 'bold' }}>{totalBonus}%</span></div>
            </div>
            <div className="army-stats">
              <div className="stat-row"><span className="stat-label">Tropas Iniciais:</span><span className="stat-value">{formatArmySize(totalDefenderInitial)}</span></div>
              <div className="stat-row"><span className="stat-label">Sobreviventes:</span><span className="stat-value">{retreatInfo?.retreated && retreatInfo.owner === defenderOriginal.owner ? `${formatArmySize(totalDefenderFinal)} (${totalDefenderFinal}) 🏃 para ${retreatInfo.toName}` : defenderAnnihilated ? '0 💀' : `${formatArmySize(totalDefenderFinal)} (${totalDefenderFinal})`}</span></div>
              <div className="stat-row casualties"><span className="stat-label">Baixas:</span><span className="stat-value">{formatArmySize(calculatedDefenderCasualties)}</span></div>
            </div>
          </div>
        </div>
        <div className="battle-report-footer"><button className="battle-report-close-btn" onClick={onClose}>Continuar</button></div>
      </div>
    </div>
  );
};