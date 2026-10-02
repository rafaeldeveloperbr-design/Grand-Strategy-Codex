import type { Province } from './province'
import type { Country } from './country'
import type { GameDate } from './date'




/**
 * Estado global do jogo
 */
export interface GameState {
  /** Mapa de todas as províncias */
  provinces: Map<string, Province>;
  /** Lista de todos os países */
  countries: Country[];
  /** Tag do país do jogador */
  playerCountry: string;
  /** Data/turno atual */
  date: GameDate;
  /** Província atualmente selecionada */
  selectedProvince: string | null;
  /** Província sob o cursor */
  hoveredProvince: string | null;
  /** Velocidade do jogo (0 = pausado, 1-5 = velocidades) */
  gameSpeed: number;
}
