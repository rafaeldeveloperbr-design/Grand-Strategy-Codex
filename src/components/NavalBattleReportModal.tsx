import type { Country } from '../types';
import type { Fleet, NavalBattle, NavalUnitType } from '../types/naval';
import { navalParticipants } from '../engine/naval/reports';
import { seaNodeById } from '../engine/naval';
import { useMilitaryDialog } from './useMilitaryDialog';

const shipNames: Record<NavalUnitType, string> = { DESTROYER: 'Contratorpedeiros', CRUISER: 'Cruzadores', BATTLESHIP: 'Encouraçados', TRANSPORT: 'Transportes' };

export function NavalBattleReportModal({ battle, playerCountryTag, countries, fleets = [], onClose }: { battle: NavalBattle; playerCountryTag: string; countries: readonly Country[]; fleets?: readonly Fleet[]; onClose: () => void }) {
  const ref = useMilitaryDialog(onClose);
  const sides = { A: navalParticipants(battle, 'A', fleets), B: navalParticipants(battle, 'B', fleets) };
  const won = battle.winner && battle.winner !== 'DRAW' && sides[battle.winner].some(p => p.countryTag === playerCountryTag);
  const title = !battle.winner ? 'COMBATE NAVAL ENCERRADO' : battle.winner === 'DRAW' ? 'EMPATE' : won ? 'VITÓRIA NAVAL' : 'DERROTA NAVAL';
  const node = seaNodeById.get(battle.seaNodeId);
  const location = node ? `${node.ocean} · ${node.id}` : battle.seaNodeId;
  return <div className="battle-report-overlay"><div ref={ref} className="battle-report-modal" style={{ maxWidth: 760 }} role="dialog" aria-modal="true" aria-label={`Relatório naval em ${location}`}>
    <header className={`battle-report-header ${battle.winner && battle.winner !== 'DRAW' ? won ? 'victory' : 'defeat' : ''}`}><h2 className="battle-report-title" tabIndex={0}>{title}</h2><p>{location}</p></header>
    <div className="battle-report-info">Duração: {battle.days} dias</div>
    <div className="battle-report-armies">{(['A', 'B'] as const).map(side => <section key={side} className="battle-report-army"><h3>Lado {side}</h3>
      {sides[side].map(p => { const country = countries.find(c => c.tag === p.countryTag); return <div key={p.fleetId}><h4>{p.fleetName}</h4><p>{country?.flag} {country?.name ?? p.countryTag}</p>
        {Object.keys(p.initialShips).length ? (Object.keys(p.initialShips) as NavalUnitType[]).map(type => <p key={type}>{shipNames[type]}: {p.initialShips[type] ?? 0} → {p.finalShips[type] ?? 0} · Perdidos: {p.lostShips[type] ?? 0}</p>) : <p>Composição inicial indisponível</p>}
      </div>; })}<p>Dano sofrido: {(side === 'A' ? battle.lossesA : battle.lossesB).toFixed(0)}</p>
    </section>)}</div>
    <div className="battle-report-info">{(battle.embarkedTroopLosses ?? 0) > 0 && <p>Tropas embarcadas perdidas: {battle.embarkedTroopLosses!.toLocaleString()}</p>}<p>Resultado: {battle.winner === 'DRAW' ? 'Empate' : battle.winner ? `Lado ${battle.winner} vencedor` : 'Combate encerrado'}</p></div>
    <footer className="battle-report-footer"><button className="battle-report-close-btn" onClick={onClose}>Continuar</button></footer>
  </div></div>;
}
