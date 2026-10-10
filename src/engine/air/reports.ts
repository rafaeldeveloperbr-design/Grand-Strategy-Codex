import type { War } from '../../types';
import type { AirCombatReport, AirCombatParticipantSnapshot, AirEngagement, AirWing } from '../../types/air';
import { AIR_COMBAT_HISTORY_LIMIT, AIR_COMBAT_INACTIVITY_DAYS } from '../../types/air';
import { buildNavalHostility } from '../naval';
import { airZoneById } from './world';

function aggregateLosses(participants: AirCombatParticipantSnapshot[]) {
  const lossesByCountry: AirCombatReport['lossesByCountry'] = Object.fromEntries([...new Set(participants.map(p => p.countryTag))].map(tag => [tag, 0]));
  const lossesByType: AirCombatReport['lossesByType'] = {};
  let totalAircraftLost = 0;
  for (const p of participants) {
    lossesByCountry[p.countryTag] += p.aircraftLost;
    lossesByType[p.type] = (lossesByType[p.type] ?? 0) + p.aircraftLost;
    totalAircraftLost += p.aircraftLost;
  }
  return { lossesByCountry, lossesByType, totalAircraftLost };
}

export function createAirCombatReport(id: string, zoneId: string, day: number, participants: AirCombatParticipantSnapshot[]): AirCombatReport {
  return {
    id, zoneId, day, status: 'ACTIVE', startedAt: day, lastCombatDay: day,
    participants, ...aggregateLosses(participants)
  };
}

export function updateAirCombatReport(
  report: AirCombatReport,
  day: number,
  snapshots: AirCombatParticipantSnapshot[]
): AirCombatReport {
  if (report.status === 'ENDED') return report;

  const participants = new Map(
    report.participants.map(p => [p.wingId, p])
  );

  for (const p of snapshots) {
    const previous = participants.get(p.wingId);

    if (!previous) {
      participants.set(p.wingId, {
        ...p,
        aircraftReplacements: p.aircraftReplacements ?? 0,
      });
      continue;
    }

    /*
     * Se no último engagement a Wing terminou com 20 aviões
     * e neste novo engagement começou com 23,
     * então recebeu 3 replacements entre os dois.
     */
    const replacementsSinceLastEngagement = Math.max(
      0,
      p.initialAircraft - previous.finalAircraft
    );

    participants.set(p.wingId, {
      ...previous,

      finalAircraft: p.finalAircraft,

      aircraftLost:
        previous.aircraftLost + p.aircraftLost,

      aircraftReplacements:
        (previous.aircraftReplacements ?? 0) +
        replacementsSinceLastEngagement,
    });
  }

  const ordered = [...participants.values()].sort(
    (a, b) => a.wingId.localeCompare(b.wingId)
  );

  return {
    ...report,
    lastCombatDay: day,
    participants: ordered,
    ...aggregateLosses(ordered),
  };
}

export function finishAirCombatReport(
  report: AirCombatReport,
  day: number
): AirCombatReport {
  return report.status === 'ENDED'
    ? report
    : {
        ...report,
        status: 'ENDED',
        endedAt: day,
      };
}

export function limitAirCombatHistory(reports: AirCombatReport[]): AirCombatReport[] {
  const ended = reports.filter(r => r.status === 'ENDED').sort((a, b) =>
    a.endedAt! - b.endedAt! || a.startedAt - b.startedAt || a.id.localeCompare(b.id));
  const active = reports.filter(r => r.status === 'ACTIVE').sort((a, b) => a.zoneId.localeCompare(b.zoneId));
  return [...ended.slice(-AIR_COMBAT_HISTORY_LIMIT), ...active];
}

/** Uses existing engagements and wing lookup; only scans the small report history.
 * Closure uses the three-day inactivity window, including peace and withdrawal.
 */
