/**
 * ORDEM OFICIAL DO GAME LOOP
 * ---------------------------
 * Isso aqui é a lei. Se mudar a ordem, documenta o porquê.
 * 
 * Regra de ouro: Um sistema só pode depender de sistemas que já rodaram neste tick.
 * Ex: Combate depende de Movimento (exército tem que chegar antes de lutar)
 * Air V1: airAI follows navalAI, reuses its FULL activation snapshot.
 * After navalCombat: airCombat -> airMissions (rebase, upkeep, recovery, bombing).
 * Existing battleArrival -> battleContinuous then consume post-air-combat support.
 * Cleanup evacuates captured airbases before publication and autosave.
 */

export type GameTickPhase = 
  | 'production'      // 1. Gera recursos das províncias
  | 'economy'         // 2. Constrói prédios, consome recursos
  | 'population'      // 3. Cresce/morre, migra (FUTURO)
  | 'politics'        // 3b. Tick nacional mensal antes do unrest; depende da economia/população
  | 'stability'       // 4. Calcula unrest/satisfação (unrestTick)
  | 'diplomacy'       // 5. Relações, tech diplomática (diplomacyTechTick)
  | 'technology'      // 6. Pesquisa (dentro de diplomacyTechTick hoje)
  | 'ai'              // 7. IA decide o que fazer (aiTick) - precisa de economia/diplomacia prontas
  | 'movement'        // 8. Exércitos andam (movementTick)
  | 'combat_arrival'  // 9a. Verifica se chegou pra batalha (battleArrivalTick)
  | 'combat'          // 9b. Resolve batalha contínua (battleContinuousTick)
  | 'rebellion'       // 10. Checa revoltas (rebelTick)
  | 'events';         // 11. Dispara eventos aleatórios (FUTURO)

/**
 * Ordem conceitual - NÃO É só estética, é dependência lógica
 * 
 * 1. PRODUCTION   -> De onde vem o dinheiro/comida? Sem isso economia quebra
 * 2. ECONOMY     -> economyTick - gasta o que production gerou
 * 3. POPULATION  -> (futuro) - precisa de comida/economia pra calcular
 * 4. STABILITY   -> unrestTick - precisa de população/economia pra saber se povo tá puto
 * 5. DIPLOMACY   -> diplomacyTechTick - relações mudam com estabilidade
 * 6. TECHNOLOGY  -> diplomacyTechTick - tech avança com dinheiro de economy
 * 7. AI         -> aiTick - IA precisa ver TUDO acima pra tomar decisão inteligente
 * 8. MOVEMENT    -> movementTick - IA já decidiu pra onde mover
 * 9. COMBAT      -> battleArrivalTick + battleContinuousTick - só luta depois de mover
 * 10. REBELLION  -> rebelTick - rebelião só depois de calcular stability + combate
 * 11. EVENTS     -> (futuro) - evento pode depender de tudo
 */
export const GAME_LOOP_ORDER: GameTickPhase[] = [
  'production',
  'economy',
  'population',
  'politics',
  'stability',
  'diplomacy',
  'technology',
  'ai',
  'movement',
  'combat_arrival',
  'combat',
  'rebellion',
  'events',
];

/**
 * Mapeamento do seu código atual pra ordem oficial
 * Isso te ajuda a ver o que falta implementar
 */
export const CURRENT_TICK_MAP: Record<string, GameTickPhase> = {
  // production - NÃO EXISTE AINDA, hoje tá dentro de economyTick
  economyTick: 'economy',
  // population - NÃO EXISTE
  unrestTick: 'stability',
  diplomacyTechTick: 'diplomacy', // também faz technology hoje, precisa separar depois
  aiTick: 'ai',
  movementTick: 'movement',
  battleArrivalTick: 'combat_arrival',
  battleContinuousTick: 'combat',
  rebelTick: 'rebellion',
  // events - NÃO EXISTE
};

/**
 * Como usar no useGameLoop:
 * 
 * function runGameTick(date, gameState, setters) {
 *   // 1. Production (futuro)
 *   // 2. Economy
 *   economyTick(gameState, setters);
 *   // 4. Stability
 *   unrestTick(gameState, setters);
 *   // 5+6. Diplomacy + Tech
 *   diplomacyTechTick(gameState, setters);
 *   // 7. AI
 *   aiTick(gameState, setters);
 *   // 8. Movement
 *   movementTick(gameState, setters);
 *   // 9. Combat
 *   battleArrivalTick(gameState, setters);
 *   battleContinuousTick(gameState, setters);
 *   // 10. Rebellion
 *   rebelTick(gameState, setters);
 * }
 */
