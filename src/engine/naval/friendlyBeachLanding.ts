import type { Army, Province } from '../../types';
import type { Fleet } from '../../types/naval';
import { calculateArmySize } from '../combat/combatCalculations';
import { createBattleHostility } from '../combat/battleParticipants';
import { buildNavalHostility, canUseNavalAccess, orderFleetMove } from './index';
import { coastalLandingError, resolveAmphibiousLandingSeaNode } from './world';
import { AMPHIBIOUS_BEACH_LANDING_DAYS } from './amphibiousRules';
import { buildTransportIndexes, disembarkArmy, fleetTransportCapacity, fleetTransportUsed, type TransportContext } from './transport';

// Same open-beach duration as V1.1, with an explicit friendly operation name.
export const AMPHIBIOUS_FRIENDLY_BEACH_LANDING_DAYS = AMPHIBIOUS_BEACH_LANDING_DAYS;
export const FRIENDLY_BEACH_LANDING_LABEL = `Desembarque pela praia \u2014 ${AMPHIBIOUS_FRIENDLY_BEACH_LANDING_DAYS} dias`;

function validationContext(ctx: Omit<TransportContext, 'actor'>) {
  const landByProvince = new Map<string, Army[]>();
  for (const army of ctx.armies) if (army.location && !army.embarkedFleetId && calculateArmySize(army) > 0) {
    const bucket = landByProvince.get(army.location) ?? [];
    bucket.push(army); landByProvince.set(army.location, bucket);
  }
  const cargo = buildTransportIndexes(ctx.armies), usedByFleet = new Map([...cargo.byFleet].map(([id, armies]) => [id, fleetTransportUsed(armies)]));
  return {
    hostility: buildNavalHostility(ctx.wars), enemies: createBattleHostility(ctx.wars), relations: ctx.relations, landByProvince,
    cargo, usedByFleet, invasions: new Set(ctx.naval.invasions?.map(o => o.fleetId)),
    battles: new Set(ctx.activeBattles?.flatMap(b => b.participantArmyIds))
  };
}
function peacefulTargetError(army: Army, target: Province | undefined, validation: ReturnType<typeof validationContext>): string | undefined {
  if (!target) return 'Prov\u00edncia alvo inexistente.';
  const coastError = coastalLandingError(target.id);
  if (coastError) return coastError;
  if (validation.hostility.get(army.owner)?.has(target.owner) || validation.relations.some(r => r.status === 'war' && (r.countryA === army.owner && r.countryB === target.owner || r.countryB === army.owner && r.countryA === target.owner))) return 'Alvo hostil: planeje invas\u00e3o separadamente.';
  if (!canUseNavalAccess(army.owner, target, validation.relations, validation.hostility)) return 'Sem acesso \u00e0 prov\u00edncia: exige territ\u00f3rio pr\u00f3prio, alian\u00e7a ou military access.';
  if (validation.landByProvince.get(target.id)?.some(other => validation.enemies(army, other))) return 'Army hostil presente: desembarque amig\u00e1vel cancelado; use o fluxo de combate apropriado.';
}
function positionError(army: Army, fleet: Fleet | undefined, target: Province | undefined, validation: ReturnType<typeof validationContext>): string | undefined {
  if (!army.embarkedFleetId || !fleet || fleet.countryTag !== army.owner || army.embarkedFleetId !== fleet.id) return 'Army precisa estar embarcado em Fleet do mesmo controlador.';
  if (army.inCombat || army.retreatProtectionDays || validation.battles.has(army.id)) return 'Army em combate ou retirada.';
  const targetError = peacefulTargetError(army, target, validation);
  if (targetError) return targetError;
  if (fleet.status === 'COMBAT' || fleet.status === 'RETREATING') return 'Fleet em combate ou retirada.';

  if (validation.invasions.has(fleet.id) || validation.cargo.extractionsByFleet.has(fleet.id)) return 'Opera\u00e7\u00e3o de transporte incompat\u00edvel: cancele invas\u00e3o/extra\u00e7\u00e3o primeiro.';
  if ((validation.usedByFleet.get(fleet.id) ?? 0) > fleetTransportCapacity(fleet)) return 'Capacidade de transporte inconsistente: resolva perdas de carga antes do desembarque.';
  if (calculateArmySize(army) <= 0) return 'Army sem tropas.';
}

