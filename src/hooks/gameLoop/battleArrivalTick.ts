/**
 * battleArrivalTick.ts - 230 linhas - PASSO 4.3
 * Chegada de exércitos + detecção automática de combate
 */
import { checkAllProvinceCombats, startContinuousBattle, calculateArmySize } from '../../engine/combat';
import { applyConquestUnrest } from '../../engine/unrest';
import type { Army, Province, Country, War, ActiveBattle } from '../../types';
import type { GameDate } from '../../types/date';
import type { Recruitment, BuildingConstruction } from '../../types';
import type { ToastType } from '../../types/toast';

type Params = {
  arrivedArmies: Army[];
  armies: Army[];
  provinces: Province[];
  countries: Country[];
  wars: War[];
  recruitments: Recruitment[];
  buildingConstructions: BuildingConstruction[];
  currentActiveBattles: ActiveBattle[];
  snapshot: { date: GameDate };
  playerCountryTag: string;
  allCountries: Country[];
  activeBattlesRef: React.MutableRefObject<ActiveBattle[]>;
  addLog: (msg: string) => void;
  addToast: (
    msg: string,
    type?: ToastType,
    title?: string,
    date?: string
  ) => void;
  setActiveBattles: React.Dispatch<
    React.SetStateAction<ActiveBattle[]>
  >;
  cancelProvinceActivities: (
    provinceId: string,
    oldOwner: string,
    newOwner: string,
    rec: Recruitment[],
    cons: BuildingConstruction[],
    provs: Province[]
  ) => {
    recruitments: Recruitment[];
    constructions: BuildingConstruction[];
    provinces: Province[];
  };
};

export function processBattleArrival(p: Params) {
  let { arrivedArmies, armies, provinces, countries, wars, recruitments, buildingConstructions, currentActiveBattles } = p;
  const { snapshot, playerCountryTag, allCountries, activeBattlesRef, addLog, addToast, setActiveBattles, cancelProvinceActivities } = p;

  // 1. Primeiro move todo mundo que chegou pra lista principal
  for (const arrived of arrivedArmies) {
    const province = provinces.find(pr => pr.id === arrived.location);
    if (!province) {
      armies = [...armies, { ...arrived, inCombat: false, destination: null, path: [] }];
      continue;
    }

    const isInWar = wars.some(
      w => (w.attacker === arrived.owner && w.defender === province.owner) ||
        (w.defender === arrived.owner && w.attacker === province.owner)
    );

    const isHostile = (ownerA: string, ownerB: string, origA?: string, origB?: string): boolean => {
      const aRebel = ownerA.startsWith('rebel_');
      const bRebel = ownerB.startsWith('rebel_');
      if (aRebel && bRebel) return false;
      if (aRebel) return ownerB !== (origA || '');
      if (bRebel) return ownerA !== (origB || '');
      return wars.some(
        w => (w.attacker === ownerA && w.defender === ownerB) ||
          (w.defender === ownerA && w.attacker === ownerB)
      );
    };

    // Se não tem inimigo e não é guerra, só ocupa
    const enemies = armies.filter(a =>
      a.location === province.id &&
      a.id !== arrived.id &&
      isHostile(arrived.owner, a.owner, arrived.originalOwner, a.originalOwner)
    );

    const shouldBattle = enemies.length > 0 || isInWar;

    if (!shouldBattle && province.owner !== arrived.owner) {
      // Ocupação pacífica
      const oldOwner = province.owner;
      const newOwner = arrived.owner;

      provinces = provinces.map(pr => pr.id === province.id ? { ...pr, owner: newOwner, originalOwner: pr.originalOwner || oldOwner } : pr);
      countries = countries.map(c => {
        if (c.tag === newOwner) return { ...c, provinces: [...c.provinces, province.id] };
        if (c.tag === oldOwner) return { ...c, provinces: c.provinces.filter(pid => pid !== province.id) };
        return c;
      });

      const cancelResult = cancelProvinceActivities(province.id, oldOwner, newOwner, recruitments, buildingConstructions, provinces);
      recruitments = cancelResult.recruitments;
      buildingConstructions = cancelResult.constructions;
      provinces = cancelResult.provinces;

      armies = [...armies, { ...arrived, inCombat: false, destination: null, targetDestination: null, path: [] }];
      addLog(`🏳️ ${arrived.owner} ocupou ${province.name}`);
      continue;
    }

    // Se tem inimigo, não decide batalha aqui. Só coloca o exército na província livre
    // O checkAllProvinceCombats abaixo vai cuidar de criar/juntar na batalha
    armies = [...armies, { ...arrived, inCombat: false, destination: null, targetDestination: null, path: [] }];
  }

  // 2. Agora SIM verifica combate em todas as províncias com TODO MUNDO já no mapa
  // Usa o ref mais atualizado
  const battlesToCheck = activeBattlesRef.current.length > 0 ? activeBattlesRef.current : currentActiveBattles;
  const autoCombatResult = checkAllProvinceCombats(armies, provinces, wars, snapshot.date, battlesToCheck);

  armies = autoCombatResult.armies;
  currentActiveBattles = [...autoCombatResult.updatedBattles, ...autoCombatResult.newBattles];

  // Atualiza o ref e o state de uma vez
  activeBattlesRef.current = currentActiveBattles;
  setActiveBattles(currentActiveBattles);

  // Logs
  for (const newBattle of autoCombatResult.newBattles) {
    const province = provinces.find(pr => pr.id === newBattle.provinceId);
    if (province) {
      addLog(`⚔️ Batalha iniciada em ${province.name}! Duração: ${newBattle.daysTotal} dias`);
      const attacker = armies.find(a => a.id === newBattle.attackerArmyId);
      if (attacker && (attacker.owner === playerCountryTag || province.owner === playerCountryTag)) {
        addToast(`Batalha em ${province.name}! ${newBattle.daysTotal} dias`, 'warning', 'Batalha Iniciada');
      }
    }
  }

  for (const r of autoCombatResult.reinforcementsAdded) {
    addLog(`⚔️ Reforço: ${r.armyOwner} +${r.troops} em ${r.provinceName}`);
  }

  return { armies, provinces, countries, currentActiveBattles, recruitments, buildingConstructions };
}