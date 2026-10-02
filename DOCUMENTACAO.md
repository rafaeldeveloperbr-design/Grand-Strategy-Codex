# Documentação técnica — Grand-Strategy

> Documento de manutenção baseado no estado do código em **2 de outubro de 2026**. Ele descreve o que o jogo faz hoje, inclusive inconsistências; os arquivos de ideias não foram tratados como funcionalidades existentes.

## Leitura rápida

- Aplicação React 18 + TypeScript, executada por Vite, sem backend e sem store externa.
- `src/App.tsx` é o *composition root*: cria quase todo o estado persistente da partida, conecta hooks, loop e componentes.
- O jogo é diário. Um `setInterval` converte a velocidade 1–5 em ticks de 1000/500/250/125/60 ms; velocidade 0 ou modal que pause o jogo interrompe o intervalo.
- O estado autoritativo fica em `useState` no `App`; `useGameRefs` mantém espelhos em refs para o callback do intervalo não trabalhar com *closures* antigas.
- A simulação é majoritariamente funcional: cada fase recebe arrays, retorna novos arrays e `useGameLoop` consolida tudo no fim do dia.
- O mapa contém 21 províncias, 6 países e 6 exércitos iniciais. Há 8 construções, 7 unidades, 17 tecnologias e 13 focos declarados nos dados.
- Persistência é local: `localStorage`, save V2 versionado e migração de V1.

---

# 1. Visão geral da arquitetura

```text
index.html (tema antes do React)
  └─ src/main.tsx
      └─ <AppWithProviders>
          ├─ ToastProvider / AILogProvider
          └─ App.tsx                          estado React + composição
              ├─ hooks/app/*                  comandos da interface
              ├─ components/*                 apresentação e eventos do usuário
              ├─ useGameRefs                  espelho síncrono do estado
              └─ useGameLoop                  relógio e orquestração diária
                  ├─ hooks/gameLoop/*          adaptadores de cada fase
                  └─ engine/*                  regras puras/de domínio
                      ├─ data/*                catálogo e mapa inicial
                      ├─ constants/*           leis/balanceamento declarativo
                      └─ types/*               contratos compartilhados
```

## Divisão de responsabilidades real

| Camada | Responsabilidade atual | Observação |
|---|---|---|
| Interface | `src/components/`, `src/styles/`, `src/context/` | Componentes recebem estado e callbacks; contextos guardam somente notificações/log da IA. |
| Estado da partida | `src/App.tsx` | Vários `useState`, não uma instância única de `GameState`. |
| Comandos do jogador | `src/hooks/app/` | Seleção, movimento, economia, diplomacia, tecnologia, leis, cheats, modais e save/load. |
| Relógio/orquestração | `src/hooks/useGameLoop.ts`, `src/hooks/gameLoop/` | Faz snapshot das refs, executa fases em ordem e publica os resultados. |
| Regras | `src/engine/` | Economia, construções, exército, combate, diplomacia, tecnologia, estabilidade, unrest, rebeliões, IA e condições finais. |
| Dados estáticos | `src/data/`, `src/constants/laws.ts` | Países, geometria/vizinhança das províncias, unidades, edifícios, árvores de foco/tecnologia e leis. |
| Tipos | `src/types/` | Entidades persistidas, UI e contratos de domínio. |

### Fluxo de uma alteração

```text
clique do jogador ──> componente ──> hook app ──> setState
                                                │
próximo render ──> useGameRefs sincroniza refs ─┘
                                                │
setInterval ──> processTick lê refs ──> fases ──> setters + refs atualizados
                                                │
                                                └─> React redesenha UI
```

Não há servidor, API, banco, Redux ou máquina de eventos. O armazenamento durável é o `localStorage` do navegador.

---

# 2. Mapa das pastas

## `src/`

- **`App.tsx`** — estado inicial, seis exércitos, conexão entre UI/hook/engine, render dos painéis e exposição de `window.cheats`.
- **`main.tsx`** — monta a árvore React.
- **`index.css`** — agregador/estilo global; `styles/` separa CSS por sistema visual.

## `src/components/`

- Barra superior (`TopBar`), mapa (`GameMap/`), marcadores de exército/batalha, painel provincial e modais.
- `ProvincePanel/` separa informação, construções e recrutamento.
- `DiplomacyPanel` e `WarPanel` disparam ações diplomáticas.
- `BattleReportModal` e `BattleHistoryModal` consomem resultados consolidados.
- `SettingsModal` lista/cria/carrega/apaga saves e liga autosave.
- `GovernmentModal`, `ResearchModal`, `FocusModal`, `DifficultySelector` expõem leis, tecnologia e dificuldade.
- `CheatPanel`, `NotificationLogModal`, `AILogModal`, `ToastContainer` são ferramentas operacionais/debug.

## `src/components/GameMap/`

- `GameMap.tsx`: SVG raiz, tooltip, composição das camadas e controles.
- `ProvinceLayer.tsx`: paths SVG, cores e eventos por província.
- `ArmyMovementLayer.tsx`: linhas/animação visual de deslocamento.
- `BattleMarkersOverlay.tsx`: marca batalhas ativas.
- `useMapControls.ts`: zoom, pan e reset; é estado apenas visual.

## `src/hooks/app/`

- `useGameSelection`: seleção/hover e abertura de painel/diplomacia.
- `useGameModals`: flags de modais e pausa causada por relatório.
- `useArmyActions`: ordens, rotas, merge, split, recuo manual, parada e “destravar todos”.
- `useEconomyActions`: enfileira/cancela construção e recrutamento, debitando/reembolsando ouro/manpower.
- `useDiplomacyActions`: opinião, pacto, guerra e paz.
- `useTechActions`: foco, pesquisa, dificuldade, lei e velocidade.
- `useSaveSystem`: hidratação do autosave e ações da tela de saves.
- `useCheats`: mutações deliberadas para testes/debug.

## `src/hooks/gameLoop/`

Cada arquivo é uma fase do dia e faz a ponte entre engines independentes: `economyTick`, `unrestTick`, `diplomacyTechTick`, `aiTick`, `movementTick`, `battleArrivalTick`, `battleContinuousTick`, `rebelTick`.

## `src/engine/`

