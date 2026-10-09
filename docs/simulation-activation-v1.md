# Simulation Activation V1

## Modelo e escopo

`SimulationTier` tem somente `FULL` e `PASSIVE`. Os 201 Countries e 494 Provinces continuam no estado e na renderização, com os mesmos owners, território, cores e interações. PASSIVE suspende **novas decisões estratégicas**; não congela a economia nem processos iniciados.

`src/engine/simulationActivation.ts` é a fonte central das regras. `buildSimulationActivation` retorna `fullCountryTags`, `tierByCountry`, motivos por país, ranking e contagens agregadas. Não escreve nos argumentos, não usa random, relógio, cache persistente ou estado de módulos. Seu custo é linear em províncias, tropas, guerras e relações, mais a ordenação de Countries: `O(P + regiments + W + R + proposals + C log C)`. Índices de Country e Province, população, holdings e tropas são efêmeros.

## Quem fica FULL

- O `playerCountryTag`, incluindo AND, TUV e MCO, sempre.
- Atacante e defensor de cada War ativa. Aliados de campanha são representados pelo sistema existente como novos pares de War e também entram.
- Vizinhos terrestres de Province **atualmente owned** pelo player, usando somente `neighbors` existente. Não existem conexões marítimas inferidas.
- Relações diretas com o player: guerra, alliance, military access, guarantee, NAP não expirado, proposals e calls pendentes. Opinião/trust neutros ou altos, sozinhos, não ativam.
- Destinatários de proposals externas pendentes ficam FULL antes da resposta estratégica. Calls também ativam o remetente. Isso permite que um FULL interaja com um país antes PASSIVE.
- Country com faction `active`; governos/origens envolvidos; rebel army relevante e seu host/original owner; território rebelde legado com `originalOwner`. `Army.originalOwner` sozinho **não** indica rebelião: os exércitos iniciais normais também usam esse campo.
- As 24 potências de maior score, excluindo o player do limite. Configurável pelo argumento `strategicPowerCount`; padrão `DEFAULT_STRATEGIC_POWERS = 24`.

Sem `date`, o helper considera os acordos/proposals fornecidos como pendentes. O game loop sempre fornece a data e ignora NAPs/proposals expirados; o lifecycle diplomático continua executando a expiração global normalmente.

## Strategic power score

```text
score = ownedPopulation / 100000
      + max(0, dailyGrossGoldIncome)
      + max(0, availableManpower) / 1000
      + currentArmyRegimentStrength / 1000
      + 10 * currentOwnedProvinceCount
```

População e holdings são agregados a partir de `Province.owner` atual, não de uma lista territorial inicial. Tropas vêm dos regimentos atuais. Economia e manpower vêm do Country atual. Empates usam comparação ordinal de tag, independente do locale. Countries anexados não ocupam vagas no ranking; o jogador continua FULL mesmo nessa situação.

Esse score existe somente para ativação. Não modifica recursos, dificuldade, fórmulas de gameplay ou AI balance. O ranking é recalculado uma vez por activation pass: antes da política e duas vezes dentro da AI para observar as mudanças diplomáticas e a resposta a rebeliões. Não há hysteresis: posições próximas da 24ª vaga podem alternar quando o estado muda.

## Integração e ordem

A ordem dos sistemas do game loop permanece:

```text
economy -> politics -> unrest -> diplomacy/technology
-> AI -> movement -> battle arrival -> continuous battle
-> war resolution -> rebellion -> cleanup -> publication
```

Antes de `processPoliticalTick`, uma avaliação central restringe somente a escolha proativa de novas policies/leis. Aprovação, legitimidade, estabilidade e ganho de capital político continuam para todos, com a cadência anterior. Isso cobre a IA política que existe fora de `processAiTick`.

Dentro de `processAiTick`:

1. Activation antes da diplomacy AI.
2. Diplomacy AI: respostas pendentes continuam; maintenance/iniciativas só para FULL bots, na ordem anterior. Destinos possíveis e o índice diplomático continuam mundiais.
3. Resposta a rebeliões, na posição anterior.
4. Activation novamente, com Wars/relations/armies/Countries atualizados.
5. Snapshot de logística usado pela AI pede redes somente para FULL, mas mantém todas as províncias, relações, hosts de acesso e Wars. A logística de economy, movement, combate e UI não muda.
6. Economic AI e military AI somente para FULL bots, preservando a ordem relativa dos Countries. Player mantém seus comandos próprios.
7. Fusão automática somente para FULL bots, para não substituir/limpar ordens de exércitos PASSIVE. IA rebelde/separatista continua no lugar anterior.

