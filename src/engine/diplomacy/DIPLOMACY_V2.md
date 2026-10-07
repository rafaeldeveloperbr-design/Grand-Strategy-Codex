# Diplomacy V2

Implementada na branch `feat/Diplomacy-V2`, sem commit ou push.

## Auditoria e substituição do legado

Antes da implementação foram inspecionados os tipos diplomáticos, motor antigo,
App, refs, hook de ações, painel diplomático, painel de guerra, ticks de
diplomacia/IA/movimento/anexação/rebelião, helpers de IA militar, Military V2
movementEngine, registros de guerra/batalha, territoryTransfer, saves e testes.

Problemas encontrados:

- `getOrCreateRelation` retornava uma relação nova sem inseri-la no estado.
- Não havia normalização canônica nem proteção contra declarações duplicadas.
- `status` misturava paz/guerra com aliança e pacto; acordos não podiam coexistir.
- Pacto era aceito automaticamente, comprado com ouro, com aumento de opinião.
- Melhorar relações era uma compra repetível de opinião.
- Opinião >= 80 concedia passagem militar implicitamente; a verificação estava
  duplicada no movimento militar e nos helpers de IA.
- Guerra não validava identidade, países existentes, aliança ou NAP no motor.
- UI declarava guerra com um clique e usava `console.log` como feedback de ações.
- Guerra/paz atualizavam registros separadamente, sem tratamento de participantes.
- Encerrar guerra não liberava os exércitos presos em batalha.

Removidos `src/engine/diplomacy.ts` e sua suíte legada
`src/engine/__tests__/diplomacy.test.ts`. Foram substituídos integralmente os tipos
de ações/custos, a compra de relações, o pacto antigo, o hook e o painel antigos.
Não existe um segundo motor diplomático executável. Nomes antigos de status e
`pactDaysRemaining` aparecem somente na migração e nos fixtures de saves antigos.

## Arquitetura e inventário

Novos módulos em `src/engine/diplomacy/`:

| Arquivo | Responsabilidade |
| --- | --- |
| `diplomacyTypes.ts` | Contexto e resultado tipado das operações |
| `diplomacyBalance.ts` | Requisitos, penalidades, durações, cooldowns e parâmetros da IA |
| `diplomacyRelations.ts` | Chave canônica, criação, consulta, clamps, opinion/trust e faixas |
| `diplomacySelectors.ts` | Guerra, aliança, NAP, acesso, aliados, garantidores e países válidos |
| `diplomacyActions.ts` | Validação, propostas, resposta, ruptura, acesso e garantias |
| `diplomacyWar.ts` | Declaração, campanhas, chamadas, garantias defensivas e paz branca |
| `casusBelli.ts` | Geração e consulta de CB de conquista |
| `diplomacyAI.ts` | Decisões determinísticas e processamento diplomático da IA |
| `diplomacyLifecycle.ts` | Expiração, limpeza, cancelamento de rotas e liberação após paz |
| `diplomacyMigration.ts` | Normalização da fronteira unknown e conversão de saves |
| `diplomacyInitialization.ts` | Relações iniciais do cenário |
| `index.ts` | API pública |
| `DIPLOMACY_V2.md` | Arquitetura, migração, auditoria e relatório |

Nova suíte: `src/engine/__tests__/diplomacyV2.test.tsx`.

Arquivos alterados:

- `src/types/diplomacy.ts`: schema único V2 e metadados opcionais de campanha/CB
  nos registros militares de guerra.
- `src/App.tsx`: inicialização de relações, contexto do painel e conexão das ações.
- `src/components/DiplomacyPanel.tsx`: painel V2 completo.
- `src/components/WarPanel.tsx`: paz branca de campanha e bloqueio de paz civil.
- `src/styles/diplomacy-war.css`: apresentação V2.
- `src/hooks/app/useDiplomacyActions.ts`: execução, refs imediatas, feedback,
  propostas recebidas, chamadas e encerramento de batalhas após paz.
