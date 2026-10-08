# Performance Pass V1 — Etapa 2C: Military AI

Implementação local, sem commit ou push. DiplomacyAI, economia, scheduler, cadência,
fórmulas, combate, mapa e Naval Warfare não foram alterados.

## Auditoria e custo por subfase

O caminho normal é `processAiTick → processAI`. A economia continua intercalada
com o processamento militar de cada Country, na ordem original.

| Subfase | Caminho auditado | Mudança estrutural |
| --- | --- | --- |
| ownArmyCollection | coleta de forças disponíveis e reforços | buckets por owner, preservando ordem |
| warStateEvaluation | postura de campanha e estado diplomático de guerra | wars por país para inimigos diretos; estado diplomático calculado uma vez por bot |
| enemyEvaluation | seleção e comparação de forças inimigas | buckets de inimigos reunidos pela posição original no array mundial |
| defensiveDecision | ameaça à capital, defesa e rendezvous | buscas de ameaça restritas à capital e províncias vizinhas |
| borderEvaluation / idleDecision | fronteira em paz e posicionamento | províncias próprias indexadas, consultas de fronteira memoizadas no tick |
| targetSelection | províncias estratégicas | candidatos elegíveis coletados uma vez por bot, somente quando solicitados |
| pathfinding | BFS de destinos, defesa, reforços e objetivos | índice provincial compartilhado e rotas memoizadas por bot |
| accessChecks | acesso territorial e hostilidade | mesmas funções originais, resultados memoizados por par direcional |
| logisticsChecks / offensiveDecision | suprimento atual/projetado e segurança de rota | fórmulas e ordem dos critérios preservadas; consultas instrumentadas |
| movementDecision / stateMutation | decisões e publicação de ordens | decisões somente nos slots do owner; substituições publicadas depois do bot |

O maior gargalo foi `isOwnCapitalThreatened`: a expressão consultava hostilidade
antes de verificar localização. Cada bot examinava todos os exércitos na busca
da capital e novamente para cada vizinho. No último sample instrumentado de paz,
defensiveDecision acumulou **506,39 ms**, dos quais accessChecks acumulou
**461,62 ms**. São fases inclusivas e sobrepostas, não parcelas somáveis.

Outros custos: filtragem do mundo diplomático por bot; `armyOwners` construído
mesmo com logística fornecida; `provinces.find` e `countries.find` repetidos;
scans de tropas por província em poder, perigo de rota e pontuação; construção
de Map provincial em cada BFS; avaliações repetidas de acesso e das mesmas rotas.

## Contexto efêmero e mutabilidade

`createMilitaryAIContext` é chamado uma vez depois da resposta a rebeliões e da
construção da logística, antes do loop de bots. Contém countryByTag,
provinceById, pathProvinceById, provincesByOwner, armiesByOwner,
armiesByProvince, relationsByCountry, warsByCountry, armySlotsByOwner e
memoização de fronteiras. Vizinhos são consultados pelo próprio Province indexado.

O contexto não persiste entre ticks. Rotas, acesso, hostilidade e candidatos são
locais à execução de um bot. A BFS preserva a ordem de neighbors e o comportamento
original para início igual ao destino, nós ausentes e destinos sem acesso.
Cada retorno de rota tem seu próprio array.

Os lookups reproduzem `.find` com a primeira ocorrência; a BFS reproduz o Map
original com a última ocorrência. Relações duplicadas mantêm a ordem original.
Tags inimigas não duplicam forças, e suas forças mantêm a ordem do array mundial.

Durante um bot, decisões leem o mesmo array de entrada original, inclusive quando
reservam reforços. Ao terminar, referências substituídas são publicadas nos buckets
por owner e localização. `processAI` altera somente campos de movimento; owner,
location, número e ordem dos exércitos não mudam. Bots seguintes recebem o novo
array e os buckets atualizados. Substituições de Country feitas pela economia são
publicadas no countryByTag antes da chamada militar correspondente.

Paz continua executando defesa da capital, reação a logística insuficiente e
posicionamento na fronteira. Não foi introduzido early return geral por paz.

## Complexidade

Considere C países, P províncias, A exércitos, R relações, W guerras, d vizinhos,
e A_local forças nas províncias consultadas.

| Operação | Antes | Depois |
| --- | --- | --- |
| filtrar relações relevantes de todos os bots | O(C × R) | O(R) de indexação + lookup e uso dos buckets |
| coletar exércitos próprios | O(C × A) | O(A) de indexação + O(A_owner) por bot |
| coletar exércitos inimigos | scan de A por bot | buckets dos inimigos + ordenação dos slots, O(A_enemy log A_enemy) |
| ameaça à capital | O(C × (1+d) × A × custo da relação) | buckets locais; hostilidade avaliada uma vez por par por bot |
| lookup de país/província | O(C) / O(P) por consulta | O(1) esperado |
| tropas presentes numa província | O(A) por consulta | O(A_local) |
| fronteira | scans provinciais em cada lookup de vizinho | O(d) na primeira consulta, depois O(1) esperado |
| candidatos territoriais de várias forças | O(A_owner × P) | O(P) uma vez por bot que solicita candidatos |
| índice usado pela BFS | O(P) em cada chamada | O(P) uma vez por tick |

A indexação completa custa O(C+P+A+R+W), além dos caches consultados sob demanda.
A BFS mantém seu custo de busca no grafo; uma rota já consultada evita nova busca.
Não se afirma que toda a rodada é linear: comparação de inimigos, seleção de
destinos, fórmulas de campanha e logística projetada continuam fazendo o trabalho
necessário. Também permanece a cópia imutável do array mundial por bot (slice).

## Subprofiler

`aiBreakdown.militaryAI` agrega fases e contadores na janela existente de 60 ticks.
Fases são inclusivas; `max` é a maior invocação, `count` o número de invocações.
TOTAL mede cada execução militar; indexBuild mede separadamente o contexto comum.
Não se deve somar fases inclusivas para obter TOTAL.

Contadores: bots, warBots, peaceBots, armiesEvaluated, pathfindCalls, pathCacheHits,
routeChecks, provinceScans e relationLookups. armiesEvaluated conta forças próprias
inspecionadas, inclusive as descartadas por movimento/combate/localização.
provinceScans conta visitas a províncias nos scans instrumentados do módulo e a
construção de índices da BFS legada; não conta consultas indexadas nem scans
internos das fórmulas delegadas de campanha/logística. relationLookups conta
invocações dos avaliadores táticos instrumentados; acesso interno da BFS legada
não é incluído nesse contador. routeChecks conta emissão de rota e segurança ofensiva.

Não há logs por Country. Os profilers existentes e seus prefixos são preservados.
Com development desativado, não há leituras do relógio, agregação ou logs militares.

| Contador por rodada | Paz antes → depois | Guerras antes → depois | Vários exércitos antes → depois |
| --- | --- | --- | --- |
| bots | 200 → 200 | 200 → 200 | 200 → 200 |
| bots em guerra | 0 → 0 | 6 → 6 | 6 → 6 |
| relationLookups | 161.611 → 591 | 161.645 → 639 | 558.359 → 814 |
| provinceScans | 325.765 → 0 | 343.241 → 0 | 1.518.958 → 0 |
| pathfindCalls | 36 → 36 | 50 → 43 | 848 → 679 |
| pathCacheHits depois | 0 | 7 | 169 |
| routeChecks | 7 → 7 | 19 → 19 | 249 → 249 |

## Benchmark

`npm run benchmark:military-ai` e
`npm run benchmark:military-ai -- --no-profile`.

201 Countries / 494 Provinces reais; 200 bots (BRA é o jogador). Paz tem 201
exércitos. Guerras contém ARG–CHL, COL–VEN e FRA–DEU. O cenário com vários exércitos
acrescenta uma força em cada província própria: 695 forças no total e as mesmas guerras.
Cada cenário executa a rodada militar completa na ordem mundial. O contexto comum
está incluído no tempo after; construir a logística, clonar entradas e verificar
equivalência ficam fora da medição em ambos os lados.

Referência legada congelada, com wrappers de instrumentação; profiler desligado
continua tendo wrappers inertes. Dois warmups e sete samples por cenário e versão.
Cada resultado militar completo é comparado com deepStrictEqual, inclusive
warmups. Não há threshold dependente da máquina.

Node v26.8.2, Intel Core i5-13500T. Tempos em ms, **mediana / máximo**:

| Cenário | Antes, profiler desligado | Depois, profiler desligado | Redução da mediana |
| --- | --- | --- | --- |
| Paz | 642,26 / 659,70 | 14,75 / 17,63 | 97,7% |
| Algumas guerras | 656,89 / 702,56 | 18,60 / 22,61 | 97,2% |
| Vários exércitos | 1.680,69 / 1.704,94 | 45,02 / 47,74 | 97,3% |

| Cenário | Antes, profiler ligado | Depois, profiler ligado |
| --- | --- | --- |
| Paz | 648,16 / 695,86 | 15,26 / 17,81 |
| Algumas guerras | 683,93 / 691,82 | 20,51 / 22,85 |
| Vários exércitos | 1.888,89 / 2.030,97 | 52,29 / 70,40 |

Os samples brutos, ambiente e breakdown estão em `artifacts/military-ai-benchmark.json`
e `artifacts/military-ai-benchmark-production.json`. A medição inicial pré-otimização
está em `artifacts/military-ai-baseline.json`. Houve variação entre amostras e entre
execuções; os resultados não são uma previsão dos tempos absolutos no browser.
Não foi executada uma nova janela de 60 ticks no browser nesta sessão.

## Equivalência e validação

25 testes adicionados em militaryAIPerformance.test.ts: paz, guerra, ataque,
capital ameaçada, movimentos pendentes, combate, access/alliance, neutralidade sem
acesso, logística ofensiva insuficiente, retirada desconectada, reinforcement,
ausência de rota, forças sem localização, ameaça rebelde à capital, relações e
lookups duplicados, ordem mundial de inimigos com guerras duplicadas, publicação
entre bots, substituição econômica de Country, renovação do contexto e as três
rodadas do mundo completo. Incluem profiler desativado, exceções, contadores,
cache de rota e agregação/reset da janela de 60 ticks.

As comparações usam o estado completo de Army, verificam os buckets publicados
e confirmam que os inputs não foram mutados. Os testes existentes de campanha,
movimento, logística e rebeliões continuam na suíte completa.

Validação final:

- `npm run lint`: passou, sem warnings.
- `npm run typecheck`: passou.
- `npm run test:run`: **69 arquivos / 1.698 testes passaram**, incluindo os 25 novos.
- `npm run build`: passou; aviso de bundle maior que 500 kB emitido pelo Vite.
- `git diff --check`: passou.

A suíte padrão terminou sem timeout; não foi necessário alterar workers ou timeout.