Um call aceito cria Wars antes da segunda avaliação e das decisões militares do mesmo tick. Declarações por ações do jogador entram no snapshot seguinte. Novos calls/proposals criados durante maintenance tornam seus destinatários FULL na segunda avaliação; são respondidos no ciclo seguinte, como antes.

PASSIVE não inicia construção, recrutamento, lei, pesquisa/foco novo nem ofensiva/repositioning/proposal/guarantee proativo. Nenhuma fila ou ordem existente é cancelada por tier.

## Economia, tecnologia e território

`processEconomyTick`, `processDiplomacyTechTick` e `processMovementTick` continuam globais. Isso preserva população, produção, mercado, consumo, stocks, manutenção, buildings, construction/recruitment existentes, army recovery e progresso de pesquisa/foco. Não foi criada economia alternativa.

`transferProvince` permanece intacto. A próxima avaliação lê owners atuais e detecta as novas fronteiras. Não há cache de vizinhança por owner a invalidar. Combat, scheduler, game speed e fórmulas não foram alterados.

## Save/load e UI

Save continua V3; nenhum campo de tier/cache foi adicionado. Load restaura `technology.player.countryTag`, estado mundial e militar. O próximo AI tick deriva activation desse estado. Round-trip é coberto por teste. Mapas e Country Selection recebem as coleções completas; tiers não mudam a aparência nem criam painel.

## Profiler

Somente profiler habilitado em desenvolvimento registra:

```text
simulationActivation: totalCountries, fullCountries, passiveCountries,
  player, strategicPowers, warCountries, neighborCountries,
  relationCountries, rebellionCountries, duration
activeBotsProcessed, passiveBotsSkipped
```

`duration` no relatório do game loop soma as três avaliações: política e as duas da AI. No profiler isolado de AI, soma as duas avaliações de `processAiTick`. A fase AI `simulationActivation` mede somente essas duas; o custo da avaliação anterior já está incluído na fase `politics`, sem dupla contagem. Contagens de motivos podem sobrepor-se e não devem ser somadas para obter FULL. `player` é a contagem do motivo player (normalmente 1). O AI breakdown e o relatório de 60 ticks incluem os dados da avaliação final. Não há logs por Country. Profiler desabilitado não consulta relógios.

## Equivalência e limitações

Fixtures congeladas do Performance Pass V1 em `src/engine/__tests__/helpers/legacyActivation*` permitem comparar o fluxo antes/depois. Mundo somente FULL é comparado integralmente, incluindo IDs, decisões, filas, tecnologia, Wars e movimento. Mundo misto compara decisões econômicas/militares dos FULL e custos/progresso das filas. Diplomacy AI com todos FULL é comparada em dias normais, maintenance e proposal cycle.

Os IDs existentes de novas filas incluem um ordinal baseado no comprimento **global** da fila. Ao omitir ordens PASSIVE, esse sufixo pode mudar em ordens FULL. Os testes mistos normalizam somente esse ordinal e comparam o restante integralmente; o gerador de IDs existente não foi alterado. Não há promessa de igualdade byte a byte do mundo misto inteiro.

Os critérios, scoring, custos, rotas, cooldowns e limites diplomáticos permanecem iguais. A competição pelo limite global de proposals pode mudar quando iniciativas PASSIVE desaparecem; interações futuras também podem divergir como consequência da menor quantidade de decisões globais. Não se pode garantir uma trajetória mundial idêntica ao baseline que executa todos os bots. A supressão de iniciativas é a diferença intencional desta V1.

PASSIVE não reage a qualquer relação neutra distante. Respostas externas, guerra, rebeliões, fronteiras e player ties ativam quando relevantes. O conjunto pode crescer livremente em guerras extensas, sem teto artificial de FULL.

## Benchmark e validação