export function advanceAirCombatReports(reports: AirCombatReport[], engagements: AirEngagement[], wings: readonly AirWing[],
  day: number, hostility: ReadonlyMap<string, ReadonlySet<string>>, onEnded?: (report: AirCombatReport) => void): AirCombatReport[] {
  const next = [...reports];
  const activeByZone = new Map(next.flatMap((r, index) => r.status === 'ACTIVE' ? [[r.zoneId, index] as const] : []));
  const wingById = new Map(wings.map(w => [w.id, w]));
  const existingIds = new Set(next.map(r => r.id));
  for (const engagement of engagements) {
    const snapshots = engagement.wingIds.map(id => {
      const w = wingById.get(id)!;
      const aircraftLost = Math.min(w.aircraftCount, engagement.losses[id] ?? 0);
      return {
        wingId: id,
        wingName: w.name,
        countryTag: w.countryTag,
        type: w.type,
        mission: w.mission,

        initialAircraft: w.aircraftCount,
        finalAircraft: w.aircraftCount - aircraftLost,
        aircraftLost,

        aircraftReplacements: 0,
      };
    });
    const index = activeByZone.get(engagement.zoneId);
    let report: AirCombatReport;
    if (index === undefined) {
      const base = `air-battle-${day}-${engagement.zoneId}`;
      let id = base, suffix = 2;
      while (existingIds.has(id)) id = `${base}-${suffix++}`;
      existingIds.add(id);
      report = createAirCombatReport(id, engagement.zoneId, day, snapshots);
    } else report = updateAirCombatReport(next[index], day, snapshots);
    const pairs = new Map((report.hostileCountryPairs ?? []).map(pair => [JSON.stringify(pair), pair]));
    const tags = [...new Set(snapshots.map(p => p.countryTag))].sort();
    for (let a = 0; a < tags.length; a++) for (let b = a + 1; b < tags.length; b++) {
      if (hostility.get(tags[a])?.has(tags[b])) {
        const pair: [string, string] = [tags[a], tags[b]];
        pairs.set(JSON.stringify(pair), pair);
      }
    }
    report = { ...report, hostileCountryPairs: [...pairs.values()].sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])) };
    if (index === undefined) { activeByZone.set(engagement.zoneId, next.length); next.push(report); }
    else next[index] = report;
  }
  for (let i = 0; i < next.length; i++) {
    const report = next[i];
    if (report.status === 'ACTIVE' && day - report.lastCombatDay >= AIR_COMBAT_INACTIVITY_DAYS) {
      next[i] = finishAirCombatReport(report, day);
      onEnded?.(next[i]);
    }
  }
  return limitAirCombatHistory(next);
}

export function airCombatReportToast(report: AirCombatReport, player: string, wars: readonly War[], playerName = player): string | undefined {
  if (report.status !== 'ENDED' || !report.participants.some(p => p.countryTag === player)) return undefined;
  const enemies = report.hostileCountryPairs ? new Set(report.hostileCountryPairs.flatMap(([a, b]) =>
    a === player ? [b] : b === player ? [a] : [])) : buildNavalHostility(wars).get(player);
  const playerSide = new Set(report.participants.map(p => p.countryTag).filter(tag => !enemies?.has(tag)));
  const friendlyLosses = report.participants.reduce((sum, p) => sum + (playerSide.has(p.countryTag) ? p.aircraftLost : 0), 0);
  const enemyLosses = report.participants.reduce((sum, p) => sum + (enemies?.has(p.countryTag) ? p.aircraftLost : 0), 0);
  const losses = (n: number) => `${n} ${n === 1 ? 'aeronave perdida' : 'aeronaves perdidas'}`;
  const sideName = playerSide.size > 1 ? `${playerName} e aliados` : playerName;
  return `Combate aéreo encerrado em ${airZoneById.get(report.zoneId)?.name ?? report.zoneId}: ${sideName}: ${losses(friendlyLosses)}; inimigos: ${losses(enemyLosses)}.`;
}

export function formatAirCombatDay(day: number): string {
  const date = new Date(day * 86400000);
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
}
