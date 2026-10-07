/**
 * movementTick.ts - 44 linhas - PASSO 4.2
 * Movimentação + Correção de libertação rebelde
 */
import { processArmyMovement } from '../../engine/military';
import type { Army, Province, Country } from '../../types';
import type { DiplomaticRelation } from '../../types/diplomacy';
import { transferProvince } from '../../engine/territoryTransfer';
import { buildLogisticsNetworks } from '../../engine/logistics';
import type { War } from '../../types';

type Params = {
  armies: Army[];
  provinces: Province[];
  relations: DiplomaticRelation[];
  countries: Country[];
  wars?: War[];
  addLog: (msg: string) => void;
};

export function processMovementTick(p: Params) {
  let { armies, provinces, countries, relations } = p;
  const { addLog } = p;

  // PASSO B: MOVIMENTAÇÃO
  const logistics = buildLogisticsNetworks({countries,provinces,relations,wars: p.wars});
  const moveResult = processArmyMovement(armies, provinces, relations, logistics);
  armies = moveResult.updatedArmies;
  const arrivedArmies = moveResult.arrivedArmies;
  provinces = moveResult.updatedProvinces;

  // PASSO B.5: CORREÇÃO DE LIBERTAÇÃO REBELDE
  if (provinces.some(prov => prov.owner.startsWith('rebel_'))) {
    const changes: { id: string; name: string; newOwner: string }[] = [];

    const modernIds = new Set(countries.flatMap(c => c.rebellions ?? []).map(f => f.id));
    for (const pr of provinces.filter(item => item.owner.startsWith('rebel_') && !item.owner.startsWith('rebel_v2_') && !modernIds.has(item.owner))) {
      const rebelArmy = armies.find(a => a.owner === pr.owner);
      const liberator = rebelArmy?.originalOwner || pr.originalOwner;
      if (!liberator) continue;
      changes.push({ id: pr.id, name: pr.name, newOwner: liberator });
      const transferred = transferProvince(
        { provinces, countries, recruitments: [], constructions: [] },
        pr.id, liberator, { liberation: true }
      );
      provinces = transferred.provinces;
      countries = transferred.countries;
    }

    if (changes.length > 0) {
      for (const ch of changes) {
        const countryName = countries.find(c => c.tag === ch.newOwner)?.name || ch.newOwner;
        console.log(`🏴 Libertação corrigida: ${ch.name} → ${countryName}`);
        addLog(`🏴 ${ch.name} libertada! Devolvida a ${countryName}.`);
      }
    }
  }

  return { armies, provinces, countries, arrivedArmies };
}