Executar `npm run benchmark:simulation-activation`. O script usa 9 amostras e 3 warmups, alterna a ordem before/after, clona estados independentemente e mede o fluxo completo de AI com profiler ligado. Cobre USA, BRA, AND, TUV, campanha com vários participantes e conquista real de uma Province francesa que cria fronteira com DEU. Cada cenário inclui dia normal e ciclo diplomático. Também mede activation isoladamente.

Resultados detalhados em `artifacts/simulation-activation-v1-benchmark.json`. Medições são Node/Vite SSR nesta máquina, não browser real nem scheduler. Não há threshold funcional dependente de hardware.

Medição final em 2026-10-08: Intel Core i5-13500T, Node v26.8.2, 9 amostras, 3 warmups. Medianas em ms; `antes -> depois` compara os dois fluxos no mesmo estado inicial.

| Cenário | FULL/PASSIVE normal | FULL/PASSIVE ciclo | processAiTick normal | Economic AI normal | Military AI normal | Activation isolada |
| --- | --- | --- | --- | --- | --- | --- |
| USA | 25/176 | 26/175 | 236.84 -> 99.57 | 175.18 -> 74.72 | 10.42 -> 2.10 | 0.412 |
| BRA | 31/170 | 31/170 | 241.61 -> 106.06 | 175.64 -> 80.69 | 11.73 -> 2.78 | 1.216 |
| AND | 25/176 | 26/175 | 249.69 -> 104.28 | 181.91 -> 79.68 | 11.57 -> 2.79 | 0.828 |
| TUV | 25/176 | 26/175 | 248.57 -> 106.06 | 179.52 -> 81.38 | 11.82 -> 2.73 | 0.691 |
| Guerras, player AND | 34/167 | 35/166 | 269.48 -> 115.06 | 187.80 -> 86.52 | 14.80 -> 4.54 | 0.954 |
| Expansão, player AND | 27/174 | 28/173 | 255.96 -> 107.70 | 189.96 -> 83.68 | 12.01 -> 2.72 | 1.062 |

| Cenário | Diplomacy AI no ciclo | processAiTick no ciclo | Activation dentro do AI normal, duas avaliações |
| --- | --- | --- | --- |
| USA | 476.50 -> 160.24 | 719.21 -> 261.42 | 1.660 |
| BRA | 437.27 -> 144.97 | 674.35 -> 245.17 | 2.225 |
| AND | 444.81 -> 147.74 | 680.16 -> 249.63 | 2.094 |
| TUV | 438.55 -> 148.03 | 674.14 -> 250.02 | 2.087 |
| Guerras | 448.41 -> 152.25 | 691.45 -> 260.03 | 2.469 |
| Expansão | 468.04 -> 156.66 | 707.12 -> 259.20 | 2.289 |

A contagem do ciclo acima é a avaliação final, após diplomacy AI, não somente o conjunto inicial. Novas proposals ativam mais um destinatário em cinco dos seis cenários. A expansão aumenta o conjunto normal de Andorra de 25 para 27, mantendo o topology existente. O custo adicional da avaliação antes da política é registrado pelo profiler do game loop; este benchmark mede especificamente `processAiTick` e activation isolada, não a simulação diária inteira. Redução de `processAiTick` normal: aproximadamente 56–58%.

Os testes cobrem motivos, microstates, ranking dinâmico/determinístico, imutabilidade, território, gating das três IAs, guerra no mesmo tick, continuidade global, Save V3, Country Selection e renderização de todos os Countries/Provinces. A suíte original também valida combate, movimento, economia e saves.

A primeira execução da suíte completa com workers padrão (73) teve sete timeouts por contenção e uma expectativa legada de 200 bots, atualizada para verificar FULL/player/vizinhos/PASSIVE. Foi repetida com `--maxWorkers=2`, sem aumentar timeout.

Validação final: `npm run lint`, `npm run typecheck`, `npm run test:run -- --maxWorkers=2`, `npm run build` e `git diff --check` aprovados. São **1.775 testes em 73 arquivos**, com **38 casos novos**: 37 no arquivo de Simulation Activation e um de renderização mundial. Os testes adicionais de política e profiler entraram na última repetição integral, também aprovada. O benchmark final terminou com código 0. Nenhum commit ou push foi realizado.

## Próximos passos

Map Navigation UX V1, depois Naval Warfare V1. World Horizontal Wrap V1 permanece no backlog distante. Nenhum desses sistemas faz parte desta implementação.
