/**
 * battleArrivalTick.ts - 230 linhas - PASSO 4.3
 * Chegada de exércitos + detecção automática de combate
 */
import { calculateArmySize, checkAllProvinceCombats } from '../../engine/combat';
import type { Army, Province, Country, War, ActiveBattle } from '../../types';
import type { GameDate } from '../../types/date';
import type { Recruitment, BuildingConstruction } from '../../types';
import type { ToastType } from '../../types/toast';
import { transferProvince } from '../../engine/territoryTransfer';
import { checkRebelTerritoryReturn } from '../../engine/rebellions';
import { buildLogisticsNetworks } from '../../engine/logistics';
import type { DiplomaticRelation } from '../../types';

type Params = {
  arrivedArmies: Army[];
  armies: Army[];
  provinces: Province[];
  countries: Country[];
  wars: War[];
  relations?: DiplomaticRelation[];
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
  const { snapshot, playerCountryTag, activeBattlesRef, addLog, addToast, setActiveBattles } = p;

  // A surviving occupier must still capture after the final defender withdraws.
  const vacantOccupiers = armies.filter(army => !army.inCombat && !army.destination && calculateArmySize(army) > 0
    && provinces.some(province => province.id === army.location && province.owner !== army.owner
      && wars.some(war => (war.attacker === army.owner && war.defender === province.owner)
        || (war.defender === army.owner && war.attacker === province.owner))));
  const occupierIds = new Set(vacantOccupiers.map(army => army.id));
  armies = armies.filter(army => !occupierIds.has(army.id));
  arrivedArmies = [...arrivedArmies, ...vacantOccupiers];

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
      if (aRebel) return ownerA.startsWith('rebel_v2_') ? ownerB === origA : ownerB !== (origA || '');
      if (bRebel) return ownerB.startsWith('rebel_v2_') ? ownerA === origB : ownerA !== (origB || '');
      return wars.some(
        w => (w.attacker === ownerA && w.defender === ownerB) ||
          (w.defender === ownerA && w.attacker === ownerB)
      );
    };

    // Only hostile armies fight. Empty territory can be transferred only by a
    // valid war occupation or by the established rebel liberation rule.
    const enemies = [...armies, ...arrivedArmies].filter(a =>
      a.location === province.id &&
      a.id !== arrived.id && calculateArmySize(a) > 0 &&
      isHostile(arrived.owner, a.owner, arrived.originalOwner, a.originalOwner)
    );

    if (enemies.length === 0 && province.owner !== arrived.owner) {
      const oldOwner = province.owner;
      const rebelReturnOwner = checkRebelTerritoryReturn(arrived);
      const canLiberate = !!rebelReturnOwner && province.owner.startsWith('rebel_');
      if (isInWar || canLiberate) {
        const newOwner = rebelReturnOwner || arrived.owner;
        const transferred = transferProvince(
          { provinces, countries, recruitments, constructions: buildingConstructions },
          province.id, newOwner, { date: snapshot.date, liberation: canLiberate }
        );
        provinces = transferred.provinces;
        countries = transferred.countries;
        recruitments = transferred.recruitments;
        buildingConstructions = transferred.constructions;
        addLog(`🏳️ ${newOwner} ocupou ${province.name} de ${oldOwner}`);
      }
      armies = [...armies, { ...arrived, inCombat: false }];
      continue;
    }

    // Se tem inimigo, não decide batalha aqui. Só coloca o exército na província livre
    // O checkAllProvinceCombats abaixo vai cuidar de criar/juntar na batalha
    armies = [...armies, { ...arrived, inCombat: false }];
  }

  // 2. Agora SIM verifica combate em todas as províncias com TODO MUNDO já no mapa
  // Usa o ref mais atualizado
  const battlesToCheck = activeBattlesRef.current.length > 0 ? activeBattlesRef.current : currentActiveBattles;
  const logistics = buildLogisticsNetworks({countries,provinces,wars,relations: p.relations ?? []});
  const autoCombatResult = checkAllProvinceCombats(armies, provinces, wars, snapshot.date, battlesToCheck,undefined,logistics);

  armies = autoCombatResult.armies.map(army => army.inCombat ? {
    ...army, destination: null, targetDestination: null, path: [], movementProgress: 0, position: null,
  } : army);
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
