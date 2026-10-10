// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AirCombatReportModal } from '../AirCombatReportModal';
import { createAirCombatReport, finishAirCombatReport } from '../../engine/air/reports';
import { airZones } from '../../engine/air/world';
import { countries } from '../../data/map';
afterEach(cleanup);
const active = createAirCombatReport('test', airZones[0].id, 42, [{ wingId: 'gone', wingName: 'Destroyed Wing', countryTag: 'BRA', type: 'FIGHTER', mission: 'INTERCEPTION', initialAircraft: 3, finalAircraft: 0, aircraftLost: 3 }]);
const report = finishAirCombatReport({ ...active, lastCombatDay: 45 }, 48);
it('renders snapshots including destroyed wings, country/type summaries and neutral heading', () => {
  render(
    <AirCombatReportModal
      report={report}
      countries={countries}
      playerCountryTag="BRA"
      onClose={vi.fn()}
    />
  );

  expect(screen.getByText('Destroyed Wing · Destruída')).toBeTruthy();

  expect(screen.getByText('Inicial: 3')).toBeTruthy();
  expect(screen.getByText('Perdidas: 3')).toBeTruthy();
  expect(screen.getByText('Final: 0')).toBeTruthy();

  expect(screen.queryByText(/Reposições:/)).toBeNull();

  expect(screen.getByText('FIGHTER · INTERCEPTION')).toBeTruthy();
  expect(screen.getByText('Perdas do país: 3')).toBeTruthy();
  expect(screen.getByText('FIGHTER: 3')).toBeTruthy();
  expect(screen.getByText('RELATÓRIO DE COMBATE AÉREO')).toBeTruthy();

  expect(
    screen.queryByText(/VITÓRIA|DERROTA|Vencedor/i)
  ).toBeNull();
});
it('renders aircraft replacements when present', () => {
  const reportWithReplacements = {
    ...report,
    participants: report.participants.map(p => ({
      ...p,
      initialAircraft: 24,
      finalAircraft: 23,
      aircraftLost: 10,
      aircraftReplacements: 9,
    })),
  };

  render(
    <AirCombatReportModal
      report={reportWithReplacements}
      countries={countries}
      playerCountryTag="BRA"
      onClose={vi.fn()}
    />
  );

  expect(screen.getByText('Inicial: 24')).toBeTruthy();
  expect(screen.getByText('Reposições: +9')).toBeTruthy();
  expect(screen.getByText('Perdidas: 10')).toBeTruthy();
  expect(screen.getByText('Final: 23')).toBeTruthy();
});
it('renders accumulated period and duration', () => {
  render(<AirCombatReportModal report={report} countries={countries} playerCountryTag="BRA" onClose={vi.fn()} />);
  expect(screen.getByText('Período: 12/02/1970 → 18/02/1970')).toBeTruthy();
  expect(screen.getByText('Duração aproximada: 7 dias')).toBeTruthy();
});
it('labels an ACTIVE period as ongoing', () => {
  render(<AirCombatReportModal report={active} countries={countries} playerCountryTag="BRA" onClose={vi.fn()} />);
  expect(screen.getByText(/em andamento/)).toBeTruthy();
  expect(screen.getByText('Duração aproximada: 1 dia')).toBeTruthy();
});
it('closes through the existing dialog control', () => { const close = vi.fn(); render(<AirCombatReportModal report={report} countries={countries} playerCountryTag="BRA" onClose={close} />); fireEvent.click(screen.getByText('Fechar')); expect(close).toHaveBeenCalledOnce(); });