/** Explicit peaceful operation; never plans a voyage, battle or occupation. Group commands are atomic. */
export function startFriendlyBeachLanding(
  ctx: TransportContext,
  armyIds: string[],
  provinceId: string
): {
  armies: Army[];
  naval: TransportContext['naval'];
  error?: string;
} {
  const ids = [...new Set(armyIds)];
  const byId = new Map(ctx.armies.map(a => [a.id, a]));
  const fleets = new Map(ctx.naval.fleets.map(f => [f.id, f]));

  const target = ctx.provinces.find(p => p.id === provinceId);
  const validation = validationContext(ctx);

  if (!ids.length) {
    return {
      armies: ctx.armies,
      naval: ctx.naval,
      error: 'Selecione Armies embarcados.',
    };
  }

  const selectedArmies: Army[] = [];

  for (const id of ids) {
    const army = byId.get(id);

    if (!army || army.owner !== ctx.actor) {
      return {
        armies: ctx.armies,
        naval: ctx.naval,
        error: 'Selecione Army do controlador.',
      };
    }

    if (army.friendlyBeachLanding) {
      return {
        armies: ctx.armies,
        naval: ctx.naval,
        error: 'Army já possui desembarque amigável; cancele primeiro.',
      };
    }

    const fleet = fleets.get(army.embarkedFleetId ?? '');

    const error = positionError(
      army,
      fleet,
      target,
      validation
    );

    if (error) {
      return {
        armies: ctx.armies,
        naval: ctx.naval,
        error,
      };
    }

    selectedArmies.push(army);
  }

  const node = target
    ? resolveAmphibiousLandingSeaNode(target)
    : undefined;

  if (!node) {
    return {
      armies: ctx.armies,
      naval: ctx.naval,
      error: 'Costa sem SeaNode navegável válido.',
    };
  }

  const fleetIds = new Set(
    selectedArmies.map(army => army.embarkedFleetId)
  );

  if (fleetIds.size !== 1) {
    return {
      armies: ctx.armies,
      naval: ctx.naval,
      error: 'Os Armies selecionados precisam estar na mesma Fleet.',
    };
  }

  const fleetId = selectedArmies[0].embarkedFleetId!;

  const fleet = fleets.get(fleetId);

  if (!fleet) {
    return {
      armies: ctx.armies,
      naval: ctx.naval,
      error: 'Fleet de transporte inexistente.',
    };
  }

  const alreadyAtTarget =
    fleet.status === 'HOLDING' &&
    fleet.locationSeaNodeId === node.id &&
    !fleet.portProvinceId &&
    fleet.movementProgress === 0 &&
    fleet.route.length === 0;

  let nextNaval = ctx.naval;

  if (!alreadyAtTarget) {
    const movedFleet = orderFleetMove(
      fleet,
      node.id,
      ctx.actor
    );

    if (!movedFleet) {
      return {
        armies: ctx.armies,
        naval: ctx.naval,
        error: 'Sem rota naval válida até a costa selecionada.',
      };
    }

    nextNaval = {
      ...ctx.naval,
      fleets: ctx.naval.fleets.map(f =>
        f.id === fleet.id ? movedFleet : f
      ),
    };
  }

  const selected = new Set(ids);

  const armies = ctx.armies.map(a =>
    selected.has(a.id)
      ? {
        ...a,
        friendlyBeachLanding: {
          provinceId,
          seaNodeId: node.id,
          elapsedDays: 0,
        },
      }
      : a
  );

  return {
    armies,
    naval: nextNaval,
  };
}

