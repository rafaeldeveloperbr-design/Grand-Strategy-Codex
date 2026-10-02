import { Army, Province, GameDate } from '../../types';
import { DiplomaticRelation, War } from '../../types/diplomacy';
import { declareWar } from '../diplomacy';
import {
  isRebelArmy,
  findSeparatistPath,
  findWayHomePath,
  moveSeparatistArmy
} from './rebelHelpers';
import { mergeRebelArmies, integrateLiberatedRebels } from './rebelAccumulation';

/**
 * IA SEPARATISTA - MARCHA RESTRITA
 */
export function processSeparatistAI(
  armies: Army[],
  provinces: Province[]
): Army[] {
  let updatedArmies = mergeRebelArmies([...armies]);
  updatedArmies = integrateLiberatedRebels(updatedArmies, provinces);

  const separatistArmies = updatedArmies.filter(
    a => isRebelArmy(a) && a.separatistMode === true
  );

  if (separatistArmies.length > 0) {
    console.log(`🎯 processSeparatistAI: processando ${separatistArmies.length} exército(s) separatista(s)`);
  }

  for (const army of separatistArmies) {
    if (!army.location || army.destination || army.inCombat) continue;

    const currentProvince = provinces.find(p => p.id === army.location);
    if (!currentProvince) continue;

    const originalOwner = army.originalOwner || currentProvince.owner;

    // ESTRATÉGIA 1: Atacar vizinho = território histórico ocupado
    const historicNeighborTargets = (currentProvince.neighbors || []).filter(neighborId => {
      const neighborProv = provinces.find(p => p.id === neighborId);
      if (!neighborProv) return false;
      return (
        neighborProv.originalOwner === originalOwner &&
        neighborProv.owner !== originalOwner
      );
    });

    if (historicNeighborTargets.length > 0) {
      const targetId = historicNeighborTargets[0];
      const targetProv = provinces.find(p => p.id === targetId);
      console.log(`🎯 ESTRATÉGIA 1: ${army.name} encontrou alvo ${targetProv?.name} (owner: ${targetProv?.owner}, original: ${targetProv?.originalOwner})`);
      const movedArmy = moveSeparatistArmy(army, targetId, provinces);
      console.log(`🎯 ESTRATÉGIA 1: moveSeparatistArmy retornou:`, movedArmy ? '✅ sucesso' : '❌ null');
      if (movedArmy) {
        const idx = updatedArmies.findIndex(a => a.id === army.id);
        if (idx !== -1) {
          updatedArmies[idx] = movedArmy;
          console.log(`⚔️ ${army.name} ATACA ${targetProv?.name} (território histórico)!`);
        }
        continue;
      }
    }

    // ESTRATÉGIA 2: Trânsito por território próprio/libertado
    const transitNeighbors = (currentProvince.neighbors || []).filter(neighborId => {
      const neighborProv = provinces.find(p => p.id === neighborId);
      if (!neighborProv) return false;
      return (
        neighborProv.originalOwner === originalOwner &&
        neighborProv.owner === originalOwner
      );
    });

    let moved = false;
    for (const transitId of transitNeighbors) {
      const transitProv = provinces.find(p => p.id === transitId)!;
      const furtherTargets = (transitProv.neighbors || []).filter(nid => {
        const p = provinces.find(x => x.id === nid);
        return (
          p &&
          p.originalOwner === originalOwner &&
          p.owner !== originalOwner
        );
      });

      if (furtherTargets.length > 0) {
        const movedArmy = moveSeparatistArmy(army, transitId, provinces, true);
        if (movedArmy) {
          const idx = updatedArmies.findIndex(a => a.id === army.id);
          if (idx !== -1) {
            updatedArmies[idx] = movedArmy;
            console.log(`🚶 ${army.name} transitando por ${transitProv.name}`);
          }
          moved = true;
          break;
        }
      }
    }
    if (moved) continue;

    // ESTRATÉGIA 3: Pathfinding até alvo histórico remoto
    const remoteHistoricTargets = provinces.filter(p =>
      p.originalOwner === originalOwner &&
      p.owner !== originalOwner
    );

    if (remoteHistoricTargets.length > 0) {
      let bestTarget: Province | null = null;
      let bestPath: string[] = [];

      for (const target of remoteHistoricTargets) {
        const path = findSeparatistPath(army.location, target.id, provinces, originalOwner);
        if (path.length > 0 && (bestPath.length === 0 || path.length < bestPath.length)) {
          bestTarget = target;
          bestPath = path;
        }
      }

      if (bestTarget && bestPath.length > 0) {
        const nextStepId = bestPath[0];
        const isHomeStep = provinces.find(p => p.id === nextStepId)?.owner === originalOwner;
        const movedArmy = moveSeparatistArmy(army, nextStepId, provinces, isHomeStep);
        if (movedArmy) {
          const idx = updatedArmies.findIndex(a => a.id === army.id);
          if (idx !== -1) {
            updatedArmies[idx] = {
              ...movedArmy,
              path: bestPath,
              targetDestination: bestTarget.id,
            };
            console.log(`🚶 ${army.name} marchando para ${bestTarget.name} (rota histórica: ${bestPath.length})`);
          }
          continue;
        }
      }
    }

    // ESTRATÉGIA 4: Rebelde perdido em terra estrangeira -> voltar para casa
    if (currentProvince.originalOwner !== originalOwner) {
      const homeNeighbors = (currentProvince.neighbors || []).filter(neighborId => {
        const neighborProv = provinces.find(p => p.id === neighborId);
        return neighborProv?.originalOwner === originalOwner;
      });

      if (homeNeighbors.length > 0) {
        const movedArmy = moveSeparatistArmy(army, homeNeighbors[0], provinces, true);
        if (movedArmy) {
          const idx = updatedArmies.findIndex(a => a.id === army.id);
          if (idx !== -1) {
            updatedArmies[idx] = movedArmy;
            console.log(`🏠 ${army.name} voltando para casa`);
          }
          continue;
        }
      }

      const homeProvinces = provinces.filter(p => p.originalOwner === originalOwner);
      let bestHome: Province | null = null;
      let bestHomePath: string[] = [];
      for (const home of homeProvinces) {
        const path = findWayHomePath(army.location, home.id, provinces);
        if (path.length > 0 && (bestHomePath.length === 0 || path.length < bestHomePath.length)) {
          bestHome = home;
          bestHomePath = path;
        }
      }
      if (bestHome && bestHomePath.length > 0) {
        const nextStepId = bestHomePath[0];
        const nextProv = provinces.find(p => p.id === nextStepId);
        const allowHome = nextProv?.owner === originalOwner;
        const movedArmy = moveSeparatistArmy(army, nextStepId, provinces, allowHome);
        if (movedArmy) {
          const idx = updatedArmies.findIndex(a => a.id === army.id);
          if (idx !== -1) {
            updatedArmies[idx] = movedArmy;
            console.log(`🏠 ${army.name} retornando para ${bestHome.name}`);
          }
          continue;
        }
      }
    }

    console.log(`🛡️ ${army.name}: aguardando em ${currentProvince.name} (nenhum território histórico ocupado)`);
  }

  return updatedArmies;
}

