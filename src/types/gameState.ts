// src/types/gameState.ts - Conceito central do jogo
// Não reescreve nada ainda, só define onde cada dado pertence

import type { Province, Country, GameDate, Army, Recruitment, BuildingConstruction, ActiveBattle } from './index';
import type { CountryTechState } from './technology';
import type { DiplomaticRelation, War } from './diplomacy';

/**
 * GameState V1 - Mapa mental do jogo
 * Hoje usa os mesmos dados do App.tsx, mas já agrupado por domínio
 */
export interface GameState {
  date: GameDate;

  world: {
    provinces: Province[];
    countries: Country[];
  };

  military: {
    armies: Army[];
    wars: War[];
    activeBattles: ActiveBattle[];
    recruitments: Recruitment[];
  };

  diplomacy: {
    relations: DiplomaticRelation[];
  };

  economy: {
    constructions: BuildingConstruction[];
    // FUTURO:
    // resources: ResourceState;
    // production: ProductionState;
    // market: MarketState;
    // trade: TradeState;
  };

  technology: {
    player: CountryTechState;
    bots: Map<string, CountryTechState>;
  };

  // FUTURO - já deixando mapeado:
  // society?: {
  //   population: PopulationState;
  //   satisfaction: number;
  //   unemployment: number;
  // };

  // politics?: {
  //   parties: Party[];
  //   government: GovernmentType;
  //   laws: Law[];
  //   legitimacy: number;
  // };
}

// Helper pra criar GameState inicial a partir dos dados que você já tem
export function createInitialGameState(params: {
  date: GameDate;
  provinces: Province[];
  countries: Country[];
  armies: Army[];
  wars: War[];
  activeBattles: ActiveBattle[];
  recruitments: Recruitment[];
  relations: DiplomaticRelation[];
  constructions: BuildingConstruction[];
  playerTech: CountryTechState;
  botTechs: Map<string, CountryTechState>;
}): GameState {
  return {
    date: params.date,
    world: {
      provinces: params.provinces,
      countries: params.countries,
    },
    military: {
      armies: params.armies,
      wars: params.wars,
      activeBattles: params.activeBattles,
      recruitments: params.recruitments,
    },
    diplomacy: {
      relations: params.relations,
    },
    economy: {
      constructions: params.constructions,
    },
    technology: {
      player: params.playerTech,
      bots: params.botTechs,
    },
  };
}

// O Save V2 é basicamente GameState + metadados
// Isso vai te salvar muito depois
export type GameStateSnapshot = GameState & {
  version: 2;
  id: string;
  name: string;
  timestamp: number;
};