- `economy.ts`, `buildings.ts`: produção diária e filas.
- `military/`: criação, recrutamento, pathfinding, movimento, merge/split.
- `combat/`: detecção, batalha contínua, cálculos, finalização e duas abordagens de recuo/resolução.
- `diplomacy.ts`: relações, pactos e guerras.
- `technology.ts`: foco/pesquisa e cálculo de bônus.
- `stability.ts`, `unrest.ts`: modificadores nacionais e agitação provincial.
- `rebellions/`: acumulação, exército separatista, reconquista e guerras rebeldes.
- `aiEngine/`: decisões econômicas e movimentação dos bots.
- `saveSystem.ts`: esquema, serialização, migração e CRUD local.
- `gameConditions.ts`: vitória/derrota e estatísticas.
- `gameLoop/order.ts`: ordem conceitual/documental; não executa o loop.
- `__tests__/`: 43 testes de engine distribuídos em 7 suítes.

## `src/data/`, `src/constants/`, `src/types/`, `src/utils/`

- `data/provinces.ts` contém geometria SVG, vizinhos e valores econômicos das 21 províncias.
- `data/countries.ts` contém 6 países e recursos iniciais.
- `data/units.ts` e `data/buildings.ts` são catálogos e fórmulas de custo/tempo.
- `data/technology/` separa focos e tecnologias por categoria.
- `constants/laws.ts` declara leis, custos e bônus.
- `types/` define `Province`, `Country`, `Army`, `Regiment`, `ActiveBattle`, `War`, saves implícitos etc.
- `utils/translations.ts` centraliza nomes amigáveis; `formatters.ts` formata tamanho militar.

## Fora de `src/`

- `package.json`, `vite.config.js`, `tsconfig.json`, `eslint.config.js`: execução, build, testes e validação.
- `features-ideas/*.txt`: planejamento; não prova implementação.
- `tools/*.py`: análise estática auxiliar; não participa do jogo.
- `README.md`: apresentação existente e intencionalmente não modificada.

---

# 3. Sistemas do jogo

## 3.1 Mapa e províncias

**Hoje.** `provincesData` inicia as províncias; `App` clona `buildings`, adiciona `unrest: 0` e registra `originalOwner`. `GameMap` desenha o SVG, exércitos, movimentos e batalhas. `neighbors` forma o grafo usado por pathfinding, IA, recuo e separatismo.

**Fluxo:**

```text
provincesData ──> App.provinces
                    ├─> GameMap/ProvinceLayer (render/clique/hover)
                    ├─> economia/população/unrest
                    ├─> findPath e IA
                    └─> combate/conquista ──> troca owner/originalOwner
```

Arquivos centrais: `data/provinces.ts`, `types/province.ts`, `components/GameMap/*`, `ProvincePanel/*`. Conquistas atualizam tanto `Province.owner` quanto `Country.provinces`; atividades locais são canceladas. A chegada sem inimigo pode ocupar território sem batalha, inclusive no ramo chamado “ocupação pacífica”. Não há terreno efetivo no tipo `Province`; o combate procura campos opcionais (`terrain`, `fortLevel`) que os dados atuais não declaram.

## 3.2 Países, governo e leis

`countries.ts` cria recursos, economia e províncias; o jogador é fixo como `IMP`. `Country.activeLaws` referencia IDs de `constants/laws.ts`. `GovernmentModal` chama `handleEnactLaw`, que cobra ouro e substitui a lei da categoria. Economia consulta conscrição, tributação e governança; recrutamento do jogador consulta custo militar da conscrição. Categorias `economy` e `intelligence` existem no estado/UI, mas não aparecem aplicadas nas engines observadas.

Um país sem províncias (exceto o jogador) recebe `isAnnexed`, sai de guerras e perde relações em `unrestTick`. Vitória/derrota é verificada em `rebelTick` por `gameConditions.ts`.

## 3.3 Exércitos e regimentos

`Army` agrega `Regiment[]`; tamanho é soma de `strength`, poder considera tipo e moral. O App fornece seis exércitos iniciais. `militaryUtils` cria IDs/regimentos/exércitos, calcula velocidade pelo regimento mais lento, agrupa aliados e desloca marcadores sobrepostos.

`useArmyActions` é a fachada do jogador:

- botão direito calcula/atribui rota;
- merge usa `mergeArmies` quando aliado está no mesmo local;
- split por metade ou seleção usa helpers da engine;
- stop limpa destino/rota;
- recuo manual delega a `retreatArmyManually`;
- “unstuck” limpa flags/rotas de todos os exércitos.

Bots no mesmo `owner + location` são fundidos automaticamente em `aiTick`. Exércitos vazios são removidos ao finalizar combate.

## 3.4 Recrutamento

```text
ProvinceMilitaryTab
  └─ handleRecruit
      ├─ getRecruitmentCost + lei de conscrição
      ├─ debita ouro e manpower imediatamente
      └─ cria/agrega Recruitment
          └─ economyTick diário
              └─ processRecruitments decrementa dias
                  └─ cria/engrossa Army na província
```

`Recruitment` guarda dono, província, tipo, dias e quantidade. Cancelamento usa `cancelRecruitment` e reembolsa ouro; a conclusão cria regimentos de 1000 homens. A IA usa caminho paralelo em `aiEconomy.ts`, escolhendo província/unidade aleatórias e respeitando um teto militar relativo às tropas do jogador. `recruitmentSpeedMultiplier`, calculado da estabilidade em `economy.ts`, não chega a `processRecruitments`; bônus de quartel/tecnologia de tempo também não estão conectados ao contador da fila.

## 3.5 Movimentação

`findPath` faz busca no grafo e restringe passagem pelo dono/relação; `moveArmy` configura `destination` imediato, `targetDestination`, `path`, progresso e velocidade. `processArmyMovement` soma progresso diário, remove temporariamente os que chegam da lista principal e devolve `arrivedArmies`; o tick seguinte de chegada reinsere-os, ocupa ou inicia combate. Ao completar uma etapa, continua pelo próximo nó.

```text
ordem UI/IA ─> findPath ─> Army.path/destination
                         └─> movementTick/processArmyMovement
                                  ├─ ainda viajando: movementProgress
                                  └─ chegou: arrivedArmies
                                           └─ battleArrivalTick
```

O acesso pode ocorrer em território próprio, em guerra ou conforme regras de relação. `position` é visual; a localização lógica fica em `location`/`destination`.

