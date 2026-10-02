/**
 * useDiplomacyActions.ts - CORRIGIDO - assinaturas reais do seu App.tsx original
 */
import { useCallback } from 'react';
import { improveRelations, offerNonAggressionPact, declareWar, makePeace, DIPLOMATIC_COSTS } from '../../engine/diplomacy';
import type { Country, War, GameDate } from '../../types';
import type { DiplomaticRelation } from '../../types/diplomacy';

type Params = {
  diplomacyTarget: string | null;

  setDiplomacyTarget: React.Dispatch<
    React.SetStateAction<string | null>
  >;

  playerCountry: Country;
  playerCountryTag: string;

  allCountries: Country[];

  setAllCountries: React.Dispatch<
    React.SetStateAction<Country[]>
  >;

  diplomaticRelations: DiplomaticRelation[];

  setDiplomaticRelations: React.Dispatch<
    React.SetStateAction<DiplomaticRelation[]>
  >;

  wars: War[];

  setWars: React.Dispatch<
    React.SetStateAction<War[]>
  >;

  date: GameDate;

  addLog: (msg: string) => void;
};

export function useDiplomacyActions(params: Params) {
  const { diplomacyTarget, setDiplomacyTarget, playerCountry, playerCountryTag, allCountries, setAllCountries, diplomaticRelations, setDiplomaticRelations, wars, setWars, date, addLog } = params;

  const handleImproveRelations = useCallback(() => {
    if (!diplomacyTarget) return;
    if (playerCountry.resources.gold < DIPLOMATIC_COSTS.improve_relations.gold) return;
    setAllCountries(prev =>
      prev.map(c => c.tag === playerCountryTag ? { ...c, resources: { ...c.resources, gold: c.resources.gold - DIPLOMATIC_COSTS.improve_relations.gold } } : c));
    setDiplomaticRelations(prev => improveRelations(prev, playerCountryTag, diplomacyTarget, DIPLOMATIC_COSTS.improve_relations.opinionChange));
    addLog(`💰 Melhorou relações com ${allCountries.find(c => c.tag === diplomacyTarget)?.name}`);
  }, [diplomacyTarget, playerCountry, playerCountryTag, allCountries, addLog, setAllCountries, setDiplomaticRelations]);

  const handleOfferNonAggression = useCallback(() => {
    if (!diplomacyTarget) return;
    if (playerCountry.resources.gold < DIPLOMATIC_COSTS.offer_non_aggression.gold) return;
    setAllCountries((prev: Country[]) => prev.map((c: Country) => c.tag === playerCountryTag ? { ...c, resources: { ...c.resources, gold: c.resources.gold - DIPLOMATIC_COSTS.offer_non_aggression.gold } } : c));
    setDiplomaticRelations(prev =>
      offerNonAggressionPact(
        prev,
        playerCountryTag,
        diplomacyTarget,
        365
      )
    );
    addLog(`🤝 Pacto de não agressão com ${allCountries.find(c => c.tag === diplomacyTarget)?.name}`);
  }, [diplomacyTarget, playerCountry, playerCountryTag, allCountries, addLog, setAllCountries, setDiplomaticRelations]);

  const handleDeclareWar = useCallback(() => {
    if (!diplomacyTarget) return;
    const result = declareWar(diplomaticRelations, wars, playerCountryTag, diplomacyTarget, date);
    setDiplomaticRelations(result.relations);
    setWars(result.wars);
    addLog(`⚔️ Guerra declarada contra ${allCountries.find(c => c.tag === diplomacyTarget)?.name}!`);
    setDiplomacyTarget(null);
  }, [diplomacyTarget, diplomaticRelations, wars, playerCountryTag, date, allCountries, addLog, setDiplomaticRelations, setWars, setDiplomacyTarget]);

  const handleMakePeace = useCallback((warId: string) => {
    const war = wars.find(w => w.id === warId);
    if (!war) return;
    const enemy = war.attacker === playerCountryTag ? war.defender : war.attacker;
    const result = makePeace(diplomaticRelations, wars, playerCountryTag, enemy);
    setDiplomaticRelations(result.relations);
    setWars(result.wars);
    addLog(`🕊️ Paz assinada com ${allCountries.find(c => c.tag === enemy)?.name}`);
  }, [wars, diplomaticRelations, playerCountryTag, allCountries, addLog, setDiplomaticRelations, setWars]);

  return { handleImproveRelations, handleOfferNonAggression, handleDeclareWar, handleMakePeace };
}
