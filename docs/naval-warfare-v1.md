# Naval Warfare V1

O sistema naval é independente de Army, das fórmulas terrestres e de ActiveBattle.
O mapa continua `world-v1`, com 201 países e 494 províncias. Nenhuma conexão
marítima é adicionada a `Province.neighbors`. Scheduler, velocidades, seleção
de país e regras territoriais de endgame permanecem os existentes.

## Entidades e configuração

`src/types/naval.ts` define NavalUnit, Fleet, SeaNode, SeaEdge, NavalPort,
NavalBattle, NavalState e os contadores do profiler. Fleet tem localização
exclusiva em porto ou SeaNode, rota ordenada, destinos de mar/porto, progresso
do segmento e estados DOCKED, HOLDING, MOVING, COMBAT e RETREATING.

Os valores de `src/data/navalUnits.ts` são a fonte central de balanceamento.
Cada navio começa com 100 strength e 100 organization.

| Classe | Ataque | Defesa | Velocidade | Ouro/dia |
| --- | ---: | ---: | ---: | ---: |
| DESTROYER | 8 | 14 | 32 | 0,12 |
| CRUISER | 18 | 20 | 25 | 0,25 |
| BATTLESHIP | 38 | 32 | 18 | 0,55 |
| TRANSPORT | 1 | 5 | 22 | 0,08 |

Transport é uma unidade naval fraca, preparada para extensão futura; não
embarca Army. Fleet speed usa o navio mais lento. Não há construção naval.

## Portos, costa e geração offline

A auditoria de `src/data/buildings.ts` não encontrou prédio de porto/shipyard.
Assim, bases operacionais são metadata estática, separada dos prédios e do save.
`src/data/navalWorld.json` contém 1.541 nós, 6.463 arestas bidirecionais,
124 portos, 318 províncias com costa navegável e 24 arestas lógicas de seam.
As contagens de arestas são de pares, sem duplicar as duas direções.

`tools/map/generate_naval.mjs` carrega a montagem ativa do mapa via Vite SSR e
analisa os polígonos SVG já arredondados do jogo. O parser de anéis usa a regra
even-odd, incluindo buracos; um índice espacial reduz as consultas geométricas.
Um segmento provincial é candidato a costa quando pequenas sondagens em lados
opostos do seu ponto médio distinguem terra de água na montagem completa.
Nunca se infere costa pela quantidade de neighbors terrestres.

O gerador produz uma grade de 6 graus em águas abertas e refina para 3 graus
perto da costa. Gibraltar e estreitos dinamarqueses recebem amostragem mais
fina e alguns pontos de estreitos recebem coordenadas adicionais. São pontos,
não rotas desenhadas manualmente: todos os links são gerados e validados.
Vizinhos próximos são conectados somente se o segmento inteiro não intersecta
nenhum anel terrestre. O maior componente oceânico é preservado; 28 componentes
isolados, incluindo lagos e pequenos fragmentos sem passagem, são excluídos.

Uma província recebe metadata costeira navegável se uma saída costeira alcança
esse componente por água. Isso é conservador: pequenas ilhas/baías ausentes ou
passagens muito estreitas no SVG podem ficar sem conexão nesta V1. As formas
cartográficas determinam o limite de precisão; não se afirma uma costa real
mais detalhada do que os dados do jogo.

Portos são um subconjunto das províncias costeiras: um por país com base
conectada, mais Califórnia como base americana do Pacífico. Preferência por
província da capital, depois desenvolvimento e ID; se não houver saída válida,
considera-se a próxima candidata. O nível é `clamp(floor(development/4),1,3)`.
O berço fica no lado aquático de um segmento costeiro, não no centro terrestre
da província. Capital/cidade nomeia a província da base, sem afirmar que o
marcador é a localização exata de um porto histórico. Nem toda costa é porto.

`isCoastalProvince`, `getCoastalProvinces`, `portByProvince`, `seaNodeById` e
`seaEdgeByPair` centralizam consultas. A V1 não executa geometria no runtime.

Reprodução e validação:

```sh
npm run generate:naval
npm run validate:naval
```

A validação offline compara o JSON com a geração determinística e testa nós
dentro de terra, interseções dos segmentos e links dos berços. `validateSeaGraph`
testa IDs duplicados, vizinhos ausentes, self edges, simetria, links de portos,
coordenadas, distância e conectividade. A suíte verifica também as dez rotas
intercontinentais mínimas, Mediterrâneo e Japão–Califórnia.

## Pacífico e antimeridiano

**World Horizontal Wrap V1 NÃO é necessário para Naval V1.** O Pacific pode
usar logical sea edges sem wrap visual. As 24 arestas ligam nós x=0 e x=5040
na mesma latitude e custam 42 unidades do mapa, como passagem abstrata curta.
Elas são usadas por Dijkstra, movimento e save, sem gerar neighbors terrestres.

