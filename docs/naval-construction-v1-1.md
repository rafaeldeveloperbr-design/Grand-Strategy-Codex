# Naval Construction V1.1

## Modelo e economia

`NavalState.construction` é uma extensão opcional do Save V3: shipyards dinâmicos, fila de navios, upgrades e contador persistente `nextId`. O sistema Building V2 possui onze edifícios terrestres, níveis até cinco, catálogos de bônus e IA próprios. Shipyards usam metadata naval separada para preservar esses contratos e fórmulas.

O ouro sai de `Country.resources.gold`. IRON e TOOLS saem exclusivamente de `Province.market.goods` do porto produtor. Não existe estoque nacional novo, consumo parcial ou uso automático de estoque vizinho. Os valores foram calibrados contra estoque inicial local (20 IRON/15 TOOLS) e custos dos edifícios existentes. Um Destroyer inicial custa 18 IRON/8 TOOLS; falta de estoque requer produção/comércio existentes.

Porto operacional significa uma Province existente com entrada em `portByProvince`. Somente seu owner pode produzir ou melhorar o shipyard; acesso militar e aliança não concedem produção. Captura transfere o shipyard concluído, mas cancela encomendas/upgrades do antigo owner, sem reembolso. Eliminação limpa filas; a limpeza do loop também cancela ordens no tick da transferência de território.

## Níveis e tempos

| Shipyard | Capacidade | Progresso/dia |
|---|---|---:|
| 0 | Somente upgrade | 0 |
| 1 | Destroyer, Transport | 1 |
| 2 | + Cruiser | 1,5 |
| 3 | + Battleship | 2 |

| Navio | Ouro | IRON | TOOLS | Dias base | Dias no nível 2 / 3 |
|---|---:|---:|---:|---:|---:|
| Destroyer | 180 | 18 | 8 | 120 | 80 / 60 |
| Transport | 120 | 12 | 5 | 90 | 60 / 45 |
| Cruiser | 420 | 40 | 18 | 240 | 160 / 120 |
| Battleship | 900 | 90 | 40 | 480 | bloqueado / 240 |

Transport é apenas o tipo naval já existente, sem transportar Army. Catálogos: `src/data/navalConstruction.ts`.

| Upgrade | Ouro | IRON | TOOLS | Dias |
|---|---:|---:|---:|---:|
| 0→1 | 200 | 15 | 8 | 90 |
| 1→2 | 400 | 50 | 25 | 180 |
| 2→3 | 800 | 100 | 50 | 300 |

Upgrades pausam produção, inclusive no dia de conclusão. Nível novo passa a acelerar navios no dia seguinte. Upgrade pode iniciar com fila paga existente; novas encomendas são bloqueadas durante upgrade. Upgrade e encomendas podem ser cancelados, sempre sem reembolso.

## New Game e fila

Os shipyards iniciais usam portLevel, development e capacidade econômica: renda ou tesouro/100, pois renda inicial pode ser zero antes do primeiro tick. Porto nível 3/desenvolvimento ≥6/capacidade ≥5 recebe shipyard 2; porto ≥2/desenvolvimento ≥4 recebe 1; porto 1/desenvolvimento ≥8/capacidade ≥10 recebe 1. Demais ficam em 0. USA, GBR, JPN, FRA, ITA, DEU, BRA, CHN, RUS, IND e AUS têm garantia determinística de pelo menos um nível 1 em seu melhor porto, quando existe. No roster atual são 18 shipyards de nível 1 e 106 portos sem shipyard. São Paulo começa com nível 1. Initial navies permanecem intactas.

Cada porto aceita cinco navios, com somente a primeira encomenda progredindo por dia. Todos os itens são pagos atomicamente **ao encomendar**, inclusive os que aguardam na fila; não há WAITING_RESOURCES. Falha deixa estado, tesouro e estoques intactos.

Na conclusão: `targetFleetId` própria e DOCKED no mesmo porto → outra frota própria DOCKED de menor ID → nova frota DOCKED no porto. Alvo inexistente, destruído ou em viagem usa fallback. Não há pathfinding nessa operação. Unidades recebem `ship-naval-build-N`; novas frotas e ordens usam o contador monotônico persistente, sem relógio, RNG ou comprimento global como ID. Ordens concluídas são removidas; carregar não recria navios nem cobra recursos.

## IA e PASSIVE