- `src/hooks/gameLoop/diplomacyTechTick.ts`: expiração via V2.
- `src/hooks/gameLoop/aiTick.ts`: processamento diplomático e notificações de propostas.
- `src/hooks/useGameLoop.ts`: limpeza após combate/transferências/rebeliões, antes
  de publicar estado na UI e refs de save.
- `src/engine/saveSystem.ts`: migração e versão de schema diplomático.
- `src/engine/military/movementEngine.ts`: apenas a consulta de permissão passa
  pelo selector V2; algoritmo de rotas, avanço e terreno não foram reescritos.
- `src/engine/aiEngine/aiHelpers.ts`: acesso e hostilidade usam selectors comuns.
- `src/engine/rebellion/rebellionEngine.ts` e `src/engine/rebellions/rebelAI.ts`:
  apenas conexão do conflito interno ao novo motor e retirada do campo legado.
- `src/engine/rebellion/rebellionAI.ts`: somente adaptação dos registros locais de
  passagem rebelde aos tipos novos; objetivos, IA, acumulação e balance mantidos.
- Fixtures de regressão em `campaignMovement.test.ts`, `mapRouting.test.ts`,
  `helpers/southAmericaAudit.ts`, `southAmerica.test.ts` e `rebellionV2.test.ts`:
  acordos explícitos, trust e assertions independentes da ordem canônica.

## Fonte de verdade e relação canônica

O estado React existente `diplomaticRelations` contém **somente relações V2**.
A lista foi mantida para preservar integrações com a engine, mas a identidade
é `relationKey(a,b) = JSON.stringify([a,b].sort())`; toda escrita passa por
`updateRelation`, que remove duplicatas e normaliza `countryA/countryB`.
Não existem entradas direcionais A→B/B→A independentes.

Todos os dados persistentes do par residem nessa relação: opinião, trust,
acordos, concessões direcionais, CBs, propostas, cooldowns, última paz e último
rompimento de NAP. Consultas não precisam criar relações; getters ausentes têm
defaults neutros. `createRelation` cria um valor puro, sem efeitos escondidos.

Opinião e trust são simétricos nesta versão. Opinião é limitada a -100/+100;
trust a 0/100, com valor neutro 50. `getOpinion`, `setOpinion`, `changeOpinion`,
`getTrust`, `setTrust`, `changeTrust` e `updateRelation` centralizam os limites.
As faixas são Hostil (-100/-75), Muito desconfiado (-74/-40), Desconfiado
(-39/-10), Neutro (-9/+9), Cordial (+10/+39), Amigável (+40/+69), Muito amigável
(+70/+100). Não há decay periódico.

Novas partidas usam um seed **de balance do cenário**, sem pretensão histórica:
países com fronteira terrestre começam com opinião +40, demais +10, trust 50.
Isso permite experimentar acordos sem restaurar a compra legada de opinião.
Saves migrados preservam opinião útil/clampada; não recebem artificialmente o seed.

## Acordos e propostas

Aliança e NAP são campos simétricos independentes de `status: peace | war`.
Aliança exige opinião >= 40 e trust >= 50. NAP exige opinião >= 10 e trust >= 40,
com duração de 5×365 dias. Ambos podem coexistir.

`offerAlliance`/`offerNonAggressionPact` criam propostas persistentes;
`acceptAlliance`, `rejectAlliance`, `acceptNonAggressionPact` e
`rejectNonAggressionPact` respondem. Condições são revalidadas na aceitação.
UI do jogador recebe imediatamente a decisão determinística de países IA.
Propostas de IA ao jogador ficam pendentes por 30 dias, com aceitar/recusar no
painel do remetente e notificação no histórico do jogo. Cooldown de 90 dias
por país/par/ação é aplicado à oferta, inclusive se recusada.

Romper aliança custa -30 opinião/-25 trust; romper NAP custa -25/-30.
Expiração natural não aplica custo. Rompimento recente de NAP registra autor/data
e adiciona -15 opinião/trust à guerra durante 365 dias. Não há compra de relações.

## Acesso militar

`militaryAccess` armazena tags de **concedentes**: BRA na relação BRA/ARG significa
que BRA permite a entrada de ARG. A concessão inversa precisa de outra aceitação.
`requestMilitaryAccess(visitor,host)` cria pedido; `grantMilitaryAccess(host,visitor)`
aceita; `revokeMilitaryAccess(host,visitor)` remove somente sua concessão.
Requisitos: opinião >= 20, trust >= 40.

Aliança concede acesso automaticamente nos dois sentidos. Revogar uma concessão
explícita não remove o acesso derivado da aliança; para isso é necessário romper
a aliança. `hasMilitaryAccess` nunca retorna acesso pacífico entre inimigos.
`canEnterTerritory` separa esse acesso da entrada hostil necessária para combater.
Opinião elevada sozinha não concede acesso.

Pathfinding e execução de movimento usam o mesmo selector. A validação de rota
original do Military V2 já cancela trajetos inválidos durante o tick. Ações do
jogador também cancelam imediatamente rotas inválidas, inclusive com jogo pausado.
Não é implementada expulsão/teletransporte de um exército que já estava no exterior.

## Guerra, CB e agressão

`declareWar(context,attacker,defender,cbId?)` valida países distintos, existentes,
não anexados, com território e não rebeldes, guerra existente, aliança e NAP.
É necessário romper aliança/NAP antes de declarar normalmente.

`status` na relação é o estado diplomático consultado para acesso/hostilidade.
`War[]` permanece como registro operacional da engine militar: score, baixas,
ocupações, agressor, defensor e data. Uma única transição cria os dois juntos;
paz altera ambos, e limpeza reconcilia registros ao fim do tick. Na migração,
guerras militares existentes são preservadas e usadas para reconstruir relações,
enquanto flags antigas de guerra sem registro operacional são descartadas.

Declaração encerra acordos incompatíveis, cancela acesso e propostas entre os
inimigos, reduz opinião e trust. Sem CB: -70 opinião com alvo, -20 opinião global,
-20 trust. Com conquest CB: -50 com alvo, -5 global, -5 trust. Penalidades são
clampadas e afetam os países válidos; não há world tension, aggressive expansion,
penalidade econômica, prestige ou stability nova.

CB contém id, atacante, alvo, tipo, data, expiração e províncias opcionais.
`generateConquestCasusBelli` cria CB de conquista por 2×365 dias, valida propriedade
das províncias indicadas, impede duplicado ativo e usa cooldown. Geração é simples
e imediata: não há fabricação temporal, claims ou custo nesta base inicial.
Consulta verifica autor/alvo/validade; declaração consome o CB selecionado.
Tick remove expirados. `reconquest`, `liberation`, `humiliate` são tipos reservados;
a declaração justificada aceita apenas `conquest` nesta versão.

## Call to war e campanhas

O contrato militar de pares foi preservado. Registros relacionados compartilham
`campaignId`; não há duas guerras independentes para a mesma chamada.
Declaração chama aliados de atacante e defensor; `callAllyToWar` permite chamadas
posteriores pelo painel. Recipientes IA decidem no tick; jogador responde ao pedido.

Ao aceitar, o aliado enfrenta cada oponente do lado correspondente na campanha.
Entradas são idempotentes por par; quem já participa não recebe nova chamada.
Não é permitido participar de lados opostos ou violar aliança/NAP por chamada
voluntária. Nesses casos a chamada é recusada; opinião cai 10 e trust 15.
Recusa explícita ou silêncio por 30 dias aplica a mesma penalidade uma única vez.
Cooldowns impedem chamadas repetidas.

Paz branca encerra todos os pares da campanha, limpa chamadas pendentes e registra
`lastWarEndedAt`. Libera stacks de batalhas cujos lados não são mais hostis, sem
atribuir vencedor, novas baixas ou transferência territorial. Paz mantém as
transferências de propriedade já realizadas pela engine; não há termos avançados.
Guerras civis são resolvidas pelo Rebellion V2, não pelo botão de paz diplomática.

## Garantias

`guarantees` contém tags de garantidores, com direção independente. Exige opinião
>= 30 e trust >= 50, país válido e ausência de guerra contra o protegido.
`guaranteeIndependence`/`withdrawGuarantee` criam/removem a obrigação.

