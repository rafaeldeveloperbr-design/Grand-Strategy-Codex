/**
 * unrestTick.ts - 65 linhas - PASSO 4.5 
 * Agitação provincial e revoltas + Paz automática por anexação
 */
import { processDailyUnrestDecay } from '../../engine/unrest';
import { processRebelAccumulation, processSeparatistAI } from '../../engine/rebellions';
import type { Army, Province, Country, War } from '../../types';
import type { GameDate } from '../../types/date';
import type { DiplomaticRelation } from '../../types/diplomacy';
import type { ToastType } from '../../types/toast';

type CountryWithAnnex = Country & {
  isAnnexed?: boolean;
};

type Params = {
  provinces: Province[];
  armies: Army[];
  countries: CountryWithAnnex[];
  wars: War[];
  relations: DiplomaticRelation[];
  snapshot: { date: GameDate };
  playerCountryTag: string;
  allCountries: Country[];
  addLog: (msg: string) => void;
  addToast: (
    message: string,
    type?: ToastType,
    title?: string,
    dateString?: string,
    duration?: number
  ) => void;
};

export function processUnrestTick(p: Params) {
  let { provinces, armies, countries, wars, relations } = p;
  const { snapshot, playerCountryTag, addLog, addToast } = p;

  const { updatedProvinces: provincesWithDecay, revoltedProvinces } =
    processDailyUnrestDecay(provinces, snapshot.date, armies);
  provinces = provincesWithDecay;

  if (revoltedProvinces.length > 0) {
    const revoltedProvIds = revoltedProvinces.map(pr => pr.id);
    const rebelResult = processRebelAccumulation(provinces, armies, revoltedProvIds);
    armies = rebelResult.updatedArmies;
    provinces = rebelResult.updatedProvinces;
    armies = processSeparatistAI(armies, provinces);

    for (const revoltedProv of revoltedProvinces) {
      addLog(`🔥 Revolta em ${revoltedProv.name}! Tropas rebeldes surgiram!`);
      if (revoltedProv.owner === playerCountryTag) {
        addToast(`Revolta em ${revoltedProv.name}!`, 'error', 'Revolta!');
      }
    }
    rebelResult.notifications.forEach((notif: string) => {
      addToast(notif, 'warning', 'Separatismo Ativado');
      addLog(notif);
    });
  }

  const countriesWithoutProvinces = countries.filter(c => {
    if (c.isAnnexed) return false;
    const ownedProvinces = provinces.filter(pr => pr.owner === c.tag);
    return ownedProvinces.length === 0 && c.tag !== playerCountryTag;
  });

  if (countriesWithoutProvinces.length > 0) {
    for (const defeatedCountry of countriesWithoutProvinces) {
      countries = countries.map(c => c.tag === defeatedCountry.tag ? { ...c, isAnnexed: true } : c);
      addLog(`🏳️ ${defeatedCountry.name} foi totalmente anexado!`);
      addToast(`${defeatedCountry.name} foi totalmente anexado!`, 'warning', 'Anexação Total');
      wars = wars.filter(w => w.attacker !== defeatedCountry.tag && w.defender !== defeatedCountry.tag);
      relations = relations.filter(r => r.countryA !== defeatedCountry.tag && r.countryB !== defeatedCountry.tag);
    }
  }

  return { provinces, armies, countries, wars, relations };
}