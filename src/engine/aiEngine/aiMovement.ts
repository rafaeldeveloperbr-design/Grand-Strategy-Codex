import { createMilitaryAIContext, type MilitaryAIContext } from './militaryAIContext';
import { canInitiateOffensive, getRequiredAttackRatio, MIN_OFFENSIVE_ORGANIZATION, NORMAL_ATTACK_RATIO } from './militaryRecovery';
import { hasEquivalentMovementOrder } from '../military/movementCommands';
import type { MilitaryAIProfiler } from '../performance/militaryAIProfiler';
import { shouldUseDefensiveWarPosture } from '../diplomacy/warResolution';
import { buildLogisticsNetworks, getProvinceLogistics as rawGetProvinceLogistics, projectRouteLogistics as rawProjectRouteLogistics, LOGISTICS_BALANCE as LB, type LogisticsSnapshot } from '../logistics';
import { getTerrainDefinition } from '../terrain';
import { Army, Province, Country } from '../../types';
import { DiplomaticRelation, War } from '../../types/diplomacy';
import {
  calculateArmyCombatStats,
  calculateArmyMorale,
  calculateArmyOrganization,
  calculateArmySize,
  getArmySupply as rawGetArmySupply,
} from '../military';

import { getBuildingLevel } from '../../data/buildings';
import {
  canMoveToProvince as rawCanMoveToProvince,
  isAtWarWith as rawIsAtWarWith,
} from './aiHelpers';

