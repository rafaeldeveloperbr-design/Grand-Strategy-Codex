/**
 * movementTick.ts - 44 linhas - PASSO 4.2
 * Movimentação + Correção de libertação rebelde
 */
import { processArmyMovement } from '../../engine/military';
import { advanceMovementPlans, clearMovementPlan, type MovementPlanInterruption } from '../../engine/military';
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
  playerCountryTag?: string;
  addToast?: (msg: string, type?: 'warning') => void;
};

export function processMovementTick(p: Params) {
  let { armies, provinces, countries, relations } = p;
  const { addLog } = p;
  armies = armies.map(a => a.retreatProtectionDays ? {...a, retreatProtectionDays: Math.max(0,a.retreatProtectionDays - 1)} : a);
  const prepared = advanceMovementPlans(armies, provinces, relations);
  armies = prepared.armies;
  const interruptions: MovementPlanInterruption[] = [...prepared.interruptions];

  // PASSO B: MOVIMENTAÇÃO
  const armyOwners = new Set(armies.map(army => army.owner));
  const logistics = buildLogisticsNetworks({countries:countries.filter(country => armyOwners.has(country.tag)),provinces,relations,wars: p.wars});
  const moveResult = processArmyMovement(armies, provinces, relations, logistics);
  armies = moveResult.updatedArmies.map(army => {
    const before = prepared.armies.find(a => a.id === army.id);
    if (before?.movementPlan?.waypoints.length && before.destination && !army.destination && !army.inCombat) {
      interruptions.push({ armyId: army.id, owner: army.owner, name: army.name, waypoint: before.movementPlan.waypoints[0] });
      return clearMovementPlan(army);
    }
    return army;
  });
  const relevant = interruptions.filter(item => item.owner === p.playerCountryTag);
  if (relevant.length) {
    const message = `Rota interrompida: ${relevant.map(item => item.name).join(', ')}. Próximo waypoint sem rota ou acesso válido.`;
    addLog(message); p.addToast?.(message, 'warning');
  }
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
