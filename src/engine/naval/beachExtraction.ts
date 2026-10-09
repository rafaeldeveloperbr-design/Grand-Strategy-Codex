import type { Army, Province } from '../../types';
import type { Fleet } from '../../types/naval';
import { buildNavalHostility, canUseNavalAccess } from './index';
import { coastalLandingError, portByProvince, resolveAmphibiousLandingSeaNode } from './world';
import { aboardFleet, buildTransportIndexes, fleetTransportCapacity, fleetTransportUsed, type TransportContext } from './transport';
import { calculateArmySize } from '../combat/combatCalculations';

export const AMPHIBIOUS_BEACH_EXTRACTION_DAYS = 5;
export const BEACH_EXTRACTION_LABEL = `Embarque pela praia — ${AMPHIBIOUS_BEACH_EXTRACTION_DAYS} dias`;

function validationContext(ctx: TransportContext) {
  return {
    hostility: buildNavalHostility(ctx.wars), relations: ctx.relations,
    battles: new Set(ctx.activeBattles?.flatMap(b => b.participantArmyIds)),
    invasions: new Set(ctx.naval.invasions?.map(o => o.fleetId)),
    friendlyLandings: new Set(ctx.armies.filter(a => a.friendlyBeachLanding).map(a => a.embarkedFleetId)),
  };
}
function positionError(army: Army, fleet: Fleet | undefined, province: Province | undefined, validation: ReturnType<typeof validationContext>): string | undefined {
  if (army.embarkedFleetId) return 'Army já está embarcado.';
  if (army.inCombat || validation.battles.has(army.id)) return 'Army está em batalha.';
  if (army.retreatProtectionDays) return 'Army em retirada/proteção de retirada.';
  if (!fleet || fleet.countryTag !== army.owner) return 'Army e Fleet devem pertencer ao mesmo Country; Fleet ausente ou destruída.';
  if (fleet.status === 'COMBAT' || fleet.status === 'RETREATING') return 'Fleet em combate ou retirada.';
  if (!province || army.location !== province.id) return 'Província da extração alterada ou inexistente.';
  const coastError = coastalLandingError(province.id);
  if (coastError) return `Army não está em porto operacional: ${coastError}`;
  if (portByProvince.has(province.id)) return 'Use o embarque normal no porto.';
  const node = resolveAmphibiousLandingSeaNode(province)!;
  if (fleet.status !== 'HOLDING' || fleet.locationSeaNodeId !== node.id || fleet.portProvinceId || fleet.movementProgress !== 0 || fleet.route.length) return 'Fleet não está parada no SeaNode correto da costa.';
  if (army.destination || army.targetDestination || army.path.length || army.movementPlan?.waypoints.length || army.movementProgress !== 0 || army.position) return 'Army em movimento: limpe a rota antes de iniciar extração.';
  if (validation.friendlyLandings.has(fleet.id)) return 'Fleet comprometida com desembarque amig\u00e1vel; cancele primeiro.';
  if (validation.invasions.has(fleet.id)) return 'Fleet comprometida com invasão; cancele a invasão antes de embarcar.';
  if (!canUseNavalAccess(army.owner, province, validation.relations, validation.hostility)) return 'Acesso à costa inválido.';
  if (calculateArmySize(army) <= 0) return 'Army sem tropas.';
}
export function startBeachExtraction(ctx: TransportContext, armyId: string, fleetId: string): { armies: Army[]; error?: string } {
  const army = ctx.armies.find(a => a.id === armyId), fleet = ctx.naval.fleets.find(f => f.id === fleetId);
  const fail = (error: string) => ({ armies: ctx.armies, error });
  if (!army || army.owner !== ctx.actor) return fail('Selecione um Army próprio.');
  const province = ctx.provinces.find(p => p.id === army.location);
  const error = positionError(army, fleet, province, validationContext(ctx));
  if (error) return fail(error);
  if (army.beachExtraction) return fail('Army já está em extração pela praia.');
  const cargo = buildTransportIndexes(ctx.armies), capacity = fleetTransportCapacity(fleet!);
  const used = fleetTransportUsed(cargo.byFleet.get(fleetId) ?? []) + fleetTransportUsed(cargo.extractionsByFleet.get(fleetId) ?? []);
  if (calculateArmySize(army) > capacity - used) return fail(`Transporte insuficiente: disponível ${capacity - used} / ${capacity}, incluindo reservas.`);
  return { armies: ctx.armies.map(a => a.id === armyId ? {
    ...a, targetArmyId: null, targetProvinceId: null,
    beachExtraction: { fleetId, provinceId: province!.id, seaNodeId: resolveAmphibiousLandingSeaNode(province!)!.id, elapsedDays: 0 },
  } : a) };
}
export function cancelBeachExtraction(armies: Army[], armyId: string, actor: string): Army[] {
  return armies.map(army => army.id === armyId && army.owner === actor && army.beachExtraction ? { ...army, beachExtraction: undefined } : army);
}
/** Run AFTER ordinary battle arrivals, so a day-five arrival cannot be escaped. */
export function beachExtractionTick(ctx: Omit<TransportContext, 'actor'>, engagedThisTick: ReadonlySet<string> = new Set(), advance = true) {
  if (!ctx.armies.some(a => a.beachExtraction)) return { armies: ctx.armies, messages: [] as Array<{ owner: string; message: string }> };
  const fleets = new Map(ctx.naval.fleets.map(f => [f.id, f])), provinces = new Map(ctx.provinces.map(p => [p.id, p]));
  const validation = validationContext({ ...ctx, actor: '' }), messages: Array<{ owner: string; message: string }> = [];
  const cancel = (army: Army, reason: string): Army => {
    messages.push({ owner: army.owner, message: `Extração pela praia cancelada: ${reason}` });
    return { ...army, beachExtraction: undefined };
  };
  // Remove invalid reservations before evaluating capacity. No array-order winner.
  let armies = ctx.armies.map(army => {
    const order = army.beachExtraction;
    if (!order) return army;
    const error = positionError(army, fleets.get(order.fleetId), provinces.get(order.provinceId), validation);
    if (error) return cancel(army, error);
    if (resolveAmphibiousLandingSeaNode(order.provinceId)?.id !== order.seaNodeId) return cancel(army, 'Conexão costeira alterada.');
    if (engagedThisTick.has(order.fleetId)) return cancel(army, 'Fleet entrou em combate naval.');
    return army;
  });
  const cargo = buildTransportIndexes(armies), insufficient = new Set<string>();
  for (const [id, reserved] of cargo.extractionsByFleet) {
    if (fleetTransportUsed(cargo.byFleet.get(id) ?? []) + fleetTransportUsed(reserved) > fleetTransportCapacity(fleets.get(id)!)) insufficient.add(id);
  }
  armies = armies.map(army => {
    const order = army.beachExtraction;
    if (!order) return army;
    if (insufficient.has(order.fleetId)) return cancel(army, 'Transporte insuficiente para tropas e reservas.');
    if (!advance) return army;
    const elapsedDays = order.elapsedDays + 1;
    if (elapsedDays < AMPHIBIOUS_BEACH_EXTRACTION_DAYS) return { ...army, beachExtraction: { ...order, elapsedDays } };
    messages.push({ owner: army.owner, message: `Embarque pela praia concluído: ${army.name}.` });
    return aboardFleet(army, order.fleetId);
  });
  return { armies, messages };
}
