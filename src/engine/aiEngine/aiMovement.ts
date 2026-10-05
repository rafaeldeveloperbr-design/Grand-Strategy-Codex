import { Army, Province, Country } from '../../types';
import { DiplomaticRelation, War } from '../../types/diplomacy';
import { findPath } from '../military';
import {
  calculateArmyCombatStats,
  calculateArmyMorale,
  calculateArmyOrganization,
  calculateArmySize,
  getArmySupply,
} from '../military';

import { getBuildingLevel } from '../../data/buildings';
import {
  canMoveToProvince,
  isBorderProvince,
  isAtWarWithNeighbor,
  isAtWarWith,
  findNearestEnemyArmy,
} from './aiHelpers';

function createArmyWithRoute(
  army: Army,
  destinationId: string,
  provinces: Province[],
  botCountryId: string,
  diplomacy: DiplomaticRelation[]
): Army {
  const destProv = provinces.find(p => p.id === destinationId);
  if (destProv && !canMoveToProvince(botCountryId, destProv.owner, diplomacy)) {
    return army;
  }

  const currentProv = provinces.find(p => p.id === army.location);
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
): number {
  const stats = calculateArmyCombatStats(army);
  const size = calculateArmySize(army);

  if (size <= 0) return 0;

  const organization = calculateArmyOrganization(army);
  const morale = calculateArmyMorale(army);

  const friendlyArmies = allArmies.filter(
    other =>
      other.owner === army.owner &&
      other.location === province.id
  );

  const supply = getArmySupply(
    army,
    province,
    friendlyArmies.length > 0 ? friendlyArmies : [army]
  );

  const readiness =
    (organization / 100) * 0.55 +
    (morale / 100) * 0.30 +
    supply.combatMultiplier * 0.15;

  const combatPower =
    stats.attack +
    stats.defense * 0.65 +
    stats.shock * 0.45;

  let defenseMultiplier = 1;

  if (defending && province.owner === army.owner) {
    const fortLevel = getBuildingLevel(province, 'fortress');

    defenseMultiplier +=
      province.defense * 0.04 +
      fortLevel * 0.10;
  }

  return combatPower * readiness * defenseMultiplier;
}



