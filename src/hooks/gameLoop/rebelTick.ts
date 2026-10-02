/**
 * rebelTick.ts - 140 linhas - PASSO 4.8 - CORRIGIDO
 * Batalhas pendentes rebeldes + Guerra separatista + Fim de jogo
 */
import { startContinuousBattle } from '../../engine/combat';
import { ensureSeparatistWars, cleanupSeparatistWars } from '../../engine/rebellions';
import { checkEndGameConditions, calculateGameStats } from '../../engine/gameConditions';
import type { Army, Province, Country, War, ActiveBattle, CombatResult } from '../../types';
import type { GameDate } from '../../types/date';
import type { DiplomaticRelation } from '../../types/diplomacy';
import type { GameStats, EndGameType } from '../../engine/gameConditions';
import type { ToastType } from '../../types/toast';

type Params = {
  provinces: Province[];
  armies: Army[];
  countries: Country[];
  wars: War[];
  relations: DiplomaticRelation[];
  currentActiveBattles: ActiveBattle[];

  snapshot: {
    date: GameDate;
  };

  playerCountryTag: string;
  hasTriggeredEndGame: boolean;
  battleHistory: CombatResult[];

  dateRef: React.MutableRefObject<GameDate>;

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

  activeBattlesRef: React.MutableRefObject<ActiveBattle[]>;

  setEndGameType: React.Dispatch<
    React.SetStateAction<EndGameType>
  >;

  setGameStats: React.Dispatch<
    React.SetStateAction<GameStats | null>
  >;

  setHasTriggeredEndGame: React.Dispatch<
    React.SetStateAction<boolean>
  >;

  setIsPaused: React.Dispatch<
    React.SetStateAction<boolean>
  >;
};

export function processRebelTick(p: Params) {
  let { provinces, armies, countries, wars, relations, currentActiveBattles } = p;
  const { snapshot, playerCountryTag, hasTriggeredEndGame, battleHistory, dateRef, addLog, addToast, setActiveBattles, activeBattlesRef, setEndGameType, setGameStats, setHasTriggeredEndGame, setIsPaused } = p;

  for (const prov of provinces) {
    const armiesHere = armies.filter(a => a.location === prov.id && !a.inCombat && !a.destination);
    if (armiesHere.length < 2) continue;
    const rebelSide = armiesHere.filter(a => a.owner.startsWith('rebel_'));
    if (rebelSide.length === 0) continue;
    const existingBattle = currentActiveBattles.find(b => b.provinceId === prov.id);
    if (existingBattle) continue;
    const origOwner = rebelSide[0].originalOwner;
    const hostileSide = armiesHere.filter(a => !a.owner.startsWith('rebel_') && a.owner !== origOwner);
    if (hostileSide.length === 0) continue;
    const battleId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newBattle = startContinuousBattle(rebelSide, hostileSide, prov, snapshot.date, battleId);
    const participantIds = newBattle.participantArmyIds;
    armies = armies.map(a => participantIds.includes(a.id) ? { ...a, inCombat: true } : a);
    currentActiveBattles = [...currentActiveBattles, newBattle];
    addLog(`⚔️ Batalha iniciada em ${prov.name}: rebeldes vs ${hostileSide[0].owner}!`);
    if (prov.owner === playerCountryTag || hostileSide[0].owner === playerCountryTag) {
      addToast(`Rebeldes atacam ${prov.name}!`, 'warning', 'Batalha Iniciada');
    }
  }
  setActiveBattles(currentActiveBattles);
  activeBattlesRef.current = currentActiveBattles;

  const warResult = ensureSeparatistWars(armies, provinces, wars, relations, snapshot.date);
  if (warResult.newConflicts.length > 0) {
    wars = warResult.wars; relations = warResult.relations;
    for (const conflict of warResult.newConflicts) addLog(`📯 Guerra de Reconquista: ${conflict}!`);
    addToast('⚠️ Rebeldes separatistas declararam guerra de reconquista!', 'warning', 'Guerra Declarada');
  }

  const cleanupResult = cleanupSeparatistWars(armies, provinces, wars, relations);
  if (cleanupResult.endedWars.length > 0 || cleanupResult.pacifiedProvinces.length > 0) {
    wars = cleanupResult.wars; relations = cleanupResult.relations; provinces = cleanupResult.provinces;
    cleanupResult.endedWars.forEach(() => addLog(`🕊️ A guerra de reconquista terminou. A paz foi restaurada!`));
    if (cleanupResult.pacifiedProvinces.length > 0) {
      addToast(`🎉 Reconquista concluída! ${cleanupResult.pacifiedProvinces.length} província(s) celebram em paz.`, 'success', 'Paz Restaurada');
    }
  }

  let endGameTriggered = false;
  let endGameType: EndGameType | null = null;
  let gameStats: GameStats | null = null;
  if (!hasTriggeredEndGame) {
    const playerCountryData = countries.find(c => c.tag === playerCountryTag);
    if (playerCountryData) {
      const endGameResult = checkEndGameConditions(playerCountryData, provinces);
      if (endGameResult !== null) {
        const stats = calculateGameStats({ year: 1444, month: 11, day: 11 }, dateRef.current, battleHistory, playerCountryTag, provinces);
        endGameType = endGameResult; gameStats = stats; endGameTriggered = true;
        addLog(`🏁 ${endGameResult === 'victory' ? 'VITÓRIA!' : 'DERROTA!'} Jogo encerrado.`);
      }
    }
  }

  return { provinces, armies, countries, wars, relations, currentActiveBattles, endGameTriggered, endGameType, gameStats };
}