## 3.6 Combate e batalhas contínuas

Resumo aqui; a análise profunda está na seção 5. A implementação ativa é:

```text
movementTick.arrivedArmies
  └─ battleArrivalTick reinsere/ocupa
      └─ checkAllProvinceCombats
          ├─ startContinuousBattle
          └─ addReinforcementsToBattle
              └─ a cada dia: processDailyBattle
                  └─ ao terminar: finalizeBattle OU ramo especial de recuo
                      ├─ baixas/remoção/relocalização
                      ├─ conquista + unrest + cancelamento de filas
                      ├─ prestígio
                      └─ histórico/modal
```

`battleResolver.resolveBattle` é a alternativa instantânea/antiga e não é chamado pelo runtime.

## 3.7 Recuo, retirada, cerco e conquista

Há duas rotas de recuo:

1. `processDailyBattle` procura província vizinha do perdedor quando ele termina com até 1500 homens; se acha, move o exército e produz `retreatInfo`; se não acha, zera seus regimentos.
2. Ação do jogador chama `combatRetreats.retreatArmyManually`, que procura vizinho próprio e remove o exército da batalha.

Na finalização sem `retreatInfo`, `finalizeBattle` escolhe vencedor pelo total restante. Razão ≥10 e perdedor ≤2000 é *stackwipe*. Fora disso, conserva globalmente no máximo 1000 homens do lado perdedor e os envia à capital/primeira província. Isso funciona como aniquilação/relocalização, não como sistema temporal de cerco.

Conquista ocorre quando atacante vence e não há defensor restante: muda dono, guarda dono original, aplica unrest 50 (salvo libertação rebelde), corrige listas dos países e cancela construção/recrutamento. Não existe barra/tick separado de cerco; fortificação entra apenas como defesa/bônus potencial.

## 3.8 Guerras e diplomacia

`useDiplomacyActions` chama `improveRelations`, `offerNonAggressionPact`, `declareWar` e `makePeace`. A engine cria ou localiza relação simétrica, cobra custos no hook/resultado, impede guerra sob pacto e mantém arrays `relations` e `wars`. `processDiplomacyTick` reduz diariamente `pactDaysRemaining`; relações em guerra permanecem até paz formal/anexação.

`diplomacyTechTick` recalcula `warScore` diariamente como:

```text
quantidade atual de províncias do atacante - quantidade atual do defensor
```

Os campos de baixas e províncias ocupadas de `War` não são atualizados pelo combate atual. Rebeldes criam guerras de reconquista por `ensureSeparatistWars`; `cleanupSeparatistWars` encerra/pacifica quando cabível.

## 3.9 Economia

Detalhada na seção 6. Em cada dia, recrutamentos e construções avançam antes de `processDailyTick` para cada país. População, renda, manpower, manutenção, estabilidade e indicadores `Country.economy` são recalculados. Gastos de pesquisa/construção/recrutamento são cobrados ao iniciar, não registrados em `goldExpense`.

## 3.10 Construções

`BUILDING_DEFINITIONS` declara oito tipos, custo exponencial por nível, tempo e bônus. `handleBuild` valida propriedade e ouro, e `queueBuilding` registra `BuildingConstruction`. Só a primeira obra de cada província avança por dia; conclusão, em `economyTick`, incrementa nível ou adiciona `Building`. Cancelamento ativo reembolsa proporcionalmente (mínimo 10%); item aguardando reembolsa 100%.

Há dois mecanismos relacionados a tempo: a fila externa reduz exatamente 1/dia em `processConstructions`, enquanto `processDailyTick` também reduz `daysRemaining` de `province.buildings`; como edifícios concluídos normalmente têm zero, este segundo caminho não acelera a fila externa. `buildTimeMultiplier` portanto não afeta efetivamente `BuildingConstruction`.

## 3.11 Tecnologia e focos

Estados são isolados: `playerTechState` e `Map<tag, CountryTechState>` para bots. UI chama `startNationalFocus`/`startTechnologyResearch`; pesquisa cobra o custo total no início. `processDailyTechProgress` soma 1 dia para jogador e aplica multiplicador de dificuldade somente aos bots. Pesquisa ainda verifica diariamente se existe ouro equivalente a `costGold/durationDays`, mas não o debita.

`calculateTechBonuses` acumula combate, renda, custo/tempo de construção e manpower. Ele é testado, porém não é chamado pelo game loop; `processDailyTick` não recebe bônus e o combate contínuo ignora `techBonusesByCountry`. Assim, conclusão e UI funcionam, mas a maior parte das recompensas não altera a simulação atual.

## 3.12 Estabilidade, prestígio e unrest

- Estabilidade nacional oferece multiplicadores por faixas e recupera +0,1/dia abaixo de 50, mas abaixo de 20 a regra líquida vira -0,1/dia.
- Economia usa modificadores de ouro/manpower/construção; só os dois primeiros têm efeito claro hoje.
- Vitória em batalha dá +2 prestígio; derrota, -3. Não há mudança de estabilidade nesse evento.
- Província conquistada recebe unrest 50. Com unrest >0, cresce +0,3/dia; templo reduz 0,5 por nível e guarnição reduz 0,3. Ao atingir 100, volta a 30 e entra na criação rebelde.
- Unrest reduz até 50% ouro, 30% manpower e 40% crescimento.

## 3.13 Rebeldes

```text
unrestTick: unrest chega a 100
  └─ processRebelAccumulation
      ├─ cria/reforça rebel_<originalOwner>
      └─ ao limiar (5000): separatistMode
          └─ processSeparatistAI
              ├─ funde rebeldes
              ├─ busca território histórico/caminho de volta
              └─ movimenta
                  ├─ rebelTick cria batalha pendente
                  ├─ ensureSeparatistWars cria reconquista
                  └─ vitória devolve província ao originalOwner
```

`movementTick` contém correção defensiva: se uma província ficou com owner `rebel_*`, devolve ao `originalOwner`. `cleanupSeparatistWars` encerra conflito e pacifica. O sistema usa tags sintéticas, não cria `Country` rebelde persistente.

## 3.14 IA

Detalhada na seção 7. Bots escolhem foco/tecnologia, constroem, recrutam, movimentam, caçam/recuam em guerra, guarnecem fronteiras e fundem exércitos. Não há planejamento diplomático normal da IA neste fluxo; guerras separatistas são automáticas.

## 3.15 Condições finais

`checkEndGameConditions` roda ao fim do tick. O jogo pausa e mostra `EndGameModal`; estatísticas derivam datas, histórico de batalhas e províncias. “Continuar” marca o fim como já disparado e religa velocidade; “reiniciar” navega com `?newgame=1`, fazendo `useSaveSystem` ignorar o autosave nessa carga.

## 3.16 Cheats e debug

`useCheats` oferece ouro, manpower, estabilidade, conclusão de filas, criação/remoção de tropas, conquista selecionada e controle de data/velocidade. `App` publica a API em `window.cheats` e `window.cheatPanelOpen`; `CheatPanel` é a UI. Há ainda console logs extensos, histórico global de notificações e log filtrável da IA. Os cheats alteram estado diretamente e não são regras normais.

---

# 4. Game loop

## Onde começa

`App` chama `useGameRefs(...)` e depois `useGameLoop(...)`. O hook instala um `setInterval` sempre que `gameSpeed > 0` e `isPaused === false`; troca de velocidade limpa e recria o intervalo. O calendário tem sempre 30 dias por mês e 12 meses por ano.

## Refs importantes

`useGameRefs` mantém refs para províncias, países, exércitos, recrutamentos, guerras, relações, data, construções, tecnologia do jogador/bots, dificuldade e batalhas. Também guarda:

- `gameLoopRef`: ID do intervalo;
- `ceilingLogRef`: tags já observadas no teto militar da IA.

Refs evitam valores obsoletos dentro de `processTick`. Ao fim, o loop escreve setters **e** refs. Estados apenas de UI continuam fora do snapshot.

## Ordem executada por dia

```text
setInterval
  │
  ├─ snapshot das refs + cópias locais
  │
  ├─ 1. processEconomyTick
  │     recrutamento → construção → economia/população/estabilidade
  ├─ 2. processUnrestTick
  │     unrest/revolta → IA separatista → anexações
  ├─ 3. processDiplomacyTechTick
  │     expiração de pactos → foco/pesquisa → war score
  ├─ 4. processAiTick
  │     economia/tech/foco bot → movimento → merge → separatistas
  ├─ 5. processMovementTick
  │     progresso/chegada → correção de libertação rebelde
  ├─ 6. processBattleArrival
  │     reinserção/ocupação → detecção → batalha/reforços
  ├─ 7. processBattleContinuous
  │     baixas diárias → finalização/recuo → conquista/histórico
  ├─ 8. processRebelTick
  │     batalha rebelde pendente → guerras separatistas → fim de jogo
  │
  ├─ publica todos os setters e atualiza refs
  ├─ avança data em um dia
  └─ se dateRef.current.day === 1: autosave
```

### Correspondência com `engine/gameLoop/order.ts`

O arquivo declara 11 fases conceituais, mas não é importado para controlar execução. `production` está embutida na economia; `population` também; diplomacia e tecnologia compartilham tick; `events` não existe. A ordem efetiva acima é a de `useGameLoop`, com 8 chamadas.

### Nuances de atualização

- O snapshot de data é a data do dia processado; `setDate` agenda o dia seguinte no fim.
- O autosave consulta `dateRef.current.day` depois dos setters, mas a ref da data não é atualizada manualmente no mesmo tick. Portanto salva quando o **dia processado** já era 1 e guarda essa data, não necessariamente a nova data React.
- `battleHistory` e `hasTriggeredEndGame` chegam por closure/props e não por refs; as dependências deliberadamente suprimidas do `useCallback` merecem atenção para valores obsoletos.
- Relatório de batalha chama `setIsPaused(true)`, fazendo o effect remover o intervalo.
- Fases podem chamar setters intermediários (`setActiveBattles`, `setArmies`), mas o commit completo acontece no final.

---

# 5. Combate — implementação e fluxo profundo

## Papéis dos arquivos

| Arquivo | Papel |
|---|---|
| `combatCalculations.ts` | soma/poder, defesa, duração e distribuição de perdas; usado por caminhos ativo e alternativo. |
| `continuousBattle.ts` | detector provincial, criação, reforços e perdas diárias; núcleo ativo. |
| `battleFinalizer.ts` | vencedor, *stackwipe*, sobreviventes, limpeza de flags e `CombatResult`; ativo. |
| `battleArrivalTick.ts` | integra chegada/ocupação e invoca detector; ativo. |
| `battleContinuousTick.ts` | orquestra cada batalha, conquista, histórico, modal e prestígio; ativo. |
| `combatRetreats.ts` | busca/aniquilação e recuo manual; só o recuo manual está conectado pela UI. |
| `battleResolver.ts` | resolvedor completo instantâneo; exportado/testável, mas não chamado pelo jogo atual. |

## Início e reforços

`checkAllProvinceCombats` percorre províncias. Se já há batalha, todo exército livre do país atacante/defensor (ou em guerra com o defensor) vira reforço, recebe `inCombat`, entra em `participantArmyIds`, e sua entrada/tamanho são registrados. Sem batalha, exige pelo menos dois países, um defensor igual ao dono provincial e um atacante formalmente em guerra.

`startContinuousBattle` escolhe o primeiro exército de cada lado como representante e soma todos. Duração usa o menor lado: ≤1000 = 1 dia; ≤2500 = 3; acima disso `max(2, floor(menor/1500))`. Snapshots iniciais só cobrem os representantes; reforços têm metadados separados.

## Perdas diárias

`processDailyBattle`:

- decrementa um dia;
- bônus de defesa começa em 5%, tenta ler forte/terreno/construções alternativas e limita a 50%;
- perda atacante = `defenderInitialTroops * (1 + bonus) / daysTotal`;
- perda defensor = `defenderInitialTroops / daysTotal * 0,95`;
- aplica essas perdas somente aos dois representantes;
- `battleContinuousTick` aplica ainda 2%/4% diário aos outros participantes conforme quão recentes são;
- termina por prazo ou lado ≤50.

Notável: a fórmula de perda do defensor também parte do tamanho **inicial do defensor**, não do atacante. Poder, moral, multiplicadores por unidade, tecnologia e `wars` não entram nessa rotina ativa.

## Recuo e finalização

Se ao terminar o perdedor tem 1–1500, a rotina tenta vizinho próprio; sucesso gera `retreatInfo` e segue ramo especial no tick. Sem rota, aniquila o representante. Se não há recuo, `finalizeBattle` calcula totais atuais dos participantes, escolhe lado maior e aplica perdas extras de 5%/10% quando aplicável. Depois:

- vencedores ficam na província, livres de combate;
- lado perdedor é reduzido coletivamente a no máximo 1000 ou zero no *stackwipe*;
- sobreviventes vão para capital, `capitalId`, primeira província do país ou a própria província;
- é criado `CombatResult`, enriquecido com detalhes dos participantes;
- conquista e unrest são aplicados se atacante venceu e nenhum defensor sobrou;
- jogadores envolvidos recebem modal e pausa; todos entram no histórico;
- prestígio muda.

## Implementação alternativa/desconectada

`resolveBattle` usa poder de unidade, moral, bônus territorial/fortificação, tecnologia, `calculateWinnerLosses`/`calculateLoserLosses` e resolve tudo de uma vez. Nenhum import fora do barrel/testes chama essa função. Dentro dela, `hasEscapeRoute` sempre retorna `false`, seu resultado não é usado e `applySiegeAnnihilation` só é importado. Logo, seus comentários não descrevem o combate efetivamente jogado.

`combatRetreats` contém `findRetreatProvince` e `applySiegeAnnihilation`, mas o contínuo possui outra função privada de mesmo propósito. `retreatArmyManually` está conectado; seu `remainingAttackerArmies` é calculado e ignorado, e o fim só ocorre se `participantArmyIds.length === 0`, não quando um dos lados zera. `continuousBattle.triggerRetreat` também não é chamado e usa owner como se fosse ID de província.

---

# 6. Economia

## Origem e destino dos valores

```text
Province.population + development
  ├─ calculateProvinceGoldIncome
  │    + bônus de market/workshop/etc declarados
  │    × tributação × estabilidade × unrest
  ├─ calculateProvinceManpowerGain
  │    + bônus de edifício
  │    × conscrição × estabilidade × unrest
  └─ calculatePopulationGrowth
       × lei/unrest, limitado por maxPopulation

Country.gold += renda - manutenção
Country.manpower += ganho (limitado por maxManpower)
```

- Ouro base: `(população / 1000) × 0,08 × (1 + (desenvolvimento - 1) × 0,15)` mais bônus de edifícios.
- Manpower diário: `(população / 1000) × 0,02` mais bônus.
- Máximo: 30% da população total atualizada.
- Manutenção: 0,5 por entrada em `country.provinces` + 0,3 por edifício nas províncias fornecidas.
- Ouro nunca fica negativo; manpower é arredondado para baixo.
- `Country.economy` registra renda, manutenção e ganho diário; `manpowerExpense` fica sempre zero.

## Gastos pontuais

- Construção: custo por tipo/nível, debitado ao enfileirar.
- Recrutamento: ouro (modificado por lei) e manpower, debitados ao enfileirar.
- Pesquisa: custo integral debitado ao iniciar.
- Lei/diplomacia: custos debitados na ação correspondente.
- Cancelamentos de fila reembolsam ouro; recrutamento não devolve manpower.

Esses gastos não alimentam `goldExpense`. Não existe mercado, comércio ou estoque de bens. A “produção” é diretamente a renda provincial dentro do tick econômico.

## Inconsistências relevantes

- Tecnologia calcula multiplicadores econômicos, mas o loop chama `processDailyTick` sem eles.
- `buildTimeMultiplier` e `recruitmentSpeedMultiplier` são calculados; as filas externas diminuem 1 fixo/dia.
- Definições de edifício oferecem bônus como defesa, recrutamento, pesquisa e estabilidade, mas a engine econômica consome explicitamente apenas `goldIncome`, `manpowerGain` e `growthBonus`; templo é usado no unrest.
- IA e jogador implementam enfileiramento em caminhos distintos, embora compartilhem os catálogos.

---

# 7. IA

## Conexão no loop

`processAiTick` roda após economia, unrest, diplomacia e tecnologia e antes de movimento. Para cada país exceto `IMP`:

```text
estado atualizado do mundo
  └─ processAiTick
      ├─ teto militar = max(12.000, tropas jogador × 2 ou × 3 em guerra)
      ├─ processAIEconomicDecisions
      │    foco → tecnologia → construção aleatória → recrutamento aleatório
      ├─ processAI (militar)
      │    caça se mais forte / recua se mais fraco
      │    invade vizinho em guerra
      │    senão vai à fronteira ou circula em casa
      ├─ fusão automática no mesmo local
      └─ processSeparatistAI
```

## Decisões disponíveis

- Primeiro foco/tecnologia disponível conforme ordem dos arrays e pré-requisitos.
- Pesquisa apenas se puder pagar; custo é debitado.
- Com ≥300 ouro, tenta prédio aleatório em província aleatória sem obra ativa.
- Com ≥250 ouro e ≥1000 manpower, tenta unidade aleatória se abaixo do teto.
- Em guerra, localiza inimigo mais próximo via BFS: persegue se seu poder é maior/igual, senão busca província própria próxima (fronteiras recebem peso 0,8).
- Fora de guerra, estaciona em fronteira ou move entre vizinhos próprios.
- Logs de foco, pesquisa, prédio, recrutamento e movimento entram no `AILogContext`.

## Limites atuais

`aiDifficulty` acelera foco/pesquisa em `processDailyTechProgress`; apesar de ser passado a `aiTick`, não modifica ali economia, recrutamento ou estratégia. IA normal não melhora relações, assina pactos, declara guerra nem faz paz. Escolhas econômicas são simples/aleatórias e podem ocorrer diariamente. O alvo bloqueado (`targetArmyId`/`targetProvinceId`) existe no tipo, mas a movimentação apresentada recalcula e normalmente não o utiliza como plano persistente.

---

# 8. Estado do jogo

| Estado em `App` | Tipo | Quem altera principalmente |
|---|---|---|
| `date` | `GameDate` | loop, load, cheats |
| `gameSpeed` | number 0–5 | TopBar/tech actions, cheats, continue |
| `provinces` | `Province[]` | economia, movimento, combate, rebelião, load/cheats |
| `allCountries` | `Country[]` | economia, ações, combate, IA, load/cheats |
| `armies` | `Army[]` | recrutamento, movimento, combate, IA, ações/cheats |
| `recruitments` | `Recruitment[]` | ações, economia, IA, conquista/load |
| `buildingConstructions` | `BuildingConstruction[]` | ações, economia, IA, conquista/load |
| `diplomaticRelations` | `DiplomaticRelation[]` | ações, tick diplomático, rebeldes/load |
| `wars` | `War[]` | ações, war score, rebeldes, anexação/load |
| `playerTechState` | `CountryTechState` | ações, progresso diário, load |
| `botTechStates` | `Map` | progresso/decisões da IA, load |
| `activeBattles` | `ActiveBattle[]` | chegada, combate, rebelTick, load |
| `battleHistory` | `CombatResult[]` | finalização; não é salvo |
| `aiDifficulty` | `AIDifficulty` | seletor; não é salvo |
| fim de jogo/stats | tipos de `gameConditions` | rebelTick/App; não são salvos |

Seleção, painéis, split e pausa vivem nos hooks de UI e também não são persistidos. Toasts/logs da IA vivem nos contextos.

Há dois tipos chamados `GameState`: `types/game.ts` é um modelo antigo/plano com mapa e seleção; `types/gameState.ts` agrupa domínios como o Save V2 e oferece `createInitialGameState`, mas o App não usa nenhum dos dois como store. O runtime continua em estados separados.

---

# 9. Save / load

## Estrutura V2

```text
SaveGameV2
├─ version, id, name, timestamp, date
├─ world: provinces, countries
├─ military: armies, wars, activeBattles, recruitments
├─ diplomacy: relations
├─ economy: constructions
└─ technology: player, bots
```

`bots` é um `Map`, convertido em array de pares ao serializar e restaurado ao ler. A chave no navegador é `imperium_save_<slotId>`. A preferência usa `imperium_autosave_enabled` e é verdadeira por padrão.

## Gravação e leitura

- `saveGame` lê exclusivamente refs, cria V2 e faz `JSON.stringify`/`localStorage.setItem`.
- Manual: `useSaveSystem.handleManualSave` usa timestamp como slot e nome do usuário.
- Autosave: `useGameLoop` chama slot `autosave` quando o dia observado é 1.
- Inicialização: `useSaveSystem` tenta carregar `autosave` uma vez; `?newgame=1` impede e limpa o parâmetro.
- Load manual/autoload aplicam todos os campos V2 via setters.
- `listSaves` varre todo o `localStorage`, filtra o prefixo, extrai metadados e ordena por timestamp.
- Delete remove uma chave; `clearAllSaves` existe, mas não é usado pela UI/App.

## Compatibilidade e validação

`parseRawSave` cruza a fronteira como `unknown`, reconhece V1 pelo formato e migra o layout plano para V2. Os type guards são mínimos: V2 verifica versão/data/`world`, não valida profundamente cada domínio. JSON inválido ou formato desconhecido retorna `null` com log.

## O que não é salvo

Velocidade/pausa, dificuldade, histórico/relatório de batalhas, fim de jogo/stats, seleção/modais, notificações/log da IA e flags do painel de cheat. Ao carregar manualmente, refs dependem do render/effect subsequente para acompanhar os setters; o hook não as atualiza diretamente.

---

# 10. Funcionalidades incompletas / trabalho futuro

## Evidências explícitas

1. `engine/gameLoop/order.ts` marca `production`, `population` e `events` como futuros. Produção e população estão parcialmente embutidas em economia, mas não são fases independentes; eventos não existem.
2. Diplomacia e tecnologia compartilham `diplomacyTechTick`, anotado para separação posterior.
3. `battleResolver.hasEscapeRoute` possui `return false` placeholder; `loser`, `loserOwner` e resultado não são usados.
4. `continuousBattle.triggerRetreat` não é chamado e monta destino a partir de `army.owner`.
5. `combatRetreats.remainingAttackerArmies` é calculado, mas não decide o fim da batalha.
6. `economy.recruitmentSpeedMultiplier` é calculado e ignorado.
7. `techBonusesByCountry` chega a `checkAllProvinceCombats`, mas não é usado; o loop nem o fornece.
8. `calculateTechBonuses` existe e tem testes, porém não alimenta economia/combate/construção no runtime.
9. `gameState.ts` prepara recursos/produção/mercado/comércio, sociedade e política em comentários; não há implementação correspondente.

## Sistemas parcialmente conectados

- Bônus de tecnologias/focos concluem e são armazenados, mas não chegam às engines.
- Vários bônus de edifício/lei existem nos catálogos, mas só um subconjunto é consumido.
- Fortificação real usa `Province.defense` no resolvedor instantâneo; o combate ativo procura `fortLevel`/`fort_level` inexistentes nos dados.
- `War.attackerCasualties`, `defenderCasualties`, `occupiedByAttacker`, `occupiedByDefender` e `daysSinceStart` não são mantidos pelo loop.
- `Army.targetArmyId`/`targetProvinceId` prometem target locking no tipo, mas o caminho principal pouco os usa.
- `Country.economy.manpowerExpense` permanece zero; manutenção de tropas não existe.
- `BuildingConstruction.owner` existe, mas `processConstructions` apenas verifica existência da província; a conquista precisa cancelar externamente.
- Histórico de batalha e dificuldade não sobrevivem ao save.
- `clearAllSaves` é API pronta sem ligação visível à tela.

## Código não utilizado apontado pelo lint

Além dos itens acima: imports diretos de save em `App`, `formatSize` em `ArmyMarker`, `perDayLoss` em `BattleReportModal`, contador de ID em `buildings`, diversos parâmetros/imports de ticks, `allProvinces` em `finalizeBattle` e handlers/setters desestruturados em `useArmyActions`. São sinais de refatoração incompleta, não funcionalidades ativas.

---

# 11. Pontos que merecem investigação