A camada visual não desenha uma linha dessas arestas atravessando continentes.
Durante uma passagem lógica, o marcador fica no extremo de origem na primeira
metade e aparece no extremo de destino na segunda. Essa descontinuidade de
posição é deliberada: não há interpolação visual através do mundo, animação de
wrap, mundo duplicado ou alteração na câmera. Os trechos normais interpolam.
Não há atalhos de Suez/Panamá através da terra; Europa–Índia navega pelo Cabo.

## Movimento e comandos

Dijkstra usa distância das arestas, heap binário e desempate por ID, com custo
aproximado O((V+E) log V). Sem cache persistente. Origens/destinos inválidos e
ordens de jogador para frotas estrangeiras são rejeitados.

Cada tick é um dia. O orçamento de movimento é `min(ship.speed) * 2` unidades
do mapa por dia. O progresso é a fração do segmento atual; o saldo pode percorrer
segmentos adicionais pequenos. A saída do berço e a chegada ao porto também
consomem distância e interpolam. Frotas param ao alcançar nó hostil ocupado,
para não atravessar um encontro no mesmo dia. Buckets evitam comparar cada
Fleet com todas as Fleets.

Replanejar no meio de uma aresta preserva o segmento e progresso correntes.
Cancelar termina o segmento corrente, evitando voltar instantaneamente à origem.
Na aproximação final ao berço, o cancelamento termina a aproximação; novas ordens
aguardam atracação. COMBAT e RETREATING bloqueiam substituição manual de ordens.
Return to Port escolhe o porto amigo mais próximo por distância navegável, ou
aceita um porto específico. Oceanos permitem passagem livre; portos exigem
propriedade, aliança ou concessão de military access pelo proprietário.
Guerra prevalece sobre acordos. Perder acesso ao porto expulsa a frota para seu
nó de saída; ela não repara em base inimiga.

## Presença, combate e retirada

`buildNavalPresence` deriva Fleet IDs, países, poder, controlador exclusivo ou
estado disputado por nó. Presença compartilhada entre neutros não cria combate
nem bloqueia passagem. Tooltips de SeaNodes exibem essa presença.

Hostilidade vem dos lados opostos das campanhas de War/Diplomacy existentes,
incluindo participantes chamados. Não basta compartilhar nó ou ter opinião baixa.
Detecção usa `fleetsBySeaNode`. Frotas em porto ou no meio de uma aresta não
combatem no nó de origem. Batalhas ativas são preservadas; coalizões entram
somente se forem hostis a todos os participantes do lado oposto. Uma mudança
de hostilidade encerra o agrupamento e permite redetectar apenas pares ainda
hostis, protegendo países que se tornaram neutros.

As duas forças de ataque são calculadas antes de aplicar dano, de modo simultâneo:

```text
FleetAttack = sum(attack * strength/maxStrength * (0.25 + 0.75*organization/maxOrganization))
SideDefense = sum(defense * strength/maxStrength)
DamagePerShip = OpposingSideAttack * 3 / (1 + SideDefense/100) / SideShipCount
StrengthLoss = min(currentStrength, DamagePerShip)
OrganizationLoss = DamagePerShip * 1.5
```

O dano alcança cada NavalUnit, sem targeting complexo. Navios com strength zero
são removidos; Fleet sem navios também. O lado quebra quando todas as suas
frotas foram destruídas ou têm organização média ≤20%. Batalhas guardam perdas,
duração, lados, resultado e histórico de até 100 batalhas concluídas; todas as
batalhas ativas são mantidas. Nenhum valor naval é convertido em manpower ou
war casualties terrestres, e o war score territorial não muda.

Uma Fleet sobrevivente derrotada recebe uma aresta adjacente de retirada,
priorizando nó sem inimigo e menor distância navegável a porto amigo. Se todas
as saídas estiverem hostis, usa a rota disponível em vez de aniquilar a frota.
Há três dias de proteção contra redetecção imediata; movimento continua.
Datas usam o mesmo `diplomacyDay` da campanha. Em 1444 são negativas em relação
ao Unix epoch: ausência de `retreatUntil` significa ausência de proteção, e
`startedAt` negativo é válido no save. Há regressão específica para essa data.

## Economia, manutenção e recuperação

Manutenção é a soma do ouro/dia configurado de todos os navios; aplica-se a
FULL/PASSIVE e em qualquer estado. Desconta gold, limitado a zero, e aparece
na despesa nacional publicada. Não altera mercado, estoques ou fórmulas terrestres.

Em DOCKED e porto amigo:

