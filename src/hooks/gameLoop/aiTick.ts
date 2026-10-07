import { buildLogisticsNetworks } from '../../engine/logistics';
import { processDiplomacyAI } from '../../engine/diplomacy';
/**
 * aiTick.ts - 180 linhas - PASSO 4.7 - CORRIGIDO
 * IA dos bots + Fusão automática + IA separatista
 */
import { processAI, processAIEconomicDecisions } from '../../engine/aiEngine';
import { processSeparatistAI } from '../../engine/rebellions';
import { planRebelMovement, respondToRebellions } from '../../engine/rebellion';
import { calculateArmySize } from '../../engine/combat';
import { mergeArmies } from '../../engine/military';
import type { Army, Province, Country, War, Recruitment, BuildingConstruction } from '../../types';
import type { CountryTechState } from '../../types/technology';
import type { DiplomaticRelation } from '../../types/diplomacy';
import type { AIDifficulty } from '../../types/difficulty';
import type { GameDate } from '../../types/date';
import type { AIActionType } from '../../types/aiLog';
import type { ToastType } from '../../types/toast';

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
  addToast?: (message: string,type?: ToastType,title?: string,date?: string) => void;
};

export function processAiTick(p: Params) {
  let { countries, provinces, armies, wars, relations, buildingConstructions, recruitments, currentBotTechStates } = p;
  const { playerCountryTag, ceilingLogRef, snapshot, addAILog, formatGameDate } = p;

  const diplomaticAI = processDiplomacyAI({relations,wars,countries,armies,provinces,date: snapshot.date},playerCountryTag);
  const oldProposals = new Set(relations.flatMap(r => r.proposals ?? []).map(p => p.id));
  for (const proposal of diplomaticAI.relations.flatMap(r => r.proposals ?? []).filter(q => q.to === playerCountryTag && !oldProposals.has(q.id))) {
    const country = countries.find(c => c.tag === proposal.from);
    p.addToast?.(`${country?.name ?? proposal.from} enviou ${proposal.kind === 'call' ? 'uma chamada à guerra' : proposal.kind === 'alliance' ? 'uma proposta de aliança' : proposal.kind === 'nap' ? 'um pacto de não agressão' : 'um pedido de acesso militar'}. Abra a diplomacia com esse país para responder.`, 'info','Diplomacia',formatGameDate(snapshot.date));
  }
  relations = diplomaticAI.relations; wars = diplomaticAI.wars;
  diplomaticAI.messages.forEach(message => addAILog('Diplomacia', 'diplomacy', message, formatGameDate(snapshot.date)));

  const rebellionResponse = respondToRebellions(provinces, countries, armies, relations, p.snapshot.date, p.playerCountryTag);
  ({ provinces, countries, armies } = rebellionResponse);
  rebellionResponse.logs.forEach(message => addAILog('Rebeliões', 'government', message, formatGameDate(snapshot.date), '#e67e22'));
  const logistics = buildLogisticsNetworks({countries,provinces,relations,wars});
  const activeBots = countries.filter(c => c && c.tag !== playerCountryTag);
  const dateString = formatGameDate(snapshot.date);

  activeBots.forEach((country: Country) => {
    const botTechState = currentBotTechStates.get(country.tag);
    if (botTechState) {
      const botTroops = armies.filter(a => a.owner === country.tag).reduce((sum, a) => sum + calculateArmySize(a), 0);
      const botAtWar = wars.some(w => w.attacker === country.tag || w.defender === country.tag);
      const affordableDailyMaintenance = Math.max(0, country.economy.goldIncome - country.economy.goldExpense) * (botAtWar ? 18 : 12);
      const populationCapacity = country.resources.maxManpower * (botAtWar ? .6 : .35);
      const economicCapacity = Math.max(3000, affordableDailyMaintenance * 1000);
      const forceTarget = Math.min(populationCapacity, economicCapacity);
      const canRecruitMilitary = botTroops < forceTarget && country.resources.manpower >= 400 && country.resources.gold >= (botAtWar ? 80 : 180);

      if (!canRecruitMilitary) {
        if (!ceilingLogRef.current.has(country.tag)) ceilingLogRef.current.add(country.tag);
      } else if (ceilingLogRef.current.has(country.tag)) {
        ceilingLogRef.current.delete(country.tag);
      }

      const economicResult = processAIEconomicDecisions(country, provinces, botTechState, buildingConstructions, recruitments, dateString, canRecruitMilitary, botAtWar);
      countries = countries.map(c => c.tag === country.tag ? economicResult.country : c);
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
    armies = processAI(country.tag,
      armies,
      provinces,
      relations,
      wars,
      countries,logistics);
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

    const owner = armiesInProvince[0].owner;

    const countryAtWar = wars.some(
      war =>
        war.attacker === owner ||
        war.defender === owner
    );



    const totalTroops = armiesInProvince.reduce(
      (sum, army) => sum + calculateArmySize(army),
      0
    );

    const MAX_AI_STACK = countryAtWar
      ? 12000
      : 6000;

    if (totalTroops > MAX_AI_STACK) {
      continue;
    }

    const [primaryArmy, ...secondaryArmies] =
      armiesInProvince;

    let mergedArmy = primaryArmy;
    for (const secondaryArmy of secondaryArmies) {
      mergedArmy = mergeArmies(mergedArmy, secondaryArmy);
    }
    const updatedPrimaryArmy = { ...mergedArmy, targetArmyId: null };
    const secondaryIds = secondaryArmies.map(a => a.id);
    armies = armies.filter(a => !secondaryIds.includes(a.id));
    armies = armies.map(a => a.id === primaryArmy.id ? updatedPrimaryArmy : a);
  }

  armies = processSeparatistAI(armies, provinces);
  armies = planRebelMovement(armies, provinces, countries, relations, snapshot.date);

  return { countries, provinces, armies, wars, relations, buildingConstructions, recruitments, currentBotTechStates };
}