function chooseDefensiveProvince(
  army: Army,
  botCountryId: string,
  provinces: Province[],
  armies: Army[],
  diplomacy: DiplomaticRelation[]
): Province | null {
  const homeProvinces = provinces.filter(
    province => province.owner === botCountryId
  );

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
    const infrastructureLevel = getBuildingLevel(
      province,
      'infrastructure'
    );

    const friendlySupport = armies
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

function findReinforcementArmy(
  army: Army,
  botCountryId: string,
  armies: Army[],
  provinces: Province[],
  diplomacy: DiplomaticRelation[]
): Army | null {
  if (!army.location) return null;

  const candidates = armies.filter(other =>
    other.owner === botCountryId &&
    other.id !== army.id &&
    other.location !== null &&
    other.destination === null &&
    !other.inCombat
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
      const province = provinces.find(
        p => p.id === provinceId
      );

      if (!province) continue;

      if (province.owner !== botCountryId) {
        dangerPenalty += 3;
      }

      const enemyTroops = armies
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
  diplomacy: DiplomaticRelation[]
): number {
  if (!aiArmy.location || !enemyArmy.location) {
    return -Infinity;
  }

  const enemyProvince = provinces.find(
    p => p.id === enemyArmy.location
  );

  if (!enemyProvince) {
    return -Infinity;
  }

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

  const routeDanger = calculateRouteDanger(
    path,
    botCountryId,
    provinces,
    armies,
    diplomacy
  );

  const aiProvince = provinces.find(
    p => p.id === aiArmy.location
  );

  if (!aiProvince) {
    return -Infinity;
  }

  const aiPower = calculateEffectiveArmyPower(
    aiArmy,
    aiProvince,
    armies,
    aiProvince.owner === botCountryId
  );

  const enemyPower = calculateEffectiveArmyPower(
    enemyArmy,
    enemyProvince,
    armies,
    enemyProvince.owner === enemyArmy.owner
  );

  const powerRatio =
    aiPower / Math.max(1, enemyPower);

  let score = 0;

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

function findBestEnemyArmyTarget(
  army: Army,
  enemyArmies: Army[],
  provinces: Province[],
  armies: Army[],
  botCountryId: string,
  diplomacy: DiplomaticRelation[]
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
      diplomacy
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
  botCountryId: string,
  armies: Army[],
  countries: Country[]
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



  const enemyTroops = armies
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

  const ownerCountry = countries.find(
    country => country.tag === province.owner
  );

  if (ownerCountry) {
    const capitalId = getCountryCapitalId(ownerCountry);

    if (capitalId === province.id) {
      score += 80;
    }
  }

  return score;
}

function findBestProvinceTarget(
  currentProvince: Province,
  botCountryId: string,
  provinces: Province[],
  armies: Army[],
  diplomacy: DiplomaticRelation[],
  countries: Country[]
): Province | null {
  const candidates = currentProvince.neighbors
    .map(id => provinces.find(p => p.id === id))
    .filter((province): province is Province => {
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
    let score = scoreStrategicProvinceTarget(
      province,
      botCountryId,
      armies,
      countries
    );

    const path = findPath(
      currentProvince.id,
      province.id,
      provinces,
      botCountryId,
      diplomacy
    );

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

type CountryWithCapital = Country & {
  capital?: string;
  capitalId?: string;
};

function getCountryCapitalId(
  country: Country
): string | null {
  const countryWithCapital =
    country as CountryWithCapital;

  return (
    countryWithCapital.capital ??
    countryWithCapital.capitalId ??
    country.provinces[0] ??
    null
  );
}

function isOwnCapitalThreatened(
  botCountryId: string,
  provinces: Province[],
  armies: Army[],
  countries: Country[]
): Province | null {
  const botCountry = countries.find(
    country => country.tag === botCountryId
  );

  if (!botCountry) return null;

  const capitalId = getCountryCapitalId(botCountry);

  if (!capitalId) return null;

  const capitalProvince = provinces.find(
    province => province.id === capitalId
  );

  if (!capitalProvince) return null;

  const enemyPresent = armies.some(
    army =>
      army.owner !== botCountryId &&
      army.location === capitalProvince.id &&
      calculateArmySize(army) > 0
  );

  if (enemyPresent) {
    return capitalProvince;
  }

  const enemyAdjacent = capitalProvince.neighbors.some(
    neighborId => {
      return armies.some(
        army =>
          army.owner !== botCountryId &&
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
  armies: Army[]
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
        true
      );

      continue;
    }

    const enemyProvince =
      armyProvince ??
      // para inimigo adjacente, usamos a própria capital
      // como referência defensiva conservadora
      capital;

    enemyThreat += calculateEffectiveArmyPower(
      army,
      enemyProvince,
      armies,
      false
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
    const province = provinces.find(
      p => p.id === provinceId
    );

    if (!province) {
      danger += 25;
      continue;
    }

    // Território inimigo em guerra
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

    const hostileArmies = armies.filter(
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

export function processAI(
  botCountryId: string,
  armies: Army[],
  provinces: Province[],
  diplomacy: DiplomaticRelation[],
  wars: War[] = [],
  countries: Country[] = []
): Army[] {
  if (!botCountryId || !Array.isArray(armies) || !Array.isArray(provinces) || !Array.isArray(diplomacy)) {
    return armies;
  }
  const reinforcementOrders = new Map<string, string>();

  const enemyCountries = wars
    .filter(
      war =>
        war.attacker === botCountryId ||
        war.defender === botCountryId
    )
    .map(
      war =>
        war.attacker === botCountryId
          ? war.defender
          : war.attacker
    );

  const botArmies = armies.filter(
    army =>
      army.owner === botCountryId &&
      army.location !== null &&
      army.destination === null &&
      !army.inCombat
  );

  const enemyArmies = armies.filter(
    army =>
      enemyCountries.includes(army.owner) &&
      army.location !== null
  );

  for (const army of botArmies) {
    if (!army.location) continue;

    const armyProvince = provinces.find(
      province => province.id === army.location
    );

    if (!armyProvince) continue;

    const bestEnemy = findBestEnemyArmyTarget(
      army,
      enemyArmies,
      provinces,
      armies,
      botCountryId,
      diplomacy
    );

    if (!bestEnemy?.location) continue;

    const enemyProvince = provinces.find(
      province => province.id === bestEnemy.location
    );

    if (!enemyProvince) continue;

    const armyPower = calculateEffectiveArmyPower(
      army,
      armyProvince,
      armies,
      armyProvince.owner === botCountryId
    );

    const enemyPower = calculateEffectiveArmyPower(
      bestEnemy,
      enemyProvince,
      armies,
      enemyProvince.owner === bestEnemy.owner
    );

    const ratio =
      armyPower / Math.max(1, enemyPower);

    // Só pede reforços em situação equilibrada/incerta.
    if (ratio < 0.85 || ratio >= 1.20) {
      continue;
    }

    const reinforcement = findReinforcementArmy(
      army,
      botCountryId,
      armies,
      provinces,
      diplomacy
    );

    if (
      reinforcement &&
      army.location &&
      !reinforcementOrders.has(reinforcement.id)
    ) {
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
    countries
  );

  const capitalDefense =
    threatenedCapital
      ? calculateCapitalDefenseRequirement(
        threatenedCapital,
        botCountryId,
        armies
      )
      : null;

  let reservedCapitalDefense = 0;

  return armies.map(army => {
    if (army.owner !== botCountryId || army.destination !== null) {
      return army;
    }

    if (
      threatenedCapital &&
      capitalDefense &&
      army.location !== threatenedCapital.id &&
      !army.inCombat
    ) {
      const desiredDefense =
        capitalDefense.enemyThreat * 1.25;

      const currentProjectedDefense =
        capitalDefense.friendlyDefense +
        reservedCapitalDefense;

      if (currentProjectedDefense < desiredDefense) {
        const armyProvince = provinces.find(
          province => province.id === army.location
        );

        if (!armyProvince) {
          return army;
        }

        const reinforcementPower =
          calculateEffectiveArmyPower(
            army,
            armyProvince,
            armies,
            false
          );

        reservedCapitalDefense += reinforcementPower;

        console.log(
          `🏰 [IA CAPITAL] ${botCountryId} enviando ${army.name} para defender ${threatenedCapital.name}`
        );

        return createArmyWithRoute(
          army,
          threatenedCapital.id,
          provinces,
          botCountryId,
          diplomacy
        );
      }
    }

    const reinforcementDestination =
      reinforcementOrders.get(army.id);

    if (
      reinforcementDestination &&
      army.location !== reinforcementDestination
    ) {
      console.log(
        `🤝 [IA REFORÇO] ${botCountryId} enviando ${army.name} para apoiar outro exército`
      );

      return createArmyWithRoute(
        army,
        reinforcementDestination,
        provinces,
        botCountryId,
        diplomacy
      );
    }

    const currentProv = provinces.find(p => p.id === army.location);
    if (!currentProv || !currentProv.neighbors || currentProv.neighbors.length === 0) {
      return army;
    }

    const isAtWar = isAtWarWithNeighbor(botCountryId, currentProv, provinces, diplomacy);

    if (isAtWar) {
      const enemyCountries = wars
        .filter(w => w.attacker === botCountryId || w.defender === botCountryId)
        .map(w => w.attacker === botCountryId ? w.defender : w.attacker);

      const enemyArmies = armies.filter(a =>
        enemyCountries.includes(a.owner) && a.location !== null
      );

      const aiArmyPower = calculateEffectiveArmyPower(
        army,
        currentProv,
        armies,
        currentProv.owner === botCountryId
      );

      if (enemyArmies.length > 0) {
        const nearestEnemy = findNearestEnemyArmy(army, enemyArmies, provinces);

        if (nearestEnemy && nearestEnemy.location) {
          const enemyProvince = provinces.find(
            p => p.id === nearestEnemy.location
          );

          if (!enemyProvince) {
            return army;
          }

          const enemyArmyPower = calculateEffectiveArmyPower(
            nearestEnemy,
            enemyProvince,
            armies,
            enemyProvince.owner === nearestEnemy.owner
          );

          const attackRatio =
            aiArmyPower / Math.max(1, enemyArmyPower);

          if (attackRatio >= 1.20) {
            console.log(
              `🎯 [IA OFENSIVA] ${botCountryId} atacando com vantagem ${attackRatio.toFixed(2)}:1`
            );

            return createArmyWithRoute(
              army,
              nearestEnemy.location,
              provinces,
              botCountryId,
              diplomacy
            );
          }

          if (attackRatio < 0.85) {
            const defensiveProvince = chooseDefensiveProvince(
              army,
              botCountryId,
              provinces,
              armies,
              diplomacy
            );

            if (
              defensiveProvince &&
              army.location !== defensiveProvince.id
            ) {
              console.log(
                `🛡️ [IA DEFENSIVA] ${botCountryId} evitando combate desfavorável ${attackRatio.toFixed(2)}:1 e recuando para ${defensiveProvince.name}`
              );

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

          const reinforcementArmy = findReinforcementArmy(
            army,
            botCountryId,
            armies,
            provinces,
            diplomacy
          );

          if (
            reinforcementArmy &&
            reinforcementArmy.location &&
            army.location
          ) {
            console.log(
              `🤝 [IA REAGRUPANDO] ${botCountryId} aguardando reforço de ${reinforcementArmy.name}`
            );

            return army;
          }

          console.log(
            `⏸️ [IA CAUTELOSA] ${botCountryId} segurando posição contra ${nearestEnemy.owner} (${attackRatio.toFixed(2)}:1)`
          );

          return army;
        }
      }

      const validNeighbors = currentProv.neighbors.filter(neighborId => {
        const prov = provinces.find(p => p.id === neighborId);
        if (!prov) return false;
        return canMoveToProvince(botCountryId, prov.owner, diplomacy);
      });

      if (validNeighbors.length === 0) {
        return army;
      }

      const bestProvinceTarget =
        findBestProvinceTarget(
          currentProv,
          botCountryId,
          provinces,
          armies,
          diplomacy,
          countries
        );

      if (bestProvinceTarget) {
        console.log(
          `🏴 [IA OBJETIVO] ${botCountryId} avançando sobre ${bestProvinceTarget.name}`
        );

        return createArmyWithRoute(
          army,
          bestProvinceTarget.id,
          provinces,
          botCountryId,
          diplomacy
        );
      }

      if (isBorderProvince(army.location!, provinces, botCountryId)) {
        return army;
      }

      const borderNeighbors = currentProv.neighbors.filter(neighborId => {
        const prov = provinces.find(p => p.id === neighborId);
        if (!prov) return false;
        return prov.owner === botCountryId && isBorderProvince(neighborId, provinces, botCountryId);
      });

      if (borderNeighbors.length > 0) {
        const chosenDestination = borderNeighbors[Math.floor(Math.random() * borderNeighbors.length)];
        return createArmyWithRoute(army, chosenDestination, provinces, botCountryId, diplomacy);
      }

      const ownNeighbors = currentProv.neighbors.filter(neighborId => {
        const prov = provinces.find(p => p.id === neighborId);
        return prov && prov.owner === botCountryId;
      });

      if (ownNeighbors.length > 0) {
        const chosenDestination = ownNeighbors[Math.floor(Math.random() * ownNeighbors.length)];
        return createArmyWithRoute(army, chosenDestination, provinces, botCountryId, diplomacy);
      }

      return army;
    } return army;
  });
}