export function checkRebelTerritoryReturn(winnerArmy: Army): string | null {
  if (isRebelArmy(winnerArmy) && winnerArmy.originalOwner) {
    return winnerArmy.originalOwner;
  }
  return null;
}

export function ensureSeparatistWars(
  armies: Army[],
  provinces: Province[],
  wars: War[],
  relations: DiplomaticRelation[],
  currentDate: GameDate
): { wars: War[]; relations: DiplomaticRelation[]; newConflicts: string[] } {
  let currentWars = [...wars];
  let currentRelations = [...relations];
  const newConflicts: string[] = [];

  const separatists = armies.filter(
    a => isRebelArmy(a) && a.separatistMode === true && a.originalOwner
  );

  for (const rebel of separatists) {
    const occupiers = Array.from(new Set(
      provinces
        .filter(p => p.originalOwner === rebel.originalOwner && p.owner !== rebel.originalOwner)
        .map(p => p.owner)
    ));

    for (const occupier of occupiers) {
      const exists = currentWars.some(w =>
        (w.attacker === rebel.owner && w.defender === occupier) ||
        (w.defender === rebel.owner && w.attacker === occupier)
      );
      if (exists) continue;

      const result = declareWar(currentRelations, currentWars, rebel.owner, occupier, currentDate);
      currentWars = result.wars;
      currentRelations = result.relations;

      newConflicts.push(`${rebel.name} ⚔️ ${occupier}`);
    }
  }

  return { wars: currentWars, relations: currentRelations, newConflicts };
}

export function cleanupSeparatistWars(
  armies: Army[],
  provinces: Province[],
  wars: War[],
  relations: DiplomaticRelation[]
): {
  wars: War[];
  relations: DiplomaticRelation[];
  provinces: Province[];
  endedWars: string[];
  pacifiedProvinces: string[];
} {
  let currentWars = [...wars];
  let currentRelations = [...relations];
  let currentProvinces = [...provinces];
  const endedWars: string[] = [];
  const pacifiedProvinces: string[] = [];

  const rebelWars = currentWars.filter(
    w => w.attacker.startsWith('rebel_') || w.defender.startsWith('rebel_')
  );

  for (const war of rebelWars) {
    const rebelTag = war.attacker.startsWith('rebel_') ? war.attacker : war.defender;
    const enemyTag = war.attacker === rebelTag ? war.defender : war.attacker;

    const provId = rebelTag.replace('rebel_', '');
    const rebelHome = provinces.find(p => p.id === provId)?.originalOwner;

    const stillActive = armies.some(a => a.owner === rebelTag && a.separatistMode === true);
    const stillOccupied = rebelHome
      ? currentProvinces.some(p => p.originalOwner === rebelHome && p.owner !== rebelHome)
      : false;

    if (stillActive && stillOccupied) continue;

    currentWars = currentWars.filter(w => w.id !== war.id);
    currentRelations = currentRelations.map(r =>
      (r.countryA === rebelTag && r.countryB === enemyTag) ||
      (r.countryB === rebelTag && r.countryA === enemyTag)
        ? { ...r, status: 'peace' as const, pactDaysRemaining: 0 }
        : r
    );
    endedWars.push(`${rebelTag} ⚔️ ${enemyTag}`);

    if (rebelHome) {
      currentProvinces = currentProvinces.map(p => {
        if (p.owner === rebelHome && (p.unrest ?? 0) > 0) {
          pacifiedProvinces.push(p.name);
          return { ...p, unrest: 0 };
        }
        return p;
      });
    }
  }

  return {
    wars: currentWars,
    relations: currentRelations,
    provinces: currentProvinces,
    endedWars,
    pacifiedProvinces,
  };
}