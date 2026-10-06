# Auditoria South America V1

Cen?rio: 13 pa?ses, 56 prov?ncias; branch `feat/map-expansion`. Sem commit/push. Geometria, viewport e regras de balanceamento militar preservados.

## Defeitos corrigidos

- Movimento notificava somente a chegada final: fronteiras intermedi?rias podiam ficar sem ocupa??o e sem interrup??o pela batalha. Cada aresta agora produz chegada; combate limpa ordens e marcadores de movimento.
- Ordens antigas n?o revalidavam todas as arestas nem o acesso diplom?tico ap?s mudan?as de controle/rela??es. Agora s?o canceladas sem mudar a localiza??o l?gica.
- Chegadas simult?neas podiam conquistar antes de considerar o defensor que tamb?m chegava naquele tick. Todos os rec?m-chegados s?o considerados.
- O bot?o de retirada escrevia `isRetreating`, campo sem consumidor. Agora chama a retirada real, valida controle do jogador e atualiza refs/estado imediatamente. Ocupantes sobreviventes ocupam territ?rio vazio no tick seguinte, usando a mesma condi??o de guerra e `transferProvince`.
- Retirada aceitava vizinho pr?prio ocupado por tropas estrangeiras, deixava ordens/posi??o antigos e mantinha batalha com um lado vazio. Corrigidos. A regra permanece uma ?nica aresta pr?pria; n?o foi introduzida retirada por territ?rio aliado.
- O p?s-combate reaplicava deslocamento e usava o total dos perdedores como tropas finais de cada participante. Cada ex?rcito conserva sua resolu??o e tropas individuais.
- Batalha antiga podia conquistar ap?s paz. Conquista exige guerra vigente ou liberta??o rebelde permitida.
- IA sem inimigo imediatamente vizinho n?o perseguia objetivos distantes; em paz podia vagar entre vizinhos. Agora escolhe objetivos alcan??veis em guerra e mant?m uma fronteira alcan??vel em paz.
- Apoio podia reservar ordens rec?procas; solicitante agora espera no ponto de encontro. Defesa da capital usa capital expl?cita, ignora tropas aliadas como amea?a e s? reserva for?a ap?s obter rota.
- Recupera??o calculava supply sem os demais ex?rcitos locais. Agora recebe a pilha local; recupera??o em supply cr?tico n?o drena organiza??o/moral nem cria refor?os sem recursos.
- Removidos `[REBELLION TYPE]` e logs tempor?rios de pathfinding/re-rota. `[REBEL POWER]` n?o estava presente.

## Cobertura autom?tica

59 testes novos, 347 testes totais em 29 arquivos. Novos arquivos em `src/engine/__tests__`: `mapRouting.test.ts` (16), `movementSouthAmerica.test.ts` (16), `supplySouthAmerica.test.ts` (15), `campaignMovement.test.ts` (11), `armyActionsSouthAmerica.test.tsx` (1), e helper `helpers/southAmericaAudit.ts`.

- `validateMapTopology`: v?lido, zero problemas e uma componente de 56 prov?ncias. Inclui owners, holdings, capitais, arestas ausentes/unilaterais/duplicadas e self-edges.
- Todos os 3.136 pares ordenados verificados; passos adjacentes bidirecionais, destino correto, sem repeti??o. Geometria removida/corrompida produz as mesmas rotas.
- Rotas distantes: Caracas ? Santa Cruz argentina; Bogot? ? Buenos Aires; Santiago ? Bras?lia; Lima ? Montevid?u; Bras?lia ? Caracas; Buenos Aires ? Georgetown; Quito ? S?o Paulo; Amazonas ? Santiago.
- Acesso pr?prio, neutralidade sem permiss?o, permiss?o pela rela??o/opini?o atual, aliados, guerra e terceiros ocupados. N?o foi inventado um tratado novo: a regra existente permite opini?o >= 80.
- Campanhas Brasil/Bras?lia ? Argentina/Buenos Aires, Chile/Santiago ? Bol?via/La Paz e Venezuela/Caracas ? Uruguai/Montevid?u. Usam os hooks reais na ordem movimento ? chegada/combate ? dia de batalha, com acessos concedidos e defensores controlados; verificam batalha efetivamente iniciada, conquista e holdings.
- Retirada m?ltipla/alternativa, cerco sem sa?da, movimento inv?lido/em combate, chegada simult?nea, paz ap?s batalha, IA por 100 ticks em paz e 60 ticks sem rota em guerra.
- Supply por tamanho/local, desenvolvimento/constru??es, movimento, controle e concentra??o. Recupera??o cr?tica por 90 dias; mercados de todas as prov?ncias por 120 dias; estoques finitos e n?o negativos.
- Inspe??o de fontes: nenhum ID fict?cio `p1`, `p2` etc. nos sistemas de runtime examinados. `country.provinces[0]` permanece somente na migra??o/load de saves, n?o na IA.

## Performance e limites

BFS preservado, com ?ndice local `Map`, visita??o por `Set` e cursor de fila no lugar de `queue.shift()`. Movimento reutiliza ?ndices de prov?ncias e agrupamento de tropas por local. Permanecem buscas/filtros nos scores da IA e na detec??o global de combate; sem otimiza??o massiva nem benchmark de milhares de prov?ncias.

Supply continua local, sem nova rede de abastecimento. IA de refor?o coordena ex?rcitos do mesmo pa?s; n?o foi criado comando de coaliz?o. Retirada manual encerra a batalha sem gerar o relat?rio hist?rico di?rio; n?o foi redesenhado esse fluxo. Campanhas usam ticks controlados, n?o simula??o de anos. Valida??o das capitais ? do cen?rio inicial: durante guerra, capital original pode pertencer ao invasor sem tornar holdings inconsistentes.

## Inspe??o visual solicitada

**N?o executada: navegador inacess?vel nesta sess?o.** O navegador conectado retornou `apps: []` e `browsers: []`. A alternativa nativa falhou com `Computer Use native pipe is unavailable`, erro do sistema 2. N?o foi poss?vel verificar interativamente carregamento, zoom/pan, sele??o, labels/marcadores, marchas/rotas longas, batalhas/ocupa??es/retirada, travamentos visuais da IA ou console. Os testes de integra??o n?o substituem essa inspe??o.

## Arquivos de runtime alterados

`src/App.tsx`; `src/hooks/app/useArmyActions.ts`; `src/engine/aiEngine/aiMovement.ts`; `src/engine/military/{movementEngine,recoveryEngine}.ts`; `src/engine/combat/{combatRetreats,continuousBattle}.ts`; `src/hooks/gameLoop/{battleArrivalTick,battleContinuousTick,economyTick}.ts`; `src/engine/rebellion/rebellionSpawner.ts`. Documenta??o: este relat?rio e `src/data/map/README.md`.

## Verifica??es finais

`npm run lint`: passou, sem warnings. `npm run typecheck`: passou. `npm run build`: passou (153 m?dulos). `npm run test:run`: 347 testes passaram em 29 arquivos. `git diff --check`: passou.