1. **Ocupação sem guerra.** Em `battleArrivalTick`, se não há inimigo e `isInWar` é falso, uma província de outro dono troca de owner (“ocupação pacífica”). Confirmar se movimento até ela é sempre bloqueado em camadas anteriores.
2. **Fórmula do combate contínuo.** As perdas dos dois lados usam `defenderInitialTroops`; poder/moral/tipo não decidem o vencedor diário. Pode divergir muito do resolvedor alternativo e dos textos da UI.
3. **Reforços e lados.** Associação de lados depende do owner dos exércitos representantes; coalizões e terceiro país têm suporte parcial.
4. **Finalização agressiva.** Fora do recuo curto, todo o lado derrotado é reduzido a 1000 homens somados e teletransportado à capital; verificar intenção.
5. **Recuo manual.** O critério `participantArmyIds.length === 0` pode deixar batalha sem um dos lados; `remainingAttackerArmies` sugere que a intenção era outra.
6. **Batalha órfã.** Se representante/província desaparece, `battleContinuousTick` mantém a batalha ativa em vez de limpá-la; `checkAllProvinceCombats` tem outro comportamento.
7. **Data/autosave.** O autosave ocorre antes de a ref de data refletir `setDate`, possivelmente salvando o começo do mês após processá-lo.
8. **Closures do loop.** `processTick` omite muitas dependências e usa `battleHistory`/`hasTriggeredEndGame` por closure; verificar estatísticas e disparo final após muitos renders.
9. **Pesquisa.** O custo total é cobrado no início, mas progresso exige saldo diário sem debitar; saldo baixo congela algo já pago.
10. **Construção duplicada.** `processDailyTick` reduz dias nos edifícios instalados, não na fila; o multiplicador de construção não chega a `BuildingConstruction`.
11. **Max manpower.** O limite usado ao somar ganho é o `country.resources.maxManpower` antigo; o novo máximo só é gravado depois, podendo atrasar expansão em um tick.
12. **IDs incrementais.** Contadores de exército/recrutamento reiniciam ao recarregar a página e não são persistidos; checar colisões com entidades carregadas.
13. **Dois `GameState`.** Interfaces homônimas e divergentes podem induzir uso/import errado.
14. **Type guards de save rasos.** Um V2 parcialmente corrompido pode passar e falhar somente ao hidratar/renderizar.
15. **Anexação do jogador.** O tick exclui o jogador da marcação `isAnnexed`; a derrota deve depender exclusivamente de `checkEndGameConditions`.
16. **Prestígio versus guerra.** Resultados não acumulam baixas/ocupação em `War`, de modo que UI/score podem não representar combate.

---

# 12. Índice de arquivos importantes

| Arquivo | Responsabilidade | Sistema |
|---|---|---|
| `src/App.tsx` | composição, estado e mundo inicial | arquitetura/estado |
| `src/hooks/useGameRefs.ts` | espelhos do estado para ticks | game loop |
| `src/hooks/useGameLoop.ts` | relógio, ordem e commit diário | game loop |
| `src/engine/gameLoop/order.ts` | ordem conceitual/futura | game loop |
| `src/hooks/gameLoop/economyTick.ts` | filas + economia diária | economia |
| `src/hooks/gameLoop/unrestTick.ts` | unrest, spawn e anexação | estabilidade/rebeldes |
| `src/hooks/gameLoop/diplomacyTechTick.ts` | pacto, progresso e war score | diplomacia/tech |
| `src/hooks/gameLoop/aiTick.ts` | decisões e fusão dos bots | IA |
| `src/hooks/gameLoop/movementTick.ts` | movimento e libertação | militar/rebeldes |
| `src/hooks/gameLoop/battleArrivalTick.ts` | chegada, ocupação e início | combate |
| `src/hooks/gameLoop/battleContinuousTick.ts` | resolução/finalização/conquista | combate |
| `src/hooks/gameLoop/rebelTick.ts` | guerra rebelde e fim de jogo | rebeldes |
| `src/engine/military/movementEngine.ts` | acesso, BFS, movimento, merge/split | militar |
| `src/engine/military/recruitmentEngine.ts` | conclusão/cancelamento | recrutamento |
| `src/engine/combat/continuousBattle.ts` | batalhas ativas e perdas diárias | combate |
| `src/engine/combat/battleFinalizer.ts` | vencedor, wipe e relatório | combate |
| `src/engine/combat/combatCalculations.ts` | fórmulas militares | combate |
| `src/engine/combat/combatRetreats.ts` | recuo manual/alternativo | combate |
| `src/engine/combat/battleResolver.ts` | resolvedor instantâneo não conectado | combate legado |
| `src/engine/economy.ts` | renda, manutenção, população/manpower | economia |
| `src/engine/buildings.ts` | fila e reembolso | construções |
| `src/engine/diplomacy.ts` | relações, pacto, guerra e paz | diplomacia |
| `src/engine/technology.ts` | foco, pesquisa e bônus | tecnologia |
| `src/engine/stability.ts` | faixas e prestígio | estabilidade |
| `src/engine/unrest.ts` | agitação e impacto econômico | rebeldes |
| `src/engine/aiEngine/aiEconomy.ts` | gasto/filas/foco/tech da IA | IA |
| `src/engine/aiEngine/aiMovement.ts` | estratégia militar | IA |
| `src/engine/aiEngine/aiHelpers.ts` | distância, fronteira e alvos | IA |
| `src/engine/rebellions/rebelAccumulation.ts` | criação/fusão/liberação | rebeldes |
| `src/engine/rebellions/rebelAI.ts` | marcha e guerra separatista | rebeldes |
| `src/engine/rebellions/rebelHelpers.ts` | paths e constantes rebeldes | rebeldes |
| `src/engine/saveSystem.ts` | V1/V2, serialização e localStorage | save/load |
| `src/engine/gameConditions.ts` | fim e estatísticas | campanha |
| `src/hooks/app/useArmyActions.ts` | comandos militares do jogador | militar |
| `src/hooks/app/useEconomyActions.ts` | build/recruit/cancel | economia |
| `src/hooks/app/useDiplomacyActions.ts` | comandos diplomáticos | diplomacia |
| `src/hooks/app/useTechActions.ts` | pesquisa/foco/lei/velocidade | tecnologia/governo |
| `src/hooks/app/useSaveSystem.ts` | hidratação e UI de saves | save/load |
| `src/hooks/app/useCheats.ts` | API de debug | cheats |
| `src/data/provinces.ts` | mapa e valores provinciais | dados |
| `src/data/countries.ts` | países iniciais | dados |
| `src/data/units.ts` | catálogo militar | dados |
| `src/data/buildings.ts` | catálogo de edifícios | dados |
| `src/data/technology/index.ts` | agregação de árvores | dados |
| `src/constants/laws.ts` | catálogo de leis | governo |
| `src/types/army.ts` | exército, recrutamento e resultado | tipos |
| `src/types/battle.ts` | batalha ativa | tipos |
| `src/types/country.ts` | país/recursos/economia | tipos |
| `src/types/province.ts` | província/construção | tipos |
| `src/types/diplomacy.ts` | relação e guerra | tipos |
| `src/types/technology.ts` | foco/tecnologia/estado | tipos |
| `src/types/gameState.ts` | modelo agrupado preparado | tipos/arquitetura |

