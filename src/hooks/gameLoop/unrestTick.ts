/**
 * unrestTick.ts - 65 linhas - PASSO 4.5 
 * Agitação provincial e revoltas + Paz automática por anexação
 */
import { processProvincialPressure, spawnRebellions, recoverRebelArmies } from '../../engine/rebellion';
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

  armies = recoverRebelArmies(armies, provinces, countries);

  const pressure = processProvincialPressure(provinces, snapshot.date, armies, countries, wars);
  provinces = pressure.updatedProvinces;
  const spawned = spawnRebellions(provinces, countries, armies, wars, relations, snapshot.date);
  ({ provinces, countries, armies, wars, relations } = spawned);
  pressure.logs.forEach(addLog);
  // Formation feedback is published only after the full tick commits. Combat
  // and AI can resolve a newly created faction before that commit.

  const countriesWithoutProvinces = countries.filter(c => {
    if (c.isAnnexed) return false;
    const ownedProvinces = provinces.filter(pr => pr.owner === c.tag);
    return ownedProvinces.length === 0 && !c.rebellions?.some(f => f.status === 'active') && c.tag !== playerCountryTag;
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

  return { provinces, armies, countries, wars, relations, createdFactionIds: spawned.createdFactionIds };
}
