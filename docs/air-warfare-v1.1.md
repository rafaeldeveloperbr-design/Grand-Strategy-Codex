# Air Warfare V1.1 — produção e controle direto

## Auditoria e contratos reutilizados

Foram auditados AirState/Wing/Base/Zone, aircraft config, AI, missões, combate,
range, rebase, replacement, Save V3, GameMap/input/right-click, Army/Fleet markers
e entry points de seleção, ProvincePanel, recruitment/building queues,
Naval Construction, Simulation Activation e ToastContext.

A extensão preserva Wings agregadas de 24 aeronaves, quatro tipos, 56 AirZones,
83 AirBases, 66 Wings iniciais e 38 países com forças aéreas. Reutiliza
`assignAirMission`, `rebaseAirWing`, `canUseAirBase`, range, emergency evacuation,
camera/Locate/F e bounds/culling V1. O helper naval de pagamento local foi
exportado como `payLocalProductionCost` e é compartilhado, com filas separadas.
Não existe novo estoque nacional ou sistema de notificações. FULL/PASSIVE vem
do snapshot de activation existente; feedback usa os toasts atuais.

## Produção, custos e capacidade

`AirState.production` é opcional, com `queues` por provinceId e `nextId`.
Cada AirBase permite cinco encomendas FIFO; somente o primeiro item avança
um dia/tick. Todos os tipos podem ser produzidos. A Wing entregue nasce READY,
sem missão, com 24/24 aeronaves, strength/org 100, owner e base produtores.

| Wing | Ouro nacional | IRON local | TOOLS local | Dias |
|---|---:|---:|---:|---:|
| Fighter | 240 | 24 | 12 | 120 |
| CAS | 300 | 30 | 15 | 150 |
| Bomber | 480 | 48 | 24 | 240 |
| Transport Plane | 360 | 36 | 18 | 180 |

Configuração central: `src/data/aircraft.ts`. Ouro e tempos seguem o pedido.
IRON/TOOLS foram reduzidos pela metade para acompanhar a economia existente:
estoque inicial local de referência 20/15; Destroyer custa 180 ouro, 18 IRON,
8 TOOLS e 120 dias. Fighter continua mais caro; estoque inicial pode exigir
produção/comércio antes de encomendar. Não há importação automática.

Pagamento é atômico ao encomendar. Falha não modifica recursos/fila. Só o
owner da Province pode produzir: aliança/acesso militar não permitem gastar
estoque do host. Cancelamento não reembolsa. Captura/eliminação cancelam ordens
antigas sem transferi-las. Cleanup ocorre antes do progresso e após mudanças
territoriais do tick; emergency evacuation V1 permanece intacta.

Opção B: encomendas podem ser pagas com base cheia; chegam a 100% e aguardam
slot. Ocupação inclui Wings presentes e reservas de rebase. Não há entrega
em over-capacity; itens posteriores não ultrapassam o head bloqueado. Após
liberação, entrega uma vez; o próximo item começa no dia seguinte.
Replacement permanece separado, sem nova cobrança de produção na entrega.

IDs: `air-build-N` e `wing-air-build-N`, contador persistente aumentado na
encomenda, preservado após cancelamento/conclusão/destruição. Sem RNG/relógio.
Nomes produzidos incluem `Wing N`, distinguindo forças iniciais.

Aircraft Production fica compacta na aba Militar da ProvincePanel: nível,
capacidade com rebase, estoque, quatro botões com custos/tempo, fila/progresso,
dias e cancelamento. Bloqueios explicam ouro/IRON/TOOLS, fila cheia, base ausente
e falta de controle. Item concluído bloqueado mostra “Aguardando capacidade”.

## IA e Save V3

Só FULL inicia; player/PASSIVE não recebem decisões. Ordens pagas continuam
globalmente. IA reserva 1.000 ouro, exige renda maior que despesa, gasta no
máximo 10% do tesouro/dia e encomenda no máximo uma Wing por país/dia.
Não inicia em base cheia ou já com fila. Cap conta Wings existentes e ordens:
menor entre slots próprios, `max(1, floor(income/5))`, seis em paz/doze em guerra.
Fighter primeiro para reconstrução/perda de superiority; CAS depois do primeiro
Fighter e com batalhas terrestres; Bomber limitado a um em paz/dois em guerra.
Transport nunca é produzido pela IA. Países são processados por tag para IDs
determinísticos. Estoques locais e orçamento são validados pelos mesmos helpers
do jogador.

Save V3 persiste filas, progresso/duração e contador aditivamente. O contrato
garante que todos os itens são pagos; não é necessária flag `paid`.
Load não cobra, reembolsa, avança, entrega ou duplica Wings. Save V1 sem
`production` mantém ausência do campo e semântica de fila vazia. Validação
rejeita tipos/bases/owners inválidos, filas >5, progresso inválido, IDs duplicados
e contador atrasado, incluindo colisões com Wings já entregues.
Rebase mid-transit mantém seu contrato Save V3 existente.

## Markers, seleção e comandos

AirWing markers sempre aparecem, discretos no modo normal e destacados no Air
Mode. AirBase markers/overlays permanecem somente no Air Mode. Culling por
viewport e bounds pré-gerados são preservados; pan não parseia geometry.
Index de Wings por base evita scans por Province. Wings na mesma base ficam
lado a lado, com offsets distintos, e podem ser escolhidas na lista do painel.
Hit target transparente com `pointer-events=all`, texto decorativo sem eventos,
Enter/Space e mouse-down que não inicia pan tornam o marker clicável.

