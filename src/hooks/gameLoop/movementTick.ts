/**
 * movementTick.ts - 44 linhas - PASSO 4.2
 * Movimentação + Correção de libertação rebelde
 */
import { processArmyMovement } from '../../engine/military';
import type { Army, Province, Country } from '../../types';
import type { DiplomaticRelation } from '../../types/diplomacy';

type Params = {
  armies: Army[];
  provinces: Province[];
  relations: DiplomaticRelation[];
  countries: Country[];
  addLog: (msg: string) => void;
};

export function processMovementTick(p: Params) {
  let { armies, provinces, countries, relations } = p;
  const { addLog } = p;

  // PASSO B: MOVIMENTAÇÃO
  const moveResult = processArmyMovement(armies, provinces, relations);
  armies = moveResult.updatedArmies;
  const arrivedArmies = moveResult.arrivedArmies;
  provinces = moveResult.updatedProvinces;

  // PASSO B.5: CORREÇÃO DE LIBERTAÇÃO REBELDE
  if (provinces.some(prov => prov.owner.startsWith('rebel_'))) {
    const changes: { id: string; name: string; newOwner: string }[] = [];

    provinces = provinces.map(pr => {
      if (!pr.owner.startsWith('rebel_')) return pr;
      const rebelArmy = armies.find(a => a.owner === pr.owner);
      const liberator = rebelArmy?.originalOwner || pr.originalOwner;
      if (!liberator) return pr;
      changes.push({ id: pr.id, name: pr.name, newOwner: liberator });
      return { ...pr, owner: liberator, unrest: 0 };
    });

    if (changes.length > 0) {
      countries = countries.map(c => ({
        ...c,
        provinces: provinces.filter(pr => pr.owner === c.tag).map(pr => pr.id),
      }));

      for (const ch of changes) {
        const countryName = countries.find(c => c.tag === ch.newOwner)?.name || ch.newOwner;
        console.log(`🏴 Libertação corrigida: ${ch.name} → ${countryName}`);
        addLog(`🏴 ${ch.name} libertada! Devolvida a ${countryName}.`);
      }
    }
  }

  return { armies, provinces, countries, arrivedArmies };
}