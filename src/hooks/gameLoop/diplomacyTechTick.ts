/**
 * diplomacyTechTick.ts - 120 linhas - PASSO 4.6
 * Diplomacia + Tecnologias e Focos + War Score
 */
import { processDiplomacyTick } from '../../engine/diplomacy';
import { processDailyTechProgress } from '../../engine/technology';
import type { Country, Province, Army, War } from '../../types';
import type { CountryTechState } from '../../types/technology';
import type { DiplomaticRelation } from '../../types/diplomacy';
import type { AIDifficulty } from '../../types/difficulty';
import type { GameDate } from '../../types/date';
import type { ToastType } from '../../types/toast';
import type { AIActionType } from '../../types/aiLog';

type Params = {
  countries: Country[];
  provinces: Province[];
  armies: Army[];
  wars: War[];
  relations: DiplomaticRelation[];
  playerCountryTag: string;
  snapshot: { date: GameDate };
  currentPlayerTechState: CountryTechState;
  currentBotTechStates: Map<string, CountryTechState>;
  aiDifficultyRef: React.MutableRefObject<AIDifficulty>;
  playerTechStateRef: React.MutableRefObject<CountryTechState>;
  botTechStatesRef: React.MutableRefObject<Map<string, CountryTechState>>;
  addLog: (msg: string) => void;
  addToast: (
    msg: string,
    type?: ToastType,
    title?: string,
    date?: string
  ) => void;

  addAILog: (
    countryName: string,
    type: AIActionType,
    message: string,
    date: string,
    color?: string
  ) => void;
  formatGameDate: (date: GameDate) => string;
};

export function processDiplomacyTechTick(p: Params) {
  let { countries, provinces, armies, wars, relations, currentPlayerTechState, currentBotTechStates } = p;
  const { playerCountryTag, snapshot, aiDifficultyRef, playerTechStateRef, botTechStatesRef, addLog, addToast, formatGameDate } = p;

  // PASSO E: DIPLOMACIA
  relations = processDiplomacyTick({relations,wars,countries,date: snapshot.date,armies,provinces}).relations;

  // PASSO E.5: TECNOLOGIAS E FOCOS
  const playerCountry = countries.find(c => c?.tag === playerCountryTag);
  if (currentPlayerTechState && playerCountry) {
    const playerTechResult = processDailyTechProgress(currentPlayerTechState, playerCountry, aiDifficultyRef.current, true);
    currentPlayerTechState = playerTechResult.techState;
    playerTechStateRef.current = currentPlayerTechState;
    if (playerTechResult.notifications?.length > 0) {
      const dateString = formatGameDate(snapshot.date);
      playerTechResult.notifications.forEach((notif: string) => {
        addLog(notif);
        if (notif.includes('Foco concluído')) addToast(notif.replace('✅ ', ''), 'success', 'Foco Concluído', dateString);
        else if (notif.includes('Pesquisa concluída')) addToast(notif.replace('🔬 ', ''), 'success', 'Tecnologia Desenvolvida', dateString);
      });
    }
  }

  countries.forEach(country => {
    if (country?.tag && country.tag !== playerCountryTag) {
      const botTechState = currentBotTechStates.get(country.tag);
      if (botTechState) {
        const botTechResult = processDailyTechProgress(botTechState, country, aiDifficultyRef.current, false, false);
        currentBotTechStates.set(country.tag, botTechResult.techState);
      }
    }
  });
  botTechStatesRef.current = currentBotTechStates;

  return { countries, provinces, armies, wars, relations, currentPlayerTechState, currentBotTechStates };
}