```text
organization += 4 * portLevel, limitado ao máximo
strengthRepair = min(0.5 * portLevel, missingStrength, availableGold / 0.04)
goldCost = strengthRepair * 0.04
```

Custos são pagos por navio em ordem estável. Sem ouro, organização ainda se
recupera, mas strength não. Não há naval range, supply chain, drain oceânico ou
penalidade adicional por insolvência na V1. Portos estrangeiros autorizados
servem como bases; bloqueios ficam para V1.1.

## Initial navies e AI

A geração determinística atual cria **33 frotas / 79 navios**, uma frota por país
elegível. O score simples é `goldIncome + manpower/2000 + provinceCount*2 +
portCount*3`, com recursos negativos limitados a zero. Exige porto conectado.
Países fora da lista estratégica precisam de score ≥12; recebem destroyer,
ou destroyer+cruiser se score ≥30. USA, GBR, JPN, FRA, ITA, DEU, BRA, CHN,
RUS, IND e AUS recebem dois destroyers, cruiser, battleship e transport.
É uma aproximação de poder jogável, não uma ordem de batalha histórica de 1444.
Microstates sem porto recebem zero; uma costa por si só não garante Fleet.

Somente bots FULL executam Naval AI. Player nunca é controlado pela AI.
Em paz, saem uma vez para manter presença perto da base. Em guerra, procuram
Fleet hostil próxima, a até 600 unidades visuais, evitando poder superior a
1,35× o próprio. Organização <50% ou navio com strength <65% leva a retorno.
O critério de proximidade visual não procura alvos do outro lado do seam; o
player ainda pode navegar pelo Pacífico lógico. Strategic AI de seam é backlog.

PASSIVE não cria ordem, mas movimento existente, combate, manutenção e reparo
continuam globais. War participants já são FULL: não foi criada regra naval
duplicada de Simulation Activation. São usados índices efêmeros de país, nó,
porto, ID e hostilidade, sem `Country × all Fleets` ou `Fleet × all SeaNodes`.

## Tick, publication e Save V3

Ordem final: economy → politics → unrest → diplomacy/technology → AI terrestre
→ navalAI → movement terrestre → navalMovement → battleArrival →
battleContinuous → navalCombat + recovery/maintenance → warResolution →
rebellion → cleanup → publication/autosave. As fases terrestres mantêm sua
ordem relativa. Naval AI vê a diplomacia/AI atualizada; combate ocorre depois
do movimento e antes da resolução de guerra. Cleanup remove Fleet de país
sem território, preservando endgame territorial. Não modifica scheduler.

O estado naval mora em React + `navalStateRef`, publicado no mesmo tick do resto
da campanha. Comandos atualizam a ref imediatamente. Save V3 recebe um campo
opcional `naval: {fleets,battles}`. Unidades, localização, rotas, destinos,
progresso, retirada e batalhas persistem; grafo e portos estáticos não.

Saves V2/V3 antigos sem esse campo carregam estado naval vazio. V1 também
permanece compatível, sem respawn automático. New Game cria initial navies;
load nunca as recria. Load manual atualiza ref e setter; país do jogador vem
da mesma tecnologia salva. O validador trata JSON como unknown e rejeita
localizações/rotas/IDs/stats/batalhas inválidos em vez de perder dados silenciosamente.
O serializer omite `unrestExplanation`, uma explicação derivada de UI que o load
já descartava. Isso preserva o contrato V3 e evita persistir diagnósticos de
494 províncias.
Campos opcionais vazios de acordos/cooldowns também são omitidos: a migração
V3 existente restaura arrays/objetos vazios identicamente. Isso evita gravar
dezenas de milhares de estruturas vazias depois de load, sem mudar diplomacia.
Limite de localStorage continua dependente do navegador: falhas de escrita
retornam erro, preservam o slot anterior e são mostradas na UI,
inclusive no autosave; não há mudança de formato, backend ou compressão de mundo.

## UI

FleetMarker, NavalLayer, FleetPanel e NavalBattlePanel são componentes separados.
Frotas ficam visíveis no mapa normal; rede/portos só aparecem em Naval Mode.
Nós e arestas da rede são recortados pelo viewport, e elementos estáticos são
memoizados, evitando reconciliar toda a rede oceânica durante pan em zoom local.
Selecionar Fleet também expõe os SeaNodes interativos. Direito em SeaNode move;
direito em porto/província de porto atraca se há acesso. FleetPanel apresenta
país, lugar, status, progresso, destino, velocidade, força, organização e navios.
Return/Cancel exigem ownership; Locate e F usam `focusWorldPoint` da câmera
central existente. Escape limpa seleção naval. ProvincePanel acrescenta nível
operacional, regra de recuperação e frotas atracadas. Battle marker/painel e
lista de batalhas localizam SeaNode; o painel mostra perdas, participantes e duração.

