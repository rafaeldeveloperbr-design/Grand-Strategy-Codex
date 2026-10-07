# War Resolution V1

## Escopo e arquitetura

Um `War` representa um par hostil, não a campanha inteira. `campaigns.ts` agrupa os pares por `campaignId` (fallback: `id`). A raiz é o registro cujo `id` corresponde ao ID da campanha; quando não existe, usa-se o primeiro par em ordem lexicográfica de ID. Os líderes vêm da raiz. Participantes são derivados dos pares, sem listas persistentes redundantes. Contradições entre lados são detectadas; campanhas inconsistentes não recebem rendição automática nem paz branca até serem corrigidas. Um participante nunca aparece nos dois lados.

`campaignEnd.ts` centraliza o encerramento formal, compartilhado por paz branca e rendição: remove os pares da campanha, restaura relações a paz, grava `lastWarEndedAt` e remove propostas vinculadas à raiz ou aos pares. Uma relação permanece hostil se outra campanha ainda contiver aquele par.

`warResolution.ts` contém métricas, atribuição de estatísticas, settlement e tick. `warResolutionBalance.ts` centraliza pesos, escalas e thresholds. Não há conferência de paz nem sistema paralelo de ocupação.

## Controle territorial e capital

`Province.owner` continua sendo a verdade de controle. O território relevante de um líder reúne províncias cujo `originalOwner`, ou `owner` quando o campo original está ausente, corresponde ao país. A perda territorial é a fração desse conjunto controlada por outro país, independentemente do tamanho bruto do país. As arrays antigas de ocupação são apenas snapshots derivados, reconstruídos no tick; não orientam decisões.

Uma capital está ocupada se a província indicada por `capitalId ?? capital` existe e seu owner difere do país. A UI usa o nome da província. Capital desconhecida não recebe penalidade inventada.

Limitação deliberada de V1: `originalOwner` representa a linhagem territorial, não um snapshot do início de cada nova guerra. Territórios adquiridos em campanhas anteriores podem continuar relevantes para seu proprietário original. Um futuro baseline por campanha deve tratar essa diferença explicitamente, com migração própria.

## War Score

Para frações de perda `La`/`Ld`, indicadores de capital ocupada `Ca`/`Cd` e baixas agregadas dos lados `Ba`/`Bd`:

```text
score = clamp(50 × (Ld − La)
            + 25 × (Cd − Ca)
            + 25 × (Bd − Ba) / (Ba + Bd), −100, 100)
```

O termo de baixas é zero se nenhuma baixa foi registrada. Positivo favorece atacantes. Todos os pares recebem o mesmo score agregado. A duração é calculada pela data da raiz.

## Rendição

Somente líderes principais determinam a resolução. A força restante `R` soma strength real dos regimentos do país, ignorando valores negativos/não finitos e exércitos vazios. `B` são as baixas atribuídas àquele líder, não baixas de aliados.

```text
A = B / (B + R), ou zero quando ambos forem zero
M = B / (B + R), ou um quando ambos forem zero
surrender = clamp(60 × perdaTerritorial + 20 × capitalOcupada
                + 10 × A + 20 × M, 0, 100)
```

Ausência de força contribui com 20 pontos mesmo sem baixas anteriores. Capital sozinha não causa rendição. Existe uma regra terminal explícita: quando um líder válido não controla nenhuma província, sua rendição é 100, mesmo com tropas sobreviventes fora do país. Isso permite encerramento formal antes de cleanup descartar um país eliminado.

Threshold: 100. Se ambos atingirem o limite no mesmo tick, score positivo favorece o atacante; empate ou score negativo favorece o defensor. Campanhas são processadas por ID, uma vez por tick, considerando mudanças territoriais já realizadas por settlements anteriores naquele tick. Settlement também rejeita líderes ausentes e governos com rebeliões ativas, inclusive quando chamado diretamente.

## Baixas e Combat V2

O hook de combate observa deltas reais de strength por owner após `processBattleDay`. `ActiveBattle.warCasualtiesByCountry` retém esses deltas ao longo dos dias e de save/load, incluindo aliados, reforços e exércitos destruídos. Ao terminar a batalha, `recordBattleWarCasualties` atribui cada contribuição a um único par que contém o país no lado correto. Os counters legados são contribuições do país nomeado naquele par; nunca são copiados para todos os pares.

Prioridade da API: ledger real por país, detalhes de participantes com owner/loss, e totals por representante como fallback legado. A raiz mantém `recordedBattleIds`, impedindo repetição de resultado após replay/load. Batalhas sem campanha convencional correspondente são ignoradas. Se houver mais de uma campanha compatível, a primeira por ID recebe o resultado, deterministicamente.

Nenhuma estatística reaplica dano a exércitos ou população. O Combat V2 e `applyMilitaryCasualties` mantêm suas responsabilidades existentes. Batalhas encerradas administrativamente por paz não fabricam resultados militares.

Uma batalha legada em andamento sem ledger inicializa seus totals anteriores nos representantes de cada lado, pois a distribuição histórica por aliado não pode ser recuperada com segurança. Daquele ponto em diante, os deltas são precisos por owner. Baixas já perdidas em saves antigos não são inventadas retroativamente.