Wing click seleciona, limpa seleções incompatíveis, liga Air Mode, abre painel
e destaca sua zona atual/home. Army/Fleet desligam Air Mode e cancelam alvo,
incluindo marker/list/panel/multisseleção. `exitAirSelection` centraliza eventos
locais e efeitos observam seleções externas. Locate battle terrestre também
sai do modo; markers de batalha continuam decorativos V1. Naval Mode permanece
independente; o botão manual Air Mode continua funcionando.

Ações principais: Fighter → Air Superiority/Interception; CAS → Close Air
Support; Bomber → Bombing; todos → Rebase no mapa. Transport não possui missão.
Controles V1 por lista continuam como opção secundária recolhida.

Missão abre target mode: “Botão direito em uma província para selecionar a
região aérea.” Province → `airZoneByProvinceId` → valida tipo/range/acesso →
atribui missão. Rebase usa Province → AirBase, valida base própria/aliada/acesso
militar, capacidade/reservas, status e destino diferente, e inicia timed rebase.
Clique esquerdo na Province/overlay/base também é aceito. `resolveAirTarget`
é comum aos comandos do mapa, listas e testes. Permissões de targets neutros
seguem V1; não foi criada nova regra diplomática de missão.

O SVG intercepta contextmenu na fase capture antes de handlers navais:
Army move, Fleet return/interception e SeaNode orders não disparam durante alvo
aéreo. Sucesso encerra target mode; erro específico mantém o alvo.
Depois, direito volta ao fluxo normal. Escape, fechar painel, outra Wing,
Army/Fleet, cancelar missão, cancelamento explícito e toggle manual limpam alvo.
Sem alvo, Province click segue comportamento normal mesmo com overlay.
Alt+clique inspeciona AirZonePanel. O painel V1 foi preservado; separar sua lista
em FRIENDLY/ENEMY/NEUTRAL ficou como melhoria secundária futura.

Feedback cobre produção iniciada/concluída/cancelada, missão atribuída,
“AirZone fora do alcance desta AirWing.”, base ausente, falta de acesso,
capacidade/reservas e rebase iniciado/concluído, incluindo comandos por lista.

## Tick, profiler e benchmark

`airProduction` roda após naval construction e antes das decisões aéreas/
movimento. Profiler dev-only: fase própria e contadores `activeAirBuilds`,
`queuedAirBuilds`, `completedAirWings`, `waitingAirBuilds`, reiniciados por janela.
Desligado é inerte. Produção percorre somente entradas de bases com fila,
prepara indexes lineares de owner/país/ocupação e processa apenas um head/base.
Não há produto AirBase × Countries ou AirWing × Provinces, pathfinding ou
geometry na entrega; bases vazias não são percorridas no tick de produção.

`npm run benchmark:air-v11`: 20 warmups/100 amostras, sem threshold da máquina.
Artefato: `artifacts/air-warfare-v1.1-benchmark.json`. Médias locais em ms:

| Cenário | Média |
|---|---:|
| 0 bases com fila | 0,0020 |
| 20 bases com fila | 0,0544 |
| 50 bases com fila | 0,0475 |
| Markers normal, 66 Wings | 1,0219 |
| Markers Air Mode, 66 Wings | 1,9092 |
| Dispatch direto | 0,0027 |

Markers são renderização React SSR, sem browser paint. A diferença entre
20/50 filas reflete variação/JIT local; números não são garantias de performance.
Chrome mede x3/zoom/pan separadamente: média do maior gap por amostra 300 ms com
Air Mode e 305,5 ms normal. Persistem frames longos na simulação mundial;
não se afirma que microstutter global foi resolvido.

## Validação final e arquivos

**101 regressões adicionais; 2.356 testes em 91 arquivos passaram.**
Lint sem avisos, typecheck, suíte `--maxWorkers=2`, build e diff whitespace check.
Build mantém o aviso de bundle >500 kB; testes mantêm o aviso experimental de
localStorage do Node. Nenhum erro de validação.

`npm run smoke:air-v11` passou no Chrome headless, sem exceções: New Game BRA,
marker no modo normal, clique real via CDP no hit target SVG, quatro missões por
direito, range/Escape, Army/Fleet auto exit, base/military UI, combate/CAS/bombing,
timed rebase/save/load e x3/pan/zoom. Produção inicia pela UI após fixture explícita
de estoques via save público e avança tempo real. Fixture de progresso 119/120
evita esperar 120 dias e valida entrega única e nova Wing no modo normal.
JSON/screenshot: `artifacts/air-warfare-v1.1-browser.{json,png}`.
O smoke V1 foi atualizado para Alt+clique na inspeção de zona.

Principais arquivos: `engine/air/{production,commands,save,index}.ts`,
`data/aircraft.ts`, `types/air.ts`, `hooks/useGameLoop.ts`, profiler,
`App.tsx`, `GameMap/{GameMap,AirLayer}.tsx`, `AirWingPanel.tsx`,
`ProvincePanel/{ProvincePanel,ProvinceAirProduction}.tsx`, `styles/air.css`,
testes `airProductionV11`, `airUIV11`, `airSaveV3`, scripts/artefatos V1.1 e
export do helper de pagamento em `engine/naval/construction.ts`.

## Limitações preservadas

Transport continua sem missão operacional. Bases permanecem estáticas, sem
novos upgrades. Fila em base cheia espera o jogador mover uma Wing ou cancelar.
IA tem regras/caps simples; balanceamento pode ser ajustado no catálogo.
Sem Battle System V3, drones/mísseis/SAM/radar/fuel, carriers/naval aviation,
paratroopers/airborne transport, tech tree/design/variants, aces/commanders,
strategic bombing overhaul, air War Score, Blockades, Naval Range, World Wrap,
Notification UX V2 ou Army Panel layout polish. Fórmulas V1 foram preservadas.

Não foi feito commit ou push.
