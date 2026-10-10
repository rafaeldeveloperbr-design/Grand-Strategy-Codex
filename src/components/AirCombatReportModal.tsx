import type { Country } from '../types';
import type { AirCombatReport } from '../types/air';
import { airZoneById } from '../engine/air/world';
import { formatAirCombatDay } from '../engine/air/reports';
import { useMilitaryDialog } from './useMilitaryDialog';

export function AirCombatReportModal({ report, playerCountryTag, countries, onClose }: {
  report: AirCombatReport; playerCountryTag: string; countries: readonly Country[]; onClose: () => void;
}) {
  const ref = useMilitaryDialog(onClose);
  const location = airZoneById.get(report.zoneId)?.name ?? report.zoneId;
  const through = report.endedAt ?? report.lastCombatDay;
  const duration = Math.max(1, through - report.startedAt + 1);
  return <div className="battle-report-overlay"><div ref={ref} className="battle-report-modal" style={{ maxWidth: 760 }} role="dialog" aria-modal="true" aria-label={`Relatório de combate aéreo em ${location}`}>
    <header className="battle-report-header"><h2 className="battle-report-title" tabIndex={0}>RELATÓRIO DE COMBATE AÉREO</h2><p>{location}</p></header>
    <div className="battle-report-info"><p>Período: {formatAirCombatDay(report.startedAt)} → {formatAirCombatDay(through)}{report.status === 'ACTIVE' ? ' (em andamento)' : ''}</p>
      <p>Duração aproximada: {duration} {duration === 1 ? 'dia' : 'dias'}</p>
      <p>Total de aeronaves perdidas: {report.totalAircraftLost}</p>
    </div>
    <div className="battle-report-armies">{Object.entries(report.lossesByCountry).map(([tag, lost]) => {
      const country = countries.find(c => c.tag === tag);
      return <section key={tag} className="battle-report-army"><h3>{country?.flag} {country?.name ?? tag}{tag === playerCountryTag ? ' (Você)' : ''}</h3>
        {report.participants
          .filter(p => p.countryTag === tag)
          .map(p => (
            <div key={p.wingId}>
              <h4>
                {p.wingName}
                {p.finalAircraft === 0 ? ' · Destruída' : ''}
              </h4>

              <p>
                {p.type} · {p.mission ?? 'Sem missão'}
              </p>

              <p>Inicial: {p.initialAircraft}</p>

              {(p.aircraftReplacements ?? 0) > 0 && (
                <p>Reposições: +{p.aircraftReplacements ?? 0}</p>
              )}

              <p>Perdidas: {p.aircraftLost}</p>

              <p>Final: {p.finalAircraft}</p>
            </div>
          ))}        <p>Perdas do país: {lost}</p>
      </section>;
    })}</div>
    <div className="battle-report-info"><h3>Perdas por tipo</h3>{Object.entries(report.lossesByType).map(([type, lost]) => <p key={type}>{type}: {lost}</p>)}</div>
    <footer className="battle-report-footer"><button className="battle-report-close-btn" onClick={onClose}>Fechar</button></footer>
  </div></div>;
}
