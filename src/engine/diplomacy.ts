/**
 * ============================================================
 * MÓDULO 4 - Motor de Diplomacia
 * ============================================================
 * Gerencia relações entre países, declarações de guerra e paz
 */

import { DiplomaticRelation, War, DiplomaticActionCost } from '../types/diplomacy';
import { Country } from '../types';

/**
 * Custos das ações diplomáticas
 */
export const DIPLOMATIC_COSTS: Record<string, DiplomaticActionCost> = {
  improve_relations: {
    gold: 50,
    opinionChange: 10,
    daysToComplete: 30
  },
  offer_non_aggression: {
    gold: 100,
    opinionChange: 20
  },
  declare_war: {
    gold: 0,
    opinionChange: -50
  },
  make_peace: {
    gold: 0,
    opinionChange: 10
  }
};

/**
 * Gera um ID único para guerras
 */
let warIdCounter = 0;
export function generateWarId(): string {
  return `war_${++warIdCounter}`;
}

/**
 * Obtém ou cria uma relação diplomática entre dois países
 */
export function getOrCreateRelation(
  relations: DiplomaticRelation[],
  countryA: string,
  countryB: string
): DiplomaticRelation {
  const existing = relations.find(
    r => (r.countryA === countryA && r.countryB === countryB) ||
         (r.countryA === countryB && r.countryB === countryA)
  );

  if (existing) return existing;

  // Cria nova relação com opinião neutra
  return {
    countryA,
    countryB,
    opinion: 0,
    status: 'peace',
    pactDaysRemaining: 0
  };
}

/**
 * Verifica se dois países estão em guerra
 */

/**
 * Verifica se uma guerra tem tempo mínimo para fazer paz (30 dias)
 */

/**
 * Verifica se dois países têm pacto de não agressão
 */

/**
 * Declara guerra entre dois países
 */
export function declareWar(
  relations: DiplomaticRelation[],
  wars: War[],
  attacker: string,
  defender: string,
  currentDate: { year: number; month: number; day: number }
): { relations: DiplomaticRelation[]; wars: War[] } {
  // Atualiza relação
  const updatedRelations = relations.map(r => {
    if ((r.countryA === attacker && r.countryB === defender) ||
        (r.countryA === defender && r.countryB === attacker)) {
      return {
        ...r,
        status: 'war' as const,
        opinion: Math.max(-100, r.opinion - 50)
      };
    }
    return r;
  });

  // Se não existia relação, adiciona
  const hasRelation = updatedRelations.some(
    r => (r.countryA === attacker && r.countryB === defender) ||
         (r.countryA === defender && r.countryB === attacker)
  );

  if (!hasRelation) {
    updatedRelations.push({
      countryA: attacker,
      countryB: defender,
      opinion: -50,
      status: 'war',
      pactDaysRemaining: 0
    });
  }

  // Cria nova guerra
  const newWar: War = {
    id: generateWarId(),
    attacker,
    defender,
    startDate: { ...currentDate },
    warScore: 0,
    attackerCasualties: 0,
    defenderCasualties: 0,
    occupiedByAttacker: [],
    occupiedByDefender: []
  };

  return {
    relations: updatedRelations,
    wars: [...wars, newWar]
  };
}

/**
 * Assina paz entre dois países
 */
export function makePeace(
  relations: DiplomaticRelation[],
  wars: War[],
  countryA: string,
  countryB: string
): { relations: DiplomaticRelation[]; wars: War[] } {
  // Atualiza relação
  const updatedRelations = relations.map(r => {
    if ((r.countryA === countryA && r.countryB === countryB) ||
        (r.countryA === countryB && r.countryB === countryA)) {
      return {
        ...r,
        status: 'peace' as const,
        opinion: Math.min(100, r.opinion + 10)
      };
    }
    return r;
  });

  // Remove guerra
  const updatedWars = wars.filter(
    w => !((w.attacker === countryA && w.defender === countryB) ||
           (w.attacker === countryB && w.defender === countryA))
  );

  return {
    relations: updatedRelations,
    wars: updatedWars
  };
}

/**
 * Oferece pacto de não agressão
 */
export function offerNonAggressionPact(
  relations: DiplomaticRelation[],
  countryA: string,
  countryB: string,
  duration: number = 365
): DiplomaticRelation[] {
  const updatedRelations = relations.map(r => {
    if ((r.countryA === countryA && r.countryB === countryB) ||
        (r.countryA === countryB && r.countryB === countryA)) {
      return {
        ...r,
        status: 'non_aggression_pact' as const,
        pactDaysRemaining: duration,
        opinion: Math.min(100, r.opinion + 20)
      };
    }
    return r;
  });

  // Se não existia relação, adiciona
  const hasRelation = updatedRelations.some(
    r => (r.countryA === countryA && r.countryB === countryB) ||
         (r.countryA === countryB && r.countryB === countryA)
  );

  if (!hasRelation) {
    updatedRelations.push({
      countryA,
      countryB,
      opinion: 20,
      status: 'non_aggression_pact',
      pactDaysRemaining: duration
    });
  }

  return updatedRelations;
}

/**
 * Melhora relações entre dois países
 */
export function improveRelations(
  relations: DiplomaticRelation[],
  countryA: string,
  countryB: string,
  amount: number = 10
): DiplomaticRelation[] {
  const updatedRelations = relations.map(r => {
    if ((r.countryA === countryA && r.countryB === countryB) ||
        (r.countryA === countryB && r.countryB === countryA)) {
      return {
        ...r,
        opinion: Math.min(100, r.opinion + amount)
      };
    }
    return r;
  });

  // Se não existia relação, adiciona
  const hasRelation = updatedRelations.some(
    r => (r.countryA === countryA && r.countryB === countryB) ||
         (r.countryA === countryB && r.countryB === countryA)
  );

  if (!hasRelation) {
    updatedRelations.push({
      countryA,
      countryB,
      opinion: amount,
      status: 'peace',
      pactDaysRemaining: 0
    });
  }

  return updatedRelations;
}

/**
 * Atualiza pontuação de guerra baseado em províncias ocupadas
 */

/**
 * Processa tick diário de diplomacia (pactos expiram, etc)
 */
export function processDiplomacyTick(relations: DiplomaticRelation[]): DiplomaticRelation[] {
  return relations.map(r => {
    // Não modifica relações em guerra - apenas o jogador ou tratado formal pode encerrar
    if (r.status === 'war') {
      return r;
    }
    
    // Pactos de não agressão expiram normalmente
    if (r.pactDaysRemaining > 0) {
      const newDays = r.pactDaysRemaining - 1;
      return {
        ...r,
        pactDaysRemaining: newDays,
        status: newDays > 0 ? 'non_aggression_pact' : 'peace'
      };
    }
    return r;
  });
}