Ataque ao protegido aciona entrada automática do garantidor no lado defensor da
mesma campanha. Garantia é compromisso defensivo vinculante: acordos conflitantes
com o agressor são encerrados explicitamente com as penalidades de ruptura.
Não cria guerra duplicada. Situações em que o garantidor já combate o próprio
lado defensor não são forçadas, evitando participação nos dois lados.

## IA

Decisões determinísticas usam opinião, trust, poder (tropas + base provincial),
inimigo comum, campanhas existentes e posição atacante/defensor na chamada.
IA oferece alianças/NAP/acesso, aceita/recusa pedidos, garante amigos menores,
chama aliados e rompe alianças/NAP em relações extremamente hostis e sem confiança.
Acesso é recusado quando favoreceria inimigos de aliados/protegidos.

Propostas proativas ocorrem a cada 90 dias, com limite global de três novas
propostas por ciclo, incluindo ofertas entre bots e ao jogador. Candidatos são
ordenados por score determinístico de opinião, trust, fronteira, inimigo comum,
ameaça estratégica, vínculo político e utilidade de rota; empates usam tags/tipo.
Somente um acordo novo por par é selecionado, sem acumular tipos enquanto houver
proposta pendente. Cooldown de ofertas **iniciadas pela IA** é 180 dias por
país/par/ação. Requisitos proativos: aliança 60 opinião/60 trust, NAP 25/45,
acesso 35/50. Ofertas e aceitação de propostas iniciadas pelo jogador mantêm os
requisitos originais e cooldown de 90 dias.

Alianças exigem vizinhança, inimigo comum ou ameaça forte e hostil junto aos dois
países. NAP exige relevância geográfica/política, evitando ofertas redundantes
entre aliados. Acesso só é solicitado se atravessar o concedente reconectar
território próprio ou abrir passagem até um inimigo atual que não era acessível.
Essa consulta é somente de utilidade para a IA; o pathfinding militar é preservado.

A manutenção de garantias, chamadas e rupturas extremas mantém sua cadência
original de 30 dias; respostas a propostas continuam processadas diariamente.
Um marcador de ciclo no mapa existente de cooldowns preserva o teto global mesmo
após aceitação/recusa ou reload no mesmo dia. Não há mudança de schema ou migração
adicional de saves: cooldowns e propostas salvos anteriormente permanecem válidos.
Chamadas defensivas exigem trust 50; ofensivas 65;
força combinada e quantidade de campanhas limitam aceitação. Não foi adicionada
uma nova política de declaração de guerra à IA militar ou reescrita sua economia.
Fronteiras participam do seed inicial; difficulty/aggressiveness ainda não modificam
os parâmetros diplomáticos.

## Saves e países eliminados

O formato externo de save continua versão 2, com `diplomacy.version: 2` marcando
o schema interno. A estrutura de relações já percorre refs/save/load do jogo;
assim todos os campos V2 são serializados no mesmo lugar, sem store paralelo.
Ações publicam refs sincronamente para não perder o resultado em um save imediato.

`migrateDiplomacy` recebe unknown, normaliza pares, opinião/trust, campos opcionais,
propostas/CBs válidos e cooldowns. Saves V1 e V2 antigos passam pela migração.
Duplicatas A/B e B/A usam o primeiro registro de forma determinística; status de
guerra operacional tem prioridade. Aliança antiga vira campo, NAP antigo vira
data de expiração relativa ao dia salvo; opinião útil é limitada e trust começa
em 50. Compra de relações antiga e acesso inferido de opinião não são preservados.
Renomeação de facções rebeldes precede a normalização final de relações.

Limpeza ocorre após as transferências, batalhas e objetivos rebeldes, antes de
publicar o tick. Relações inteiras de países sem território/anexados/inválidos são
removidas, levando consigo acordos, acesso, garantias, CBs, propostas e cooldowns.
Não há dangling references em um par civil válido. Chamadas a guerras removidas
também são descartadas.

Facções `rebel_*` nunca podem usar acordos diplomáticos. Seus registros militares
de conflito e a passagem civil local são adaptadores de integração, não países
diplomáticos. Um governo temporariamente sem território em guerra civil ativa
mantém seu conflito para resolução pelos objetivos do Rebellion V2. País
restaurado com território e `isAnnexed: false` volta a ser elegível; não recupera
automaticamente os antigos acordos.