Somente países FULL podem iniciar encomendas/upgrades; o jogador é excluído. Construções já pagas continuam em qualquer activation. A IA reserva 1.000 ouro, exige renda maior que despesa, limita gasto diário a 10% do tesouro e a no máximo uma ordem por país/dia. Não inicia outra ordem em porto com fila/upgrade. Conta navios existentes e encomendados: cap de 12 em paz e 24 em guerra. Reconstrói uma frota ausente com Destroyer, repõe/expande em guerra e expande em paz após nível 2. Em paz, melhora conservadoramente shipyards até nível 2; nunca faz upgrades enquanto em guerra. V1.1 AI encomenda Destroyer; jogador dispõe dos quatro tipos. Não altera decisões terrestres.

## Loop, manutenção e Save

Construção/IA naval ocorrem após activation, antes de naval AI/movimento/combate/recovery. O navio concluído entra na manutenção naval normal no mesmo tick, sem custo de manutenção paralelo. Reparo continua baseado exclusivamente no portLevel; nenhuma fórmula de dano, reparo ou combate foi modificada.

Save V3 persiste níveis, upgrades, duração/progresso, fila, target e contador. Não persiste catálogos/graph. Saves antigos sem `construction` mantêm ausência do campo, sem respawn de shipyards ou cobranças ao carregar; o jogador pode construir seu primeiro shipyard. O namespace `save.naval` é validado por `readNavalSave`, preservando o catálogo terrestre do validador militar. A fronteira rejeita inland shipyard, níveis inválidos, tipos desconhecidos, IDs duplicados/contador atrasado, filas acima de cinco e progresso inválido.

## Performance e validação

Indexes por province/country/porto, portas ocupadas e níveis evitam Country × Province × Queue. O tick percorre filas existentes, uma produção por porto, sem geometry/Dijkstra. Profiler dev-only: fase `navalConstruction`, contadores `activeNavalBuilds`, `queuedNavalBuilds`, `completedShips`, `shipyardUpgrades`, acumulados e resetados por janela.

`npm run benchmark:naval-construction` mede 0, 20, 50 e 100 encomendas, cinco por porto, 20 aquecimentos e 100 amostras por caso. Reporta mediana, p95, média e chamadas de pathfinding, sem thresholds dependentes da máquina. Resultado: `artifacts/naval-construction-v1-1-benchmark.json`.

Medição local (Windows, Node v26.8.2; valores em ms por chamada):

| Encomendas | Tick: mediana / p95 | IA: mediana / p95 |
|---:|---:|---:|
| 0 | 0,0418 / 0,0688 | 1,0293 / 1,4182 |
| 20 | 0,0590 / 0,0852 | 1,3576 / 1,5863 |
| 50 | 0,0431 / 0,0507 | 1,0696 / 1,3931 |
| 100 | 0,0454 / 0,0725 | 0,4417 / 1,0441 |

Todos os casos tiveram zero chamadas de pathfinding. Filas ocupadas fazem a IA pular portos, portanto mais encomendas não implicam mais decisões pagas. São medições locais, não garantias de tempo.

`npm run smoke:naval-construction` valida New Game BRA, pagamento de Destroyer, progresso x3 por dias reais, entrega na 1ª Frota e bloqueio de Cruiser no nível 1. A segunda etapa usa fixture explícita de recursos/progresso para validar upgrade, Cruiser e Save V3/reload sem esperar outros 180 dias. Resultado: `artifacts/naval-construction-v1-1-browser.json`.

Regressões cobrem custos, unlocks, captura, eliminação, zero refund, alvo/fallback, determinismo, IDs, activation, AI budget/caps, manutenção, schema e save/load real, UI e profiler. A suíte V1 continua verificando combate, reparo, movimento, activation e mundo 201/494.

## Limitações

Validação final: 76 regressões novas; 2.044 testes em 83 arquivos. Lint, typecheck, suíte com `--maxWorkers=2`, build e `git diff --check` passaram. Build mantém o aviso de bundle maior que 500 kB. Não houve commit nem push.

Sem invasão anfíbia, Army transport, convoy/trade naval, bloqueio, range, submarinos, carriers, admirais, doctrines/tech tree, air warfare, world wrap ou mudanças de peace conference. Sem reembolso, importação de recursos automática ou perseguição de frota para entrega. Balanceamento inicial simples e não histórico; estoques locais e renda variam durante a campanha.
