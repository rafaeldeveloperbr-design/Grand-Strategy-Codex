/**
 * aiTick.ts - 180 linhas - PASSO 4.7 - CORRIGIDO
 * IA dos bots + Fusão automática + IA separatista
 */
import { processAI, processAIEconomicDecisions } from '../../engine/aiEngine';
import { processSeparatistAI } from '../../engine/rebellions';
import { calculateArmySize } from '../../engine/combat';
import type { Army, Province, Country, War, Recruitment, BuildingConstruction } from '../../types';
import type { CountryTechState } from '../../types/technology';
import type { DiplomaticRelation } from '../../types/diplomacy';
import type { AIDifficulty } from '../../types/difficulty';
import type { GameDate } from '../../types/date';
import type { AIActionType } from '../../types/aiLog';

type Params = {
  countries: Country[];
  provinces: Province[];
  armies: Army[];
  wars: War[];
  relations: DiplomaticRelation[];
  buildingConstructions: BuildingConstruction[];
  recruitments: Recruitment[];
  currentBotTechStates: Map<string, CountryTechState>;
  playerCountryTag: string;
  aiDifficultyRef: React.MutableRefObject<AIDifficulty>;
  ceilingLogRef: React.MutableRefObject<Set<string>>;
  snapshot: { date: GameDate };
  allCountries: Country[];
  addAILog: (
    countryName: string,
    type: AIActionType,
    message: string,
    date: string,
    color?: string
  ) => void;
  formatGameDate: (date: GameDate) => string;
};

export function processAiTick(p: Params) {
  let { countries, provinces, armies, wars, relations, buildingConstructions, recruitments, currentBotTechStates } = p;
  const { playerCountryTag, ceilingLogRef, snapshot, addAILog, formatGameDate } = p;

  const activeBots = countries.filter(c => c && c.tag !== playerCountryTag);
  const dateString = formatGameDate(snapshot.date);

  activeBots.forEach((country: Country) => {
    const botTechState = currentBotTechStates.get(country.tag);
    if (botTechState) {
      const playerTroops = armies.filter(a => a.owner === playerCountryTag).reduce((sum, a) => sum + calculateArmySize(a), 0);
      const botTroops = armies.filter(a => a.owner === country.tag).reduce((sum, a) => sum + calculateArmySize(a), 0);
      const botAtWar = wars.some(w => w.attacker === country.tag || w.defender === country.tag);
      const multiplier = botAtWar ? 3 : 2;
      const ceiling = Math.max(12000, playerTroops * multiplier);
      const canRecruitMilitary = botTroops < ceiling;

      if (!canRecruitMilitary) {
        if (!ceilingLogRef.current.has(country.tag)) ceilingLogRef.current.add(country.tag);
      } else if (ceilingLogRef.current.has(country.tag)) {
        ceilingLogRef.current.delete(country.tag);
      }

      const economicResult = processAIEconomicDecisions(country, provinces, botTechState, buildingConstructions, recruitments, dateString, canRecruitMilitary, botAtWar);
      countries = countries.map(c => c.tag === country.tag ? economicResult.country : c);
      provinces = economicResult.provinces;
      currentBotTechStates.set(country.tag, economicResult.techState);
      buildingConstructions = economicResult.buildingConstructions;
      recruitments = economicResult.recruitments;
      economicResult.logs.forEach(log => {
        addAILog(
          country.name,
          log.actionType,
          log.message,
          dateString,
          country.color
        );
      });
    }

    const armiesBefore = armies.filter(a => a.owner === country.tag);
    armies = processAI(country.tag, armies, provinces, relations, wars);
    const armiesAfter = armies.filter(a => a.owner === country.tag);
    armiesAfter.forEach(armyAfter => {
      const armyBefore = armiesBefore.find(a => a.id === armyAfter.id);
      if (armyBefore && armyBefore.destination === null && armyAfter.destination !== null) {
        const destProvince = provinces.find(pr => pr.id === armyAfter.destination);
        if (destProvince) {
          const isEnemy = destProvince.owner !== country.tag;
          addAILog(country.name, 'military', `Exército moveu para ${destProvince.name}${isEnemy ? ' (território inimigo)' : ''}`, dateString, country.color);
        }
      }
    });
  });

  const armiesToMerge = new Map<string, Army[]>();
  for (const army of armies) {
    if (army.owner === playerCountryTag) continue;
    if (!army.location) continue;
    const key = `${army.owner}_${army.location}`;
    if (!armiesToMerge.has(key)) armiesToMerge.set(key, []);
    armiesToMerge.get(key)!.push(army);
  }
  for (const [, armiesInProvince] of armiesToMerge) {
    if (armiesInProvince.length < 2) continue;
    const [primaryArmy, ...secondaryArmies] = armiesInProvince;
    const mergedRegiments = [...primaryArmy.regiments];
    for (const secondaryArmy of secondaryArmies) {
      for (const regiment of secondaryArmy.regiments) {
        const existingRegiment = mergedRegiments.find(r => r.type === regiment.type);
        if (existingRegiment) {
          existingRegiment.strength += regiment.strength;
          existingRegiment.morale = (existingRegiment.morale + regiment.morale) / 2;
        } else {
          mergedRegiments.push({ ...regiment });
        }
      }
    }
    const updatedPrimaryArmy = { ...primaryArmy, regiments: mergedRegiments, targetArmyId: null };
    const secondaryIds = secondaryArmies.map(a => a.id);
    armies = armies.filter(a => !secondaryIds.includes(a.id));
    armies = armies.map(a => a.id === primaryArmy.id ? updatedPrimaryArmy : a);
  }

  armies = processSeparatistAI(armies, provinces);

  return { countries, provinces, armies, wars, relations, buildingConstructions, recruitments, currentBotTechStates };
}