## Settlement territorial e aliados

Na rendição do líder derrotado:

1. Capturas já controladas pelo lado vencedor permanecem com o conquistador atual.
2. Províncias ainda controladas pelo líder derrotado são transferidas ao líder vencedor.
3. Territórios originalmente de membros válidos do lado vencedor, controlados pelo lado derrotado, retornam ao originalOwner.
4. Aliados derrotados saem da guerra, mas não são automaticamente anexados.

A regra é simétrica. Toda mudança usa `transferProvince`, preservando originalOwner, índices dos países, unrest e cancelamento de recrutamentos/construções. O líder sem território recebe `isAnnexed` conforme a convenção existente. `resolvePeaceBattles` libera batalhas sem hostilidade restante; `cancelInvalidDiplomaticRoutes` cancela rotas invalidadas. Nenhum resultado de batalha é fabricado pelo settlement.

## Rebellion V2 e ordem do tick

Campanhas com participantes `rebel_` não recebem surrender diplomático. Líderes com uma rebelião ativa também ficam protegidos de settlement automático, preservando os objetivos próprios do governo/rebelião.

Ordem do loop:

1. Economia, política, unrest, diplomacia/pesquisa e decisões de IA existentes.
2. Movimento e chegada de batalhas.
3. Combate contínuo, baixas e transferências territoriais reais.
4. War Resolution: score, surrender, settlement, liberação de batalhas e rotas.
5. Objetivos e lifecycle de Rebellion V2; condições de fim de jogo.
6. Cleanup diplomático e publicação do estado final nas refs/UI/save.

Unrest não apaga antecipadamente países sem território enquanto ainda participam de guerra; o lifecycle canônico recebe a oportunidade de resolvê-los. O score provisório por número bruto de províncias foi removido de `diplomacyTechTick`.

## IA e UI

A IA usa a API canônica para adotar postura mais cautelosa se o score do seu lado for −50 ou menor, ou a rendição de seu líder atingir 60%. Nessas condições, a decisão existente de esperar reforços usa proporção de ataque 1,5 em vez de 1,2. Não há negociação automática nova nem paz diplomática para guerra civil.

WarPanel mostra uma campanha por card, líderes e participantes amigáveis, score −100..100, progresso dos dois líderes, capital, controle territorial, baixas agregadas e duração. A barra inferior também conta campanhas. Paz branca envia um par do qual o jogador participa, preservando autorização do hook existente. Guerras civis exibem sua resolução por objetivos e bloqueiam paz branca. Ajustes de CSS são locais ao painel existente.

## Save/load

`CURRENT_VERSION` permanece 3. Os dois campos persistentes adicionais são opcionais e aditivos: `War.recordedBattleIds` e `ActiveBattle.warCasualtiesByCountry`. Não substituem nenhuma estrutura existente; sua ausência tem fallback explícito. Por isso não é necessária uma migração estrutural/V4. O serializer existente preserva os campos por inteiro. V1/V2 continuam passando pelas migrações atuais, e V3 antigo continua legível.

Score, surrender, participantes e controle territorial não ganham campos persistentes próprios. Score e snapshots legados são recalculados no primeiro tick; surrender é sempre derivado. Testes cobrem V1, V2, V3 anterior aos ledgers e round-trip com os novos campos, inclusive deduplicação após reload.

## Arquivos e testes

Criados: quatro módulos `src/engine/diplomacy/{campaigns,campaignEnd,warResolution,warResolutionBalance}.ts`, testes `src/engine/__tests__/{warResolution,warResolutionSave}.test.ts`, `src/components/__tests__/WarPanel.test.tsx` e este documento.

Alterados: `src/App.tsx`, `src/components/WarPanel.tsx`, `src/styles/diplomacy-war.css`, `src/engine/diplomacy/{index,diplomacyWar}.ts`, `src/engine/aiEngine/aiMovement.ts`, `src/hooks/useGameLoop.ts`, `src/hooks/gameLoop/{battleContinuousTick,diplomacyTechTick,unrestTick}.ts`, `src/types/{army,battle,diplomacy}.ts`.

67 novos testes: 53 de engine/campanha/combate, 10 de UI e 4 de save. As suítes existentes de declareWar, guarantees, call ally, paz branca, Movement Commands V2, Combat V2, transferência territorial e Rebellion V2 continuam exigidas integralmente. Não há testes de pixels exatos nem regressões silenciadas.

## Limitações e dívida futura

Não inclui conferência de paz, reparações, puppets, negociação por pontos ou rendição individual de aliados. A força usa casualties e força atual como aproximação de desgaste, sem baseline militar inicial. Destino dos exércitos sobreviventes de um país anexado mantém a semântica atual do jogo.

O Battle System será revisitado: estruturas de gerações anteriores e atuais ainda coexistem, inclusive relatos agregados por representantes. V1 consome resultados existentes e acrescenta somente o ledger estatístico necessário; não refaz regras de batalha. Futuro trabalho deverá tratar distribuição histórica de baixas legadas, campanhas simultâneas entre os mesmos países, baseline territorial por guerra e negociação territorial mais rica.