## Legado retido por integração

- O caminho público `../diplomacy` resolve agora para `diplomacy/index.ts`;
  não aponta para implementação antiga.
- `War[]` e seus campos militares foram preservados porque combate, ocupação e
  IA militar operam por pares. `campaignId` é aditivo, com fallback `war.id` nos saves.
- A engine existente `src/engine/rebellions/` e seus conflitos separatistas são
  preservados por escopo do pedido; somente sua chamada de guerra foi adaptada.
- Registros locais de passagem entre facções em Rebellion V2 receberam trust e
  concessão explícita para manter exatamente a possibilidade de movimento civil.
- Nomes de status/countdown antigos existem exclusivamente na fronteira de save
  e nos testes de migração. Não há ações, custos ou helpers legados em execução.

## Testes, regressões e inspeção

`diplomacyV2.test.tsx` contém 55 testes: identidade canônica, seed, clamps, faixas,
simetria, propostas/aceitação/recusa, requisitos, ruptura, NAP/expiração, acesso
direcional e movimento/revogação, garantias/conflitos, anexação/restauração,
CB/províncias/consumo/expiração, penalidades, campanhas/paz/batalhas, chamadas,
confiança, IA/poder/campanhas/cooldowns, saves V1/V2 e UI/ações/feedback/refs.

Regressões cobertas pela suíte completa incluem Military V2, Rebellion V2,
Terrain V1, South America V1, rotas, ocupação, conquista, transferência, supply,
economia, população, tecnologias, map modes, stacks e save/load.
Não foram alteradas geometria, topologia, balance militar/rebelde/terreno,
pathfinding, economia ou engine de resolução de combate.

Bugs/regressões corrigidos durante a integração: assertions que dependiam da
ordem A/B; fixtures que usavam opinião como acesso; publicação de guerras antes
da limpeza do tick; perda de conflito civil de governo temporariamente sem terra;
exércitos presos em combate após paz; chamadas repetidas para quem já participa.

A inspeção visual manual Brasil↔Argentina e do console não foi realizada:
`cua.createBrowserTab("iab", ...)` informou `Browser is not available: iab`, e
`cua.listBrowsers()` retornou `[]`. Os fluxos foram validados por testes de UI
em jsdom e testes de integração do motor; isso não substitui inspeção visual.

## Limitações e extensões futuras

Opinião/trust simétricos; CB de conquista imediato; aceitação IA simples; paz
branca sem termos ou negociação; guerras operacionais por pares agrupados em
campanhas; sem expulsão automática de tropas após revogação; garantias têm
prioridade defensiva sobre acordos com o agressor. Esses comportamentos são
deliberadamente pequenos e documentados.

Extensões possíveis: opinião direcional no mesmo par, geração temporal de CB,
política de guerra IA, mais parâmetros de dificuldade, negociação de paz,
histórico de campanhas e evasão de tropas após fim de acesso. Coalizões, sujeitos,
federações, sanções, espionagem, world tension, conferências de paz e multiplayer
não foram implementados.

## Validação final

Rebalance de spam da IA: a suíte `diplomacyAIProposals.test.ts` acrescenta cobertura
de teto global, score, empates determinísticos, cooldown de 180 dias, ausência de
spam mensal, requisitos proativos, relevância, utilidade de rota, saves/reload,
propostas pendentes e preservação das ações do jogador, garantias e calls.
Resultados desse rebalance são descritos no relatório da tarefa; os números abaixo
registram a implementação inicial da Diplomacy V2.

- `npm run lint`: passou, sem erros ou avisos.
- `npm run typecheck`: passou.
- `npm run build`: passou; 171 módulos transformados.
- `npm run test:run`: 31 arquivos, 446 testes aprovados, incluindo 55 da suíte V2.
- `git diff --check`: passou após retirar uma linha em branco extra no EOF de tipos.
- Inspeção visual/console: navegador integrado indisponível nesta sessão.
- Nenhum commit, push ou mudança de branch executados.