function createProcessor(context: MilitaryAIContext, profiler?: MilitaryAIProfiler) {
  const measure = <T>(phase: Parameters<MilitaryAIProfiler['measure']>[0], run: () => T): T => profiler ? profiler.measure(phase, run) : run();
  let provinceTargets: Province[] | undefined;
  let cautiousPosture = false;
  let activeLogistics: LogisticsSnapshot | undefined;
  const routes = new Map<string, string[]>();
  const access = new Map<string, boolean>(), hostility = new Map<string, boolean>();
  const canMoveToProvince = (...args: Parameters<typeof rawCanMoveToProvince>) => measure('accessChecks', () => {
    const key = JSON.stringify(args.slice(0, 2));
    if (!access.has(key)) { profiler?.count('relationLookups'); access.set(key, rawCanMoveToProvince(...args)); }
    return access.get(key)!;
  });
  const isAtWarWith = (...args: Parameters<typeof rawIsAtWarWith>) => measure('accessChecks', () => {
    const key = JSON.stringify(args.slice(0, 2));
    if (!hostility.has(key)) { profiler?.count('relationLookups'); hostility.set(key, rawIsAtWarWith(...args)); }
    return hostility.get(key)!;
  });
  const findPath = (start: string, end: string, _provinces: Province[], tag: string, diplomacy: DiplomaticRelation[]): string[] => measure('pathfinding', () => {
    const key = JSON.stringify([start, end, tag]);
    const cached = routes.get(key);
    if (cached) { profiler?.count('pathCacheHits'); return [...cached]; }
    profiler?.count('pathfindCalls');
    const index = context.pathProvinceById;
    if (start === end || !index.has(start) || !index.has(end)) { routes.set(key, []); return []; }
    const queue = [start], visited = new Set([start]), parent = new Map<string, string>();
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor];
      if (current === end) {
        const path: string[] = [];
        for (let node = end; node !== start; node = parent.get(node)!) path.push(node);
        path.reverse(); routes.set(key, path); return [...path];
      }
      for (const neighbor of index.get(current)!.neighbors) {
        const province = index.get(neighbor);
        if (!province || visited.has(neighbor) || !canMoveToProvince(tag, province.owner, diplomacy)) continue;
        visited.add(neighbor); parent.set(neighbor, current); queue.push(neighbor);
      }
    }
    routes.set(key, []); return [];
  });
  const isBorderProvince = (id: string, _provinces: Province[], tag: string) => measure('borderEvaluation', () => context.isBorder(id, tag));

  const getArmySupply = (...args: Parameters<typeof rawGetArmySupply>) => measure('logisticsChecks', () => rawGetArmySupply(...args));
  const getProvinceLogistics = (...args: Parameters<typeof rawGetProvinceLogistics>) => measure('logisticsChecks', () => rawGetProvinceLogistics(...args));
  const projectRouteLogistics = (...args: Parameters<typeof rawProjectRouteLogistics>) => measure('logisticsChecks', () => rawProjectRouteLogistics(...args));

  function createArmyWithRouteImpl(
    army: Army,
    destinationId: string,
    provinces: Province[],
    botCountryId: string,
    diplomacy: DiplomaticRelation[]
  ): Army {
    if (army.inCombat || army.retreatProtectionDays || army.embarkedFleetId || hasEquivalentMovementOrder(army, destinationId)) return army;
    profiler?.count('routeChecks');
    const destProv = context.provinceById.get(destinationId);
    if (destProv && (isAtWarWith(botCountryId, destProv.owner, diplomacy)
      || (context.armiesByProvince.get(destinationId) ?? []).some(other => isAtWarWith(botCountryId, other.owner, diplomacy)))
      && !canAttackProvince(army, destProv, botCountryId, context.armiesByProvince.get(destinationId) ?? [], diplomacy, cautiousPosture, activeLogistics)) return army;
    if (destProv && !canMoveToProvince(botCountryId, destProv.owner, diplomacy)) {
      return army;
    }

    const currentProv = army.location === null ? undefined : context.provinceById.get(army.location);
    if (currentProv && currentProv.neighbors.includes(destinationId)) {
      return {
        ...army,
        destination: destinationId,
        targetDestination: destinationId,
        movementProgress: 0,
        path: [destinationId],
      };
    }

    const path = findPath(army.location!, destinationId, provinces, botCountryId, diplomacy);

    if (path.length === 0) {
      return army;
    }

    return {
      ...army,
      destination: path[0],
      targetDestination: destinationId,
      movementProgress: 0,
      path: path,
    };
  }

  function calculateEffectiveArmyPower(
    army: Army,
    province: Province,
    allArmies: Army[],
    defending = false,
    logistics?: LogisticsSnapshot,
  ): number {
    const stats = calculateArmyCombatStats(army);
    const size = calculateArmySize(army);

    if (size <= 0) return 0;

    const organization = calculateArmyOrganization(army);
    const morale = calculateArmyMorale(army);

    const friendlyArmies = (context.armiesByProvince.get(province.id) ?? []).filter(
      other =>
        other.owner === army.owner &&
        other.location === province.id
    );

    const supply = getArmySupply(
      army,
      province,
      friendlyArmies.length > 0 ? friendlyArmies : [army],
      logistics
    );

    const readiness =
      (organization / 100) * 0.55 +
      (morale / 100) * 0.30 +
      supply.combatMultiplier * 0.15;

    const combatPower =
      stats.attack +
      stats.defense * 0.65 +
      stats.shock * 0.45;

    const troopFactor = Math.max(
      0.25,
      Math.sqrt(size / 1000)
    );

    let defenseMultiplier = 1;

    if (defending && province.owner === army.owner) {
      const fortLevel = getBuildingLevel(province, 'fortress');

      defenseMultiplier +=
        province.defense * 0.04 +
        fortLevel * 0.10;
    }

    if (defending) defenseMultiplier *= getTerrainDefinition(province).defenseModifier;

    return (
      combatPower *
      readiness *
      troopFactor *
      defenseMultiplier
    );
  }

  // Use the existing readiness/terrain/fortification/logistics estimate, summed
  // over every hostile stack at the destination instead of one representative.
  function canAttackProvince(army: Army, target: Province, botCountryId: string, armies: Army[], diplomacy: DiplomaticRelation[], cautious: boolean, logistics?: LogisticsSnapshot): boolean {
    if (!canInitiateOffensive(army) || !army.location) return false;
    const current = context.provinceById.get(army.location);
    if (!current) return false;
    const defenders = (context.armiesByProvince.get(target.id) ?? []).filter(other =>
      !other.embarkedFleetId && !other.retreatProtectionDays && isAtWarWith(botCountryId, other.owner, diplomacy));
    const defense = defenders.reduce((sum, other) => sum + calculateEffectiveArmyPower(other, target, armies, true, logistics), 0);
    const power = calculateEffectiveArmyPower(army, current, armies, false, logistics);
    return power / Math.max(1, defense) >= getRequiredAttackRatio(army, target.id, cautious);
  }



  function chooseDefensiveProvinceImpl(
    army: Army,
    botCountryId: string,
    provinces: Province[],
    armies: Army[],
    diplomacy: DiplomaticRelation[],
    logistics?: LogisticsSnapshot,
  ): Province | null {
    const homeProvinces = context.provincesByOwner.get(botCountryId) ?? [];

    let bestProvince: Province | null = null;
    let bestScore = -Infinity;

    for (const province of homeProvinces) {
      let distance = 0;

      if (province.id !== army.location) {
        if (!army.location) continue;

        const path = findPath(
          army.location,
          province.id,
          provinces,
          botCountryId,
          diplomacy
        );

        // Não existe rota válida.
        if (path.length === 0) continue;

        distance = path.length;
      }

      const fortressLevel = getBuildingLevel(province, 'fortress');

      if (calculateArmyOrganization(army) < MIN_OFFENSIVE_ORGANIZATION) {
        const recoveryRoute = province.id === army.location ? [] : findPath(army.location!, province.id, provinces, botCountryId, diplomacy);
        if ([province.id, ...recoveryRoute].some(id => {
          const step = context.provinceById.get(id);
          return !step || isAtWarWith(botCountryId, step.owner, diplomacy)
            || (context.armiesByProvince.get(id) ?? []).some(other => isAtWarWith(botCountryId, other.owner, diplomacy));
        })) continue;
      }
      const infrastructureLevel = getBuildingLevel(
        province,
        'infrastructure'
      );

      const friendlySupport = (context.armiesByProvince.get(province.id) ?? [])
        .filter(
          other =>
            other.owner === botCountryId &&
            other.location === province.id &&
            other.id !== army.id
        )
        .reduce(
          (sum, other) => sum + calculateArmySize(other),
          0
        );

      let score = 0;

      // Posição militar
      const connection = getProvinceLogistics(logistics,botCountryId,province.id);
      if (connection) {
        if (!connection.connected) continue;
        const projected = getArmySupply({...army,location:province.id},province,armies.filter(a => a.id !== army.id),logistics);
        score += projected.ratio*LB.aiDefenseSupplyWeight + connection.efficiency*LB.aiLogisticsScoreWeight;
        score += LB.aiCorridorDefenseBonus*Math.min(1,connection.dependentProvinces/LB.aiCorridorReferenceProvinces);
      }
      score += fortressLevel * 30;
      score += province.defense * 10;

      // Províncias estruturadas sustentam melhor o exército
      score += infrastructureLevel * 8;
      score += province.development * 3;

      // Tenta reagrupar com forças amigas
      score += Math.min(40, friendlySupport / 250);

      // Evita fugir longe demais
      score -= distance * 12;

      if (score > bestScore) {
        bestScore = score;
        bestProvince = province;
      }
    }

    return bestProvince;
  }

  function findReinforcementArmyImpl(
    army: Army,
    botCountryId: string,
    armies: Army[],
    provinces: Province[],
    diplomacy: DiplomaticRelation[],
    reserved: ReadonlySet<string> = new Set()
  ): Army | null {
    if (!army.location) return null;

    const candidates = (context.armiesByOwner.get(botCountryId) ?? []).filter(other =>
      other.owner === botCountryId &&
      other.id !== army.id &&
      !reserved.has(other.id) &&
      other.location !== null &&
      other.destination === null &&
      !other.inCombat && canInitiateOffensive(other)
    );

    let bestArmy: Army | null = null;
    let bestScore = Infinity;



    for (const candidate of candidates) {
      if (!candidate.location) continue;

      const path = findPath(
        candidate.location,
        army.location,
        provinces,
        botCountryId,
        diplomacy
      );

      if (path.length === 0) continue;
      if (path.length > 3) continue;

      let dangerPenalty = 0;

      for (const provinceId of path) {
        const province = context.provinceById.get(provinceId);

        if (!province) continue;

        if (province.owner !== botCountryId) {
          dangerPenalty += 3;
        }

        const enemyTroops = (context.armiesByProvince.get(province.id) ?? [])
          .filter(
            other =>
              other.owner !== botCountryId &&
              other.location === province.id
          )
          .reduce(
            (sum, other) => sum + calculateArmySize(other),
            0
          );

        if (enemyTroops > 0) {
          dangerPenalty += 5;
        }
      }

      const score =
        path.length +
        dangerPenalty;

      if (score < bestScore) {
        bestScore = score;
        bestArmy = candidate;
      }
    }

    return bestArmy;
  }

  function scoreEnemyArmyTarget(
    aiArmy: Army,
    enemyArmy: Army,
    provinces: Province[],
    armies: Army[],
    botCountryId: string,
    diplomacy: DiplomaticRelation[],
    logistics?: LogisticsSnapshot,
  ): number {
    if (!aiArmy.location || !enemyArmy.location) {
      return -Infinity;
    }

    const enemyProvince = context.provinceById.get(enemyArmy.location);

    if (!enemyProvince) {
      return -Infinity;
    }
    if (aiArmy.recentDefeat?.provinceId === enemyProvince.id && !canAttackProvince(aiArmy, enemyProvince, botCountryId, armies, diplomacy, cautiousPosture, logistics)) return -Infinity;

    const path = findPath(
      aiArmy.location,
      enemyArmy.location,
      provinces,
      botCountryId,
      diplomacy
    );

    if (
      aiArmy.location !== enemyArmy.location &&
      path.length === 0
    ) {
      return -Infinity;
    }

    if (
      !isOffensiveRouteSafe(
        aiArmy,
        path,
        botCountryId,
        provinces,
        armies,
        diplomacy,
        logistics,
      )
    ) {
      return -Infinity;
    }

    const routeDanger = calculateRouteDanger(
      path,
      botCountryId,
      provinces,
      armies,
      diplomacy
    );

    const aiProvince = context.provinceById.get(aiArmy.location);

    if (!aiProvince) {
      return -Infinity;
    }

    const aiPower = calculateEffectiveArmyPower(
      aiArmy,
      aiProvince,
      armies,
      aiProvince.owner === botCountryId,
      logistics,
    );

    const enemyPower = calculateEffectiveArmyPower(
      enemyArmy,
      enemyProvince,
      armies,
      enemyProvince.owner === enemyArmy.owner,
      logistics,
    );

    const powerRatio =
      aiPower / Math.max(1, enemyPower);

    let score = 0;
    if (logistics) {
      const projected = projectedSupply(aiArmy,path,provinces,armies,logistics);
      if (!projected || projected.ratio < LB.aiMinimumOffensiveSupplyRatio) return -Infinity;
      score += projected.ratio*LB.aiLogisticsScoreWeight;
      if (!getProvinceLogistics(logistics,enemyArmy.owner,enemyProvince.id)?.connected) score += LB.aiDisconnectedEnemyBonus;
    }

    // Prefere inimigos que consegue derrotar.
    score += Math.min(60, powerRatio * 30);

    // Penaliza alvos muito fortes.
    if (powerRatio < 0.85) {
      score -= 50;
    }

    // Quanto mais perto, melhor.
    score -= path.length * 10;

    // Rota perigosa reduz muito a atratividade.
    score -= routeDanger;

    // Alvo em território próprio é prioridade defensiva.
    if (enemyProvince.owner === botCountryId) {
      score += 45;
    }

    // Exército inimigo enfraquecido é alvo interessante.
    const enemyTroops = calculateArmySize(enemyArmy);

    if (enemyTroops < 2000) {
      score += 20;
    }

    // Fortificação torna a perseguição menos atraente.
    const fortressLevel =
      getBuildingLevel(enemyProvince, 'fortress');

    score -= fortressLevel * 10;

    return score;
  }

  function findBestEnemyArmyTargetImpl(
    army: Army,
    enemyArmies: Army[],
    provinces: Province[],
    armies: Army[],
    botCountryId: string,
    diplomacy: DiplomaticRelation[],
    logistics?: LogisticsSnapshot,
  ): Army | null {
    let bestTarget: Army | null = null;
    let bestScore = -Infinity;

    for (const enemyArmy of enemyArmies) {
      const score = scoreEnemyArmyTarget(
        army,
        enemyArmy,
        provinces,
        armies,
        botCountryId,
        diplomacy,
        logistics,
      );

      if (score > bestScore) {
        bestScore = score;
        bestTarget = enemyArmy;
      }
    }

    return bestTarget;
  }

  function scoreStrategicProvinceTarget(
    province: Province,
    botCountryId: string
  ): number {
    let score = 0;

    // Desenvolvimento = valor econômico/estratégico.
    score += province.development * 6;

    const fortressLevel =
      getBuildingLevel(province, 'fortress');

    const infrastructureLevel =
      getBuildingLevel(province, 'infrastructure');

    // Infraestrutura é valiosa para conquistar.
    score += infrastructureLevel * 10;

    // Fortificações tornam o alvo importante,
    // mas também mais difícil.
    score += fortressLevel * 4;
    score -= fortressLevel * 10;

    // Defesa natural/provincial dificulta o ataque.
    score -= province.defense * 4;



    const enemyTroops = (context.armiesByProvince.get(province.id) ?? [])
      .filter(
        army =>
          army.location === province.id &&
          army.owner !== botCountryId
      )
      .reduce(
        (sum, army) => sum + calculateArmySize(army),
        0
      );

    // Província vazia é uma ótima oportunidade.
    if (enemyTroops === 0) {
      score += 35;
    } else {
      score -= Math.min(50, enemyTroops / 200);
    }

    const ownerCountry = context.countryByTag.get(province.owner);

    if (ownerCountry) {
      const capitalId = getCountryCapitalId(ownerCountry);

      if (capitalId === province.id) {
        score += 80;
      }
    }

    return score;
  }

  function findBestProvinceTargetImpl(
    currentProvince: Province,
    botCountryId: string,
    provinces: Province[],
    armies: Army[],
    diplomacy: DiplomaticRelation[],
    countries: Country[],
    logistics?: LogisticsSnapshot,
    movingArmy?: Army,
  ): Province | null {
    const candidates = provinceTargets ??= provinces
      .filter((province): province is Province => {
        profiler?.count('provinceScans');
        if (!province) return false;

        return (
          province.owner !== botCountryId &&
          canMoveToProvince(
            botCountryId,
            province.owner,
            diplomacy
          ) &&
          isAtWarWith(
            botCountryId,
            province.owner,
            diplomacy
          )
        );
      });

    let bestProvince: Province | null = null;
    let bestScore = -Infinity;

    for (const province of candidates) {
      if (movingArmy && !canAttackProvince(movingArmy, province, botCountryId, armies, diplomacy, cautiousPosture, logistics)) continue;
      let score = scoreStrategicProvinceTarget(
        province,
        botCountryId
      );

      const path = findPath(
        currentProvince.id,
        province.id,
        provinces,
        botCountryId,
        diplomacy
      );

      if (path.length === 0) continue;
      if (logistics && movingArmy) {
        if (!isOffensiveRouteSafe(movingArmy,path,botCountryId,provinces,armies,diplomacy,logistics)) continue;
        const projected = projectedSupply(movingArmy,path,provinces,armies,logistics);
        if (!projected || projected.ratio < LB.aiMinimumOffensiveSupplyRatio) continue;
        score += projected.ratio*LB.aiLogisticsScoreWeight;
      }

      const routeDanger = calculateRouteDanger(
        path,
        botCountryId,
        provinces,
        armies,
        diplomacy
      );

      score -= routeDanger;

      if (score > bestScore) {
        bestScore = score;
        bestProvince = province;
      }
    }

    return bestProvince;
  }

  function getCountryCapitalId(country: Country): string | null {
    return country.capitalId ?? country.capital ?? null;
  }

  function isOwnCapitalThreatenedImpl(
    botCountryId: string,
    provinces: Province[],
    armies: Army[],
    countries: Country[],
    diplomacy: DiplomaticRelation[]
  ): Province | null {
    const botCountry = context.countryByTag.get(botCountryId);

    if (!botCountry) return null;

    const capitalId = getCountryCapitalId(botCountry);

    if (!capitalId) return null;

    const capitalProvince = context.provinceById.get(capitalId);

    if (!capitalProvince) return null;

    const enemyPresent = (context.armiesByProvince.get(capitalProvince.id) ?? []).some(
      army =>
        isAtWarWith(botCountryId, army.owner, diplomacy) &&
        army.location === capitalProvince.id &&
        calculateArmySize(army) > 0
    );

    if (enemyPresent) {
      return capitalProvince;
    }

    const enemyAdjacent = capitalProvince.neighbors.some(
      neighborId => {
        return (context.armiesByProvince.get(neighborId) ?? []).some(
          army =>
            isAtWarWith(botCountryId, army.owner, diplomacy) &&
            army.location === neighborId &&
            calculateArmySize(army) > 0
        );
      }
    );

    return enemyAdjacent
      ? capitalProvince
      : null;
  }

  function calculateCapitalDefenseRequirement(
    capital: Province,
    botCountryId: string,
    armies: Army[],
    diplomacy: DiplomaticRelation[],
    logistics?: LogisticsSnapshot,
  ): {
    enemyThreat: number;
    friendlyDefense: number;
  } {
    let enemyThreat = 0;
    let friendlyDefense = 0;

    for (const army of armies) {
      if (!army.location) continue;

      const isAtCapital =
        army.location === capital.id;

      const isAdjacent =
        capital.neighbors.includes(army.location);

      if (!isAtCapital && !isAdjacent) {
        continue;
      }

      const armyProvince =
        army.location === capital.id
          ? capital
          : undefined;

      if (army.owner === botCountryId) {
        if (!isAtCapital) continue;

        friendlyDefense += calculateEffectiveArmyPower(
          army,
          capital,
          armies,
          true,
          logistics,
        );

        continue;
      }

      if (!isAtWarWith(botCountryId, army.owner, diplomacy)) continue;

      const enemyProvince =
        armyProvince ??
        // para inimigo adjacente, usamos a própria capital
        // como referência defensiva conservadora
        capital;

      enemyThreat += calculateEffectiveArmyPower(
        army,
        enemyProvince,
        armies,
        false,
        logistics,
      );
    }

    return {
      enemyThreat,
      friendlyDefense,
    };
  }

  function calculateRouteDanger(
    path: string[],
    botCountryId: string,
    provinces: Province[],
    armies: Army[],
    diplomacy: DiplomaticRelation[]
  ): number {
    let danger = 0;

    for (const provinceId of path) {
      const province = context.provinceById.get(provinceId);

      if (!province) {
        danger += 25;
        continue;
      }

      if (
        province.owner !== botCountryId &&
        isAtWarWith(
          botCountryId,
          province.owner,
          diplomacy
        )
      ) {
        danger += 12;
      }

      const hostileArmies = (context.armiesByProvince.get(province.id) ?? []).filter(
        army =>
          army.owner !== botCountryId &&
          army.location === province.id &&
          isAtWarWith(
            botCountryId,
            army.owner,
            diplomacy
          )
      );

      for (const hostileArmy of hostileArmies) {
        danger += Math.min(
          50,
          calculateArmySize(hostileArmy) / 250
        );
      }

      const fortressLevel =
        getBuildingLevel(province, 'fortress');

      if (
        province.owner !== botCountryId &&
        fortressLevel > 0
      ) {
        danger += fortressLevel * 6;
      }
    }

    return danger;
  }


  function isOffensiveRouteSafeImpl(
    army: Army,
    path: string[],
    botCountryId: string,
    provinces: Province[],
    armies: Army[],
    diplomacy: DiplomaticRelation[],
    logistics?: LogisticsSnapshot,
  ): boolean {
    profiler?.count('routeChecks');
    if (!army.location) return false;
    if (logistics && path.some((_,i) => {
      const projected = projectedSupply(army,path.slice(0,i+1),provinces,armies,logistics);
      return !projected || projected.ratio < LB.aiMinimumOffensiveSupplyRatio;
    })) return false;

    const currentProvince = context.provinceById.get(army.location);

    if (!currentProvince) return false;

    const armyPower = calculateEffectiveArmyPower(
      army,
      currentProvince,
      armies,
      currentProvince.owner === botCountryId,
      logistics,
    );

    // Não verifica o último nó:
    // o último é justamente o alvo que queremos atacar.
    const intermediatePath = path.slice(0, -1);

    for (const provinceId of intermediatePath) {
      const province = context.provinceById.get(provinceId);

      if (!province) return false;

      const hostileArmies = (context.armiesByProvince.get(province.id) ?? []).filter(
        other =>
          other.owner !== botCountryId &&
          other.location === province.id &&
          isAtWarWith(
            botCountryId,
            other.owner,
            diplomacy
          )
      );

      if (hostileArmies.length === 0) {
        continue;
      }

      const hostilePower = hostileArmies.reduce(
        (sum, hostileArmy) =>
          sum +
          calculateEffectiveArmyPower(
            hostileArmy,
            province,
            armies,
            province.owner === hostileArmy.owner,
            logistics,
          ),
        0
      );

      // Não atravessa uma força que possa bloquear o caminho.
      if (armyPower < hostilePower * getRequiredAttackRatio(army, province.id, cautiousPosture)) {
        return false;
      }
    }

    return true;
  }

  function processAI(
    botCountryId: string,
    armies: Army[],
    provinces: Province[],
    diplomacy: DiplomaticRelation[],
    wars: War[] = [],
    countries: Country[] = [],
    suppliedLogistics?: LogisticsSnapshot
  ): Army[] {
    if (!botCountryId || !Array.isArray(armies) || !Array.isArray(provinces) || !Array.isArray(diplomacy)) {
      return armies;
    }
    // Only armies consume this snapshot; retain every army owner's network so
    // enemy power and allied reinforcement estimates remain identical.
    const logistics = suppliedLogistics ?? (countries.length ? measure('logisticsChecks', () => {
      const armyOwners = new Set([botCountryId,...context.armiesByOwner.keys()]);
      return buildLogisticsNetworks({countries:countries.filter(country => armyOwners.has(country.tag)),provinces,relations:diplomacy,wars});
    }) : undefined);
    // All tactical access/hostility queries below use this bot as the visitor.
    // Preserve row order/duplicates, but skip unrelated world pairs in those scans.
    // Logistics above still receives the complete relations for other army owners.
    diplomacy = context.relationsByCountry.get(botCountryId) ?? [];
    const defensiveWar = measure('warStateEvaluation', () => shouldUseDefensiveWarPosture(botCountryId,wars,provinces,countries,armies));
    cautiousPosture = defensiveWar;
    activeLogistics = logistics;
    const reinforcementOrders = new Map<string, string>();
    const reservedReinforcements = new Set<string>();

    const enemyCountries = (context.warsByCountry.get(botCountryId) ?? [])
      .map(
        war =>
          war.attacker === botCountryId
            ? war.defender
            : war.attacker
      );

    const isAtWar = measure('warStateEvaluation', () => diplomacy.some(r => r.status === 'war' &&
      (r.countryA === botCountryId || r.countryB === botCountryId)));
    profiler?.count('bots');
    profiler?.count(isAtWar ? 'warBots' : 'peaceBots');
    const ownArmies = context.armiesByOwner.get(botCountryId) ?? [];
    const botArmies = measure('ownArmyCollection', () => ownArmies.filter(
      army =>
        army.owner === botCountryId &&
        army.location !== null &&
        army.destination === null &&
        !army.inCombat && canInitiateOffensive(army)
    ));
    profiler?.count('armiesEvaluated', ownArmies.length);

    const enemyTags = new Set(enemyCountries);
    const enemySlots = [...enemyTags].flatMap(tag => context.armySlotsByOwner.get(tag) ?? []).sort((a, b) => a - b);
    const enemyArmies = enemySlots.map(slot => armies[slot]).filter(army => army.location !== null);

    for (const army of botArmies) {
      if (!army.location || reservedReinforcements.has(army.id)) continue;

      const armyProvince = context.provinceById.get(army.location);

      if (!armyProvince) continue;

      const bestEnemy = findBestEnemyArmyTarget(
        army,
        enemyArmies,
        provinces,
        armies,
        botCountryId,
        diplomacy,
        logistics,
      );

      if (!bestEnemy?.location) continue;

      const enemyProvince = context.provinceById.get(bestEnemy.location);

      if (!enemyProvince) continue;

      const armyPower = calculateEffectiveArmyPower(
        army,
        armyProvince,
        armies,
        armyProvince.owner === botCountryId,
        logistics,
      );

      const enemyPower = calculateEffectiveArmyPower(
        bestEnemy,
        enemyProvince,
        armies,
        enemyProvince.owner === bestEnemy.owner,
        logistics,
      );

      const ratio =
        armyPower / Math.max(1, enemyPower);

      // Só pede reforços em situação equilibrada/incerta.
      if (ratio < 0.85 || ratio >= NORMAL_ATTACK_RATIO) {
        continue;
      }

      const reinforcement = findReinforcementArmy(
        army,
        botCountryId,
        armies,
        provinces,
        diplomacy,
        reservedReinforcements
      );

      if (
        reinforcement &&
        army.location &&
        !reinforcementOrders.has(reinforcement.id)
      ) {
        reservedReinforcements.add(army.id);
        reservedReinforcements.add(reinforcement.id);
        reinforcementOrders.set(
          reinforcement.id,
          army.location
        );
      }
    }

    const threatenedCapital = isOwnCapitalThreatened(
      botCountryId,
      provinces,
      armies,
      countries,
      diplomacy
    );

    const capitalDefense =
      threatenedCapital
        ? calculateCapitalDefenseRequirement(
          threatenedCapital,
          botCountryId,
          armies,
          diplomacy,
          logistics,
        )
        : null;

    let reservedCapitalDefense = 0;

    const decide = (army: Army): Army => {
      // Ignora exércitos de outros países ou que já estejam se movendo.
      if (
        army.owner !== botCountryId ||
        army.destination !== null ||
        army.inCombat || army.retreatProtectionDays || army.embarkedFleetId
      ) {
        return army;
      }

      // Recover in friendly territory; only defensive repositioning when unsafe.
      // This runs before capital response/rendezvous so they cannot send a broken
      // army into an enemy stack under the label of a defensive order.
      if (calculateArmyOrganization(army) < MIN_OFFENSIVE_ORGANIZATION) {
        const local = army.location ? context.provinceById.get(army.location) : undefined;
        if (!local) return army;
        const hostile = (context.armiesByProvince.get(local.id) ?? []).some(other => isAtWarWith(botCountryId, other.owner, diplomacy));
        if (local.owner === botCountryId && !hostile) return army;
        const refuge = chooseDefensiveProvince(army, botCountryId, provinces, armies, diplomacy, logistics);
        return refuge && refuge.id !== army.location ? createArmyWithRoute(army, refuge.id, provinces, botCountryId, diplomacy) : army;
      }

      // =========================================================
      // PRIORIDADE 1 — DEFENDER CAPITAL AMEAÇADA
      // =========================================================

      if (
        threatenedCapital &&
        capitalDefense &&
        army.location !== threatenedCapital.id &&
        !army.inCombat
      ) {
        const desiredDefense =
          capitalDefense.enemyThreat * 1.25;

        const projectedDefense =
          capitalDefense.friendlyDefense +
          reservedCapitalDefense;

        if (projectedDefense < desiredDefense) {
          const armyProvince = army.location === null ? undefined : context.provinceById.get(army.location);

          if (!armyProvince) {
            return army;
          }

          const reinforcementPower =
            calculateEffectiveArmyPower(
              army,
              armyProvince,
              armies,
              false,
              logistics,
            );

          const routed = createArmyWithRoute(army, threatenedCapital.id, provinces, botCountryId, diplomacy);
          if (!routed.destination) return army;
          reservedCapitalDefense += reinforcementPower;

          return routed;
        }
      }

      // =========================================================
      // PRIORIDADE 2 — CUMPRIR ORDEM DE REAGRUPAMENTO
      // =========================================================

      const reinforcementDestination =
        reinforcementOrders.get(army.id);

      if (
        reinforcementDestination &&
        army.location !== reinforcementDestination
      ) {

        return createArmyWithRoute(
          army,
          reinforcementDestination,
          provinces,
          botCountryId,
          diplomacy
        );
      }

      // The requesting force holds its rendezvous instead of leaving as support arrives.
      if (reservedReinforcements.has(army.id)) return army;

      const currentProv = army.location === null ? undefined : context.provinceById.get(army.location);

      if (
        !currentProv ||
        !currentProv.neighbors ||
        currentProv.neighbors.length === 0
      ) {
        return army;
      }

      const connection = getProvinceLogistics(logistics,army.owner,currentProv.id);
      const currentSupply = getArmySupply(army,currentProv,armies,logistics);
      if (connection && (!connection.connected || currentSupply.ratio < LB.aiRetreatSupplyRatio)) {
        const refuge = chooseDefensiveProvince(army,botCountryId,provinces,armies,diplomacy,logistics);
        return refuge && refuge.id !== army.location ? createArmyWithRoute(army,refuge.id,provinces,botCountryId,diplomacy) : army;
      }

      // =========================================================
      // GUERRA
      // =========================================================

      if (isAtWar) {
        const relevantEnemyArmies = enemyArmies.filter(
          enemy => enemy.location !== null
        );

        // =======================================================
        // PRIORIDADE 3/4/5 — AVALIAR EXÉRCITO INIMIGO
        // =======================================================

        if (relevantEnemyArmies.length > 0) {
          const bestEnemy = findBestEnemyArmyTarget(
            army,
            relevantEnemyArmies,
            provinces,
            armies,
            botCountryId,
            diplomacy,
            logistics,
          );

          if (bestEnemy?.location) {
            const enemyProvince = context.provinceById.get(bestEnemy.location);

            if (enemyProvince) {
              const aiArmyPower =
                calculateEffectiveArmyPower(
                  army,
                  currentProv,
                  armies,
                  currentProv.owner === botCountryId,
                  logistics,
                );

              const enemyArmyPower =
                calculateEffectiveArmyPower(
                  bestEnemy,
                  enemyProvince,
                  armies,
                  enemyProvince.owner === bestEnemy.owner,
                  logistics,
                );

              const attackRatio =
                aiArmyPower /
                Math.max(1, enemyArmyPower);

              // ===============================================
              // PRIORIDADE 3 — SOBREVIVER / RECUAR
              // ===============================================

              if (attackRatio < 0.85) {
                const defensiveProvince =
                  chooseDefensiveProvince(
                    army,
                    botCountryId,
                    provinces,
                    armies,
                    diplomacy,
                    logistics,
                  );

                if (
                  defensiveProvince &&
                  army.location !== defensiveProvince.id
                ) {

                  return createArmyWithRoute(
                    army,
                    defensiveProvince.id,
                    provinces,
                    botCountryId,
                    diplomacy
                  );
                }

                return army;
              }

              // ===============================================
              // PRIORIDADE 4 — ESPERAR REFORÇOS
              // ===============================================

              if (attackRatio < getRequiredAttackRatio(army, bestEnemy.location, defensiveWar)) {

                return army;
              }

              // ===============================================
              // PRIORIDADE 5 — ATAQUE FAVORÁVEL
              // ===============================================

              return createArmyWithRoute(
                army,
                bestEnemy.location,
                provinces,
                botCountryId,
                diplomacy
              );
            }
          }
        }

        // =======================================================
        // PRIORIDADE 6 — OBJETIVO TERRITORIAL
        // =======================================================

        const bestProvinceTarget =
          findBestProvinceTarget(
            currentProv,
            botCountryId,
            provinces,
            armies,
            diplomacy,
            countries,
            logistics,
            army,
          );

        if (bestProvinceTarget) {

          return createArmyWithRoute(
            army,
            bestProvinceTarget.id,
            provinces,
            botCountryId,
            diplomacy
          );
        }

        // Está em guerra, mas não existe nenhuma ação útil.
        return army;
      }

      // =========================================================
      // PAZ — MANTER FRONTEIRA
      // =========================================================

      if (
        isBorderProvince(
          army.location!,
          provinces,
          botCountryId
        )
      ) {
        return army;
      }

      // Choose a reachable frontier once, rather than randomly walking back and forth.
      const frontier = measure('idleDecision', () => (context.provincesByOwner.get(botCountryId) ?? []).filter(province => province.owner === botCountryId &&
        isBorderProvince(province.id, provinces, botCountryId))
        .map(province => ({ province, path: findPath(currentProv.id, province.id, provinces, botCountryId, diplomacy) }))
        .filter(candidate => candidate.path.length > 0 && (!logistics || getProvinceLogistics(logistics,botCountryId,candidate.province.id)?.connected))
        .sort((a, b) => (getProvinceLogistics(logistics,botCountryId,b.province.id)?.efficiency ?? 1) - (getProvinceLogistics(logistics,botCountryId,a.province.id)?.efficiency ?? 1) || a.path.length - b.path.length || a.province.id.localeCompare(b.province.id))[0]);
      if (frontier) return createArmyWithRoute(army, frontier.province.id, provinces, botCountryId, diplomacy);

      return army;
    };
    const result = measure('stateMutation', () => armies.slice());
    for (const slot of context.armySlotsByOwner.get(botCountryId) ?? []) {
      result[slot] = measure('movementDecision', () => decide(armies[slot]));
    }
    measure('stateMutation', () => context.publishArmies(botCountryId, armies, result));
    return result;
  }
  function projectedSupplyImpl(army: Army,path: string[],provinces: Province[],armies: Army[],logistics: LogisticsSnapshot) {
    if (!army.location) return;
    const connection = projectRouteLogistics(logistics,army.owner,army.location,path);
    if (!connection?.connected) return;
    const destination = context.provinceById.get((path[path.length-1] ?? army.location));
    if (!destination) return;
    return getArmySupply({...army,location:destination.id},destination,armies.filter(a => a.id !== army.id),logistics,connection);
  }

  function createArmyWithRoute(...args: Parameters<typeof createArmyWithRouteImpl>): ReturnType<typeof createArmyWithRouteImpl> { return measure('movementDecision', () => createArmyWithRouteImpl(...args)); }

  function chooseDefensiveProvince(...args: Parameters<typeof chooseDefensiveProvinceImpl>): ReturnType<typeof chooseDefensiveProvinceImpl> { return measure('defensiveDecision', () => chooseDefensiveProvinceImpl(...args)); }

  function findReinforcementArmy(...args: Parameters<typeof findReinforcementArmyImpl>): ReturnType<typeof findReinforcementArmyImpl> { return measure('defensiveDecision', () => findReinforcementArmyImpl(...args)); }

  function findBestEnemyArmyTarget(...args: Parameters<typeof findBestEnemyArmyTargetImpl>): ReturnType<typeof findBestEnemyArmyTargetImpl> { return measure('enemyEvaluation', () => findBestEnemyArmyTargetImpl(...args)); }

  function findBestProvinceTarget(...args: Parameters<typeof findBestProvinceTargetImpl>): ReturnType<typeof findBestProvinceTargetImpl> { return measure('targetSelection', () => findBestProvinceTargetImpl(...args)); }

  function isOwnCapitalThreatened(...args: Parameters<typeof isOwnCapitalThreatenedImpl>): ReturnType<typeof isOwnCapitalThreatenedImpl> { return measure('defensiveDecision', () => isOwnCapitalThreatenedImpl(...args)); }

  function isOffensiveRouteSafe(...args: Parameters<typeof isOffensiveRouteSafeImpl>): ReturnType<typeof isOffensiveRouteSafeImpl> { return measure('offensiveDecision', () => isOffensiveRouteSafeImpl(...args)); }

  function projectedSupply(...args: Parameters<typeof projectedSupplyImpl>): ReturnType<typeof projectedSupplyImpl> { return measure('logisticsChecks', () => projectedSupplyImpl(...args)); }

  return (...args: Parameters<typeof processAI>) => measure('TOTAL', () => processAI(...args));
}
export function processAI(
  botCountryId: string, armies: Army[], provinces: Province[], diplomacy: DiplomaticRelation[],
  wars: War[] = [], countries: Country[] = [], suppliedLogistics?: LogisticsSnapshot,
  suppliedContext?: MilitaryAIContext, profiler?: MilitaryAIProfiler,
): Army[] {
  if (!botCountryId || !Array.isArray(armies) || !Array.isArray(provinces) || !Array.isArray(diplomacy)) return armies;
  const context = suppliedContext ?? createMilitaryAIContext(countries, provinces, armies, diplomacy, wars);
  return createProcessor(context, profiler)(botCountryId, armies, provinces, diplomacy, wars, countries, suppliedLogistics);
}
export function getCountryCapitalId(country: Country): string | null { return country.capitalId ?? country.capital ?? null; }