## Profiler, benchmark e validações

Em development, GameLoop agrega fases `navalAI`, `navalMovement`, `navalCombat`
e contadores fleets, movingFleets, navalAIBots (países únicos),
activeNavalBattles e pathfindCalls. Contadores são somados na janela de 60 ticks,
depois zerados; produção usa profiler inerte, sem logs por Fleet.

`npm run benchmark:naval` mede 20 amostras e três warmups de estados independentes
com 201 países, paz, guerras, 33 Fleet orders e múltiplas batalhas. Resultado:
`artifacts/naval-warfare-v1-benchmark.json`. Neste ambiente:

| Cenário | Naval AI mediana ms | Movimento ms | Combate + recuperação ms | Total naval ms |
| --- | ---: | ---: | ---: | ---: |
| Paz | 0,112 | 0,101 | 0,416 | 0,653 |
| Guerras | 0,100 | 0,082 | 0,395 | 0,582 |
| 33 ordens | 0,051 | 0,176 | 0,486 | 0,716 |
| Batalhas | 0,212 | 0,155 | 0,632 | 1,049 |

A busca longa JPN–Califórnia isolada mediu medianas de 2,596–7,806 ms.
Não há threshold dependente de máquina. As medições não incluem render,
scheduler nem o cálculo adicional de activation; não constituem comparação
controlada com uma versão anterior. O artefato registra ambiente e amostras.

Os três arquivos novos cobrem entidades, stats, grafos e rotas, comandos,
interpolação, acesso, hostilidade, dano, destruição, retirada, recuperação,
manutenção, FULL/PASSIVE, presença, profiler, Save V3, load e UI/câmera.
Os testes existentes de profiler foram adaptados ao novo número de fases;
as demais regressões do mapa/movimento/seleção/ativação permanecem na suíte.
São 104 testes novos; a suíte final tem 1.917 testes em 77 arquivos.

Comandos de validação final:

```sh
npm run lint
npm run typecheck
npm run test:run -- --maxWorkers=2
npm run build
npm run validate:naval
git diff --check
```

A execução padrão da suíte teve timeouts sob muitos workers; o retry usa dois
workers conforme solicitado. Build mantém o aviso de chunk maior que 500 kB.

`node scripts/smoke-naval-browser.mjs` automatiza o checklist em Chrome headless
por CDP, com perfil temporário: New Game BRA, seleção, Locate, Naval Mode,
ordem Atlantic, movimento x3, reset/focus, save/load, declaração de guerra pela
UI, encontro/batalha, retirada, retorno, recuperação e navegação x3. Para o
encontro reproduzível, posições das duas frotas são aproximadas por uma fixture
do save; guerra é declarada pelos controles normais. Essa automação não equivale
a uma sessão manual longa nem demonstra equivalência de microtravadas históricas.
O caminho de Chrome pode ser informado por `NAVAL_CHROME_PATH`.
O roteiro passou em Chrome, sem exceções de runtime, incluindo autosave mensal
com batalha/reparo. Os registros e capturas estão em
`artifacts/naval-warfare-v1-browser.json`, `naval-warfare-v1-browser.png` e
`naval-warfare-v1-battle.png`. Na amostra de navegação de dois segundos em x3,
o modo normal apresentou 49 frames, gap máximo de 300 ms e oito gaps >50 ms;
o modo naval apresentou 43 frames, gap máximo de 316,7 ms e os mesmos oito
gaps >50 ms, desenhando 70 arestas visíveis. O custo global do tick ainda causa
pausas; não há comparação controlada com o build anterior nem afirmação de
que as microtravadas existentes foram eliminadas. A execução coincidiu com
checks locais, e esses números não devem ser usados como threshold de máquina.

## Limitações e próximos passos

Não há blockade, construction/shipyards, naval range, convoy/trade, embarque
de Army, amphibious invasion, submarinos, carriers, air warfare, fog of war,
admirals, naval doctrines/tech tree ou novas regras de paz/endgame.
Não há contribuição naval ao war score; Naval contribution to War Score V1.1 /
Peace Conference V2 é dívida explícita. Malha e base inicial são aproximações
conservadoras da geometria existente. Sem canais terrestres e sem interceptação
no meio de uma aresta: encontros acontecem nos nós.

V1.1/V2: construção naval, shipyards, alcance, blockades, convoys/trade,
amphibious invasions, transport armies, submarines, escorts, doctrines,
admirals e naval war score. Air Warfare vem depois. World Horizontal Wrap
permanece backlog distante e opcional. Não houve commit ou push.