/** Prefer the existing instant docked-port command, otherwise explicitly start friendly landing. */
export function disembarkArmiesAtProvince(
  ctx: TransportContext,
  armyIds: string[],
  provinceId: string
): {
  armies: Army[];
  naval: TransportContext['naval'];
  error?: string;
} {
  const ids = [...new Set(armyIds)];
  const cargo = buildTransportIndexes(ctx.armies);

  const fleets = new Map(
    ctx.naval.fleets.map(f => [f.id, f])
  );

  if (
    ids.length &&
    ids.every(id => {
      const f = fleets.get(
        cargo.byId.get(id)?.embarkedFleetId ?? ''
      );

      return (
        f?.status === 'DOCKED' &&
        f.portProvinceId === provinceId
      );
    })
  ) {
    const target = ctx.provinces.find(
      p => p.id === provinceId
    );

    const validation = validationContext(ctx);

    for (const id of ids) {
      const army = cargo.byId.get(id)!;

      const error = peacefulTargetError(
        army,
        target,
        validation
      );

      if (error) {
        return {
          armies: ctx.armies,
          naval: ctx.naval,
          error,
        };
      }
    }

    let armies = ctx.armies;

    for (const id of ids) {
      const result = disembarkArmy(
        { ...ctx, armies },
        id
      );

      if (result.error) {
        return {
          armies: ctx.armies,
          naval: ctx.naval,
          error: result.error,
        };
      }

      armies = result.armies;
    }

    return {
      armies,
      naval: ctx.naval,
    };
  }

  return startFriendlyBeachLanding(
    ctx,
    ids,
    provinceId
  );
}
export const getFriendlyDisembarkError = (ctx: TransportContext, armyIds: string[], provinceId: string) => disembarkArmiesAtProvince(ctx, armyIds, provinceId).error;
export function cancelFriendlyBeachLanding(armies: Army[], armyIds: readonly string[], actor: string): Army[] {
  const selected = new Set(armyIds);
  return armies.map(a => selected.has(a.id) && a.owner === actor && a.friendlyBeachLanding ? { ...a, friendlyBeachLanding: undefined } : a);
}
export const ashoreArmy = (army: Army, provinceId: string): Army => ({
  ...army, friendlyBeachLanding: undefined, beachExtraction: undefined, embarkedFleetId: undefined,
  location: provinceId, destination: null, targetDestination: null, path: [], movementPlan: undefined, movementProgress: 0, position: null, targetArmyId: null, targetProvinceId: null
});

/** Run after existing cargo losses AND terrestrial arrivals, independently of FULL/PASSIVE activation. */
export function friendlyBeachLandingTick(ctx: Omit<TransportContext, 'actor'>, engagedThisTick: ReadonlySet<string> = new Set(), advance = true) {
  const messages: Array<{ owner: string; message: string }> = [];
  if (!ctx.armies.some(a => a.friendlyBeachLanding)) return { armies: ctx.armies, messages };
  const fleets = new Map(ctx.naval.fleets.map(f => [f.id, f])), provinces = new Map(ctx.provinces.map(p => [p.id, p])), validation = validationContext(ctx);
  const armies = ctx.armies.map(army => {
    const order = army.friendlyBeachLanding;

    if (!order) return army;

    const fleet = fleets.get(
      army.embarkedFleetId ?? ''
    );

    const target = provinces.get(
      order.provinceId
    );

    const error =
      positionError(
        army,
        fleet,
        target,
        validation
      ) ??
      (
        resolveAmphibiousLandingSeaNode(
          order.provinceId
        )?.id !== order.seaNodeId
          ? 'Conexão costeira alterada.'
          : undefined
      ) ??
      (
        engagedThisTick.has(
          army.embarkedFleetId ?? ''
        )
          ? 'Fleet entrou em combate naval.'
          : undefined
      );

    if (error) {
      messages.push({
        owner: army.owner,
        message: `Desembarque amigável cancelado: ${error}`,
      });

      return {
        ...army,
        friendlyBeachLanding: undefined,
      };
    }

    if (!fleet) {
      messages.push({
        owner: army.owner,
        message:
          'Desembarque amigável cancelado: Fleet inexistente.',
      });

      return {
        ...army,
        friendlyBeachLanding: undefined,
      };
    }

    const travelingToLanding =
      fleet.status === 'MOVING' &&
      fleet.destinationSeaNodeId === order.seaNodeId;

    if (travelingToLanding) {
      return army;
    }

    const readyToLand =
      fleet.status === 'HOLDING' &&
      fleet.locationSeaNodeId === order.seaNodeId &&
      !fleet.portProvinceId &&
      fleet.movementProgress === 0 &&
      fleet.route.length === 0;

    if (!readyToLand) {
      messages.push({
        owner: army.owner,
        message:
          'Desembarque amigável cancelado: Fleet desviou ou não alcançou a costa planejada.',
      });

      return {
        ...army,
        friendlyBeachLanding: undefined,
      };
    }

    if (!advance) return army;

    const elapsedDays =
      order.elapsedDays + 1;

    if (
      elapsedDays <
      AMPHIBIOUS_FRIENDLY_BEACH_LANDING_DAYS
    ) {
      return {
        ...army,
        friendlyBeachLanding: {
          ...order,
          elapsedDays,
        },
      };
    }

    messages.push({
      owner: army.owner,
      message: `Desembarque amigável concluído: ${army.name}.`,
    });

    return ashoreArmy(
      army,
      order.provinceId
    );
  });
  return { armies, messages };
}