---

# 13. Guia “Onde mexer?”

| Quero alterar… | Começar por | Conferir também |
|---|---|---|
| combate ativo | `continuousBattle.ts`, `battleContinuousTick.ts` | `battleFinalizer.ts`, `combatCalculations.ts`, tipos/modal/testes |
| detecção/reforço | `continuousBattle.checkAllProvinceCombats` | `battleArrivalTick.ts` |
| recuo | `continuousBattle.processDailyBattle`, `combatRetreats.ts` | `useArmyActions.ts`, finalizador |
| cerco/conquista | `battleContinuousTick.ts` | `unrest.ts`, cancelamento de filas, países |
| economia | `engine/economy.ts` | `economyTick.ts`, leis, buildings, `TopBar` |
| construções | `data/buildings.ts`, `engine/buildings.ts` | `useEconomyActions`, `ProvinceBuildingsTab`, `economyTick` |
| recrutamento/unidade | `data/units.ts`, `recruitmentEngine.ts` | `useEconomyActions`, `aiEconomy`, painel militar |
| IA econômica | `aiEngine/aiEconomy.ts` | `aiTick.ts`, tech/data |
| IA militar | `aiEngine/aiMovement.ts`, `aiHelpers.ts` | `aiTick.ts`, movement engine |
| movimentação/path | `military/movementEngine.ts` | `useArmyActions`, `movementTick`, `ArmyMovementLayer` |
| nova tecnologia | arquivo de categoria em `data/technology/technologies/` | agregador, `technology.ts`, `ResearchModal`, conexão de bônus |
| novo foco | arquivo em `data/technology/focuses/` | agregador, `technology.ts`, `FocusModal` |
| estabilidade/unrest | `stability.ts`, `unrest.ts` | `economy.ts`, `unrestTick`, combate |
| rebeldes | `engine/rebellions/` | `unrestTick`, `rebelTick`, combate/movimento |
| diplomacia/guerra | `engine/diplomacy.ts` | `useDiplomacyActions`, painéis, `diplomacyTechTick` |
| leis/governo | `constants/laws.ts` | `GovernmentModal`, `useTechActions`, economia/recrutamento |
| game loop/ordem | `hooks/useGameLoop.ts` | todos os `hooks/gameLoop/*`, `engine/gameLoop/order.ts`, refs |
| estado global | `App.tsx`, `useGameRefs.ts` | `types/gameState.ts`, save |
| save/load | `engine/saveSystem.ts`, `useSaveSystem.ts` | `SettingsModal`, autosave em `useGameLoop` |
| mapa/províncias | `data/provinces.ts`, `components/GameMap/` | `types/province.ts`, pathfinding |
| cheats/debug | `useCheats.ts`, `CheatPanel.tsx` | exposição em `App.tsx`, contextos de log |

---

# 14. Inventário final da análise

## Escopo analisado

Foram inventariados e analisados **145 arquivos versionados existentes antes da criação deste documento**: 117 arquivos TypeScript/TSX, 14 CSS e 14 arquivos de configuração, dados textuais, HTML, Python e metadados. Dependências em `node_modules` e internals de `.git` não fazem parte do código do projeto e foram excluídos. Depois deste arquivo, o repositório passa a ter 146 arquivos versionáveis se ele for adicionado.

## Sistemas identificados

Arquitetura/UI, mapa e províncias, países/governo/leis, exércitos/regimentos, recrutamento, movimentação/pathfinding, combate contínuo, recuo/*stackwipe*/conquista, guerras/diplomacia, economia/população/manpower, construções, tecnologia/focos, estabilidade/prestígio, unrest/rebeliões, IA, game loop/calendário, condições finais, save/load V1–V2, notificações/logs e cheats/debug.

## Funcionalidades incompletas encontradas

- Fases independentes de produção, população e eventos.
- Aplicação efetiva de bônus de tecnologia/foco e de vários bônus de leis/edifícios.
- Velocidade de recrutamento/construção nas filas.
- Cerco como sistema próprio e terreno/fortificação coerentes com os dados.
- Estatísticas completas de guerra e manutenção militar.
- IA diplomática e uso consistente de target locking.
- Persistência de histórico, dificuldade e estados auxiliares.
- Store `GameState` unificada e domínios futuros comentados.

## Possível código antigo, alternativo ou desconectado

- `battleResolver.resolveBattle` e sua lógica placeholder de fuga/cerco.
- partes de `combatRetreats` duplicadas pelo combate contínuo;
- `continuousBattle.triggerRetreat`;
- `GAME_LOOP_ORDER` como especificação sem execução;
- `types/game.ts` e helper de `types/gameState.ts` sem uso no App;
- `calculateTechBonuses` fora do runtime;
- `clearAllSaves`, contador de construção e imports/variáveis listados pelo lint.

## Comandos de auditoria reproduzíveis

```bash
find . -path './.git' -prune -o -path './node_modules' -prune -o -type f -print | sort
git ls-files | wc -l
rg -n -i 'TODO|FIXME|placeholder|futuro|não implement|não usado' . --glob '!node_modules/**' --glob '!.git/**'
rg -n 'hasEscapeRoute|remainingAttackerArmies|triggerRetreat|recruitmentSpeedMultiplier' src
npm run typecheck
npm run test:run
npm run lint
git status --short --branch
git diff -- DOCUMENTACAO.md
```

O `typecheck` passou; as 7 suítes/43 testes passaram; o lint passou sem erros e apresentou 47 avisos, incorporados nas seções de incompletude/investigação quando relevantes.
