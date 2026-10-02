import { Army } from '../../types/army';
import { Province } from '../../types/province';
import { ActiveBattle } from '../../types/battle';
import { calculateArmySize } from './combatCalculations';

/**
 * Verifica se um exército perdedor tem rota de fuga para províncias próprias
 * Retorna a província de recuo ou null se estiver cercado
 */
export function findRetreatProvince(
  loserOwner: string,
  battleProvince: Province,
  allProvinces: Province[]
): Province | null {
  // Busca províncias vizinhas que pertencem ao país do perdedor
  const retreatProvinces = battleProvince.neighbors
    .map(neighborId => allProvinces.find(p => p.id === neighborId))
    .filter(p => p && p.owner === loserOwner);

  if (retreatProvinces.length === 0) {
    // Perdedor está cercado - não há rota de fuga
    return null;
  }

  // Retorna a primeira província própria encontrada (poderia ser otimizado para escolher a mais segura)
  return retreatProvinces[0]!;
}

/**
 * Aplica aniquilação total por cerco (100% de baixas)
 * Retorna um exército com 0 tropas
 */
export function applySiegeAnnihilation(army: Army): Army {
  console.log(`💀 Exército ${army.owner} aniquilado por cerco!`);
  return {
    ...army,
    regiments: [], // Remove todos os regimentos
  };
}

/**
 * Recuo manual de um exército durante batalha
 * Remove o exército da batalha e move para província vizinha amigável
 */
export function retreatArmyManually(
  armyId: string,
  battleId: string,
  armies: Army[],
  activeBattles: ActiveBattle[],
  provinces: Province[]
): {
  armies: Army[];
  activeBattles: ActiveBattle[];
  retreatSuccess: boolean;
  battleEnded: boolean;
  winner?: 'attacker' | 'defender';
} {
  // Encontra o exército
  const army = armies.find(a => a.id === armyId);
  if (!army) {
    console.warn(`❌ Exército ${armyId} não encontrado`);
    return { armies, activeBattles, retreatSuccess: false, battleEnded: false };
  }

  // Encontra a batalha
  const battle = activeBattles.find(b => b.id === battleId);
  if (!battle) {
    console.warn(`❌ Batalha ${battleId} não encontrada`);
    return { armies, activeBattles, retreatSuccess: false, battleEnded: false };
  }

  // Verifica se o exército está na batalha
  if (!battle.participantArmyIds.includes(armyId)) {
    console.warn(`❌ Exército ${armyId} não está participando da batalha ${battleId}`);
    return { armies, activeBattles, retreatSuccess: false, battleEnded: false };
  }

  // Encontra a província da batalha
  const battleProvince = provinces.find(p => p.id === battle.provinceId);
  if (!battleProvince) {
    console.warn(`❌ Província da batalha não encontrada`);
    return { armies, activeBattles, retreatSuccess: false, battleEnded: false };
  }

  // Determina o lado do exército (atacante ou defensor)
  const isAttackerSide = battle.attackerArmyId === armyId || 
    armies.some(a => battle.participantArmyIds.includes(a.id) && a.owner === army.owner && a.id !== armyId && a.id === battle.attackerArmyId);
  
  // Encontra província de recuo
  const retreatProvince = findRetreatProvince(army.owner, battleProvince, provinces);
  
  if (!retreatProvince) {
    console.warn(`❌ Nenhuma província de recuo disponível para ${army.owner}`);
    return { armies, activeBattles, retreatSuccess: false, battleEnded: false };
  }

  console.log(`🏃 Exército ${armyId} (${army.owner}) recuando de ${battleProvince.name} para ${retreatProvince.name}`);

  // Remove exército da lista de participantes
  const updatedBattle = {
    ...battle,
    participantArmyIds: battle.participantArmyIds.filter(id => id !== armyId)
  };

  // Recalcula tropas do lado
  const armyTroops = calculateArmySize(army);
  if (isAttackerSide) {
    updatedBattle.attackerCurrentTroops = Math.max(0, updatedBattle.attackerCurrentTroops - armyTroops);
  } else {
    updatedBattle.defenderCurrentTroops = Math.max(0, updatedBattle.defenderCurrentTroops - armyTroops);
  }

  // Move exército para província de recuo e libera do combate
  const updatedArmies = armies.map(a => {
    if (a.id === armyId) {
      return { ...a, location: retreatProvince.id, inCombat: false };
    }
    return a;
  });

  // Verifica se todos os exércitos de um lado recuaram
  const remainingAttackerArmies = updatedBattle.participantArmyIds.filter(id => {
    const participantArmy = updatedArmies.find(a => a.id === id);
    return participantArmy && participantArmy.owner === (isAttackerSide ? army.owner : undefined);
  });

  // Se não há mais exércitos de um lado, finaliza a batalha
  if (updatedBattle.participantArmyIds.length === 0) {
    console.log(`🏁 Batalha ${battleId} finalizada - todos os exércitos recuaram`);
    
    // Remove batalha da lista
    const updatedBattles = activeBattles.filter(b => b.id !== battleId);
    
    // Determina vencedor (o lado que ainda tem exércitos, ou atacante se ambos recuaram)
    const winner = updatedBattle.attackerCurrentTroops > 0 ? 'attacker' : 'defender';
    
    return {
      armies: updatedArmies,
      activeBattles: updatedBattles,
      retreatSuccess: true,
      battleEnded: true,
      winner
    };
  }

  // Atualiza lista de batalhas
  const updatedBattles = activeBattles.map(b => b.id === battleId ? updatedBattle : b);

  return {
    armies: updatedArmies,
    activeBattles: updatedBattles,
    retreatSuccess: true,
    battleEnded: false
  };
}