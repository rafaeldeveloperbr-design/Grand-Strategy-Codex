# Army Transport + Amphibious Invasion V1

## Capacidade e estado canônico

`TRANSPORT_CAPACITY = 5.000` soldados por TRANSPORT vivo, centralizado em `src/engine/naval/transport.ts`. Dano de strength no navio não reduz vagas gradualmente: só destruição remove capacidade. TRANSPORTS somam capacidade; outros tipos não transportam tropas. A capacidade usada soma a strength real dos regimentos, inclusive exércitos parciais.

`Army.embarkedFleetId` é a única associação persistida. Não existe `Fleet.embarkedArmyIds` duplicando a relação. `buildTransportIndexes` deriva `byId` e `byFleet` em uma passagem. Army preserva id, owner, originalOwner, regimentos, originProvinceId, moral, organização, experiência e velocidade terrestre. Enquanto embarcado, `location`, `destination`, `targetDestination` e `position` ficam null; rota, progresso, movementPlan e target locks são limpos. A posição naval é consultada na Fleet; o Army nunca recebe uma Province fictícia ou é apagado e recriado para desembarcar.

## Embark

É necessário Army próprio, vivo, fora de batalha (inclusive participação em ActiveBattle), numa Province com porto e acesso válido, e Fleet do mesmo Country DOCKED nesse porto. Army inteiro precisa caber na capacidade disponível dessa Fleet. Embark cancela qualquer ordem terrestre atual. Não há split automático, capacidade distribuída entre Fleets ou embarque inland. A reorganização existente pode ser usada antes de embarcar.

Embarcados não entram nos índices de presença terrestre, marcadores, combate terrestre, recrutamento por localização ou captura. Guards explícitos impedem movimento, reorganização e recovery enquanto `embarkedFleetId` estiver definido. Os regimentos mantêm origem mesmo se o porto de origem for capturado depois.

## Movimento, manutenção, supply e repair

Movimento naval usa o mesmo SeaGraph, velocidade e rotas existentes. Cargo não acrescenta penalidade de velocidade: o TRANSPORT já limita a Fleet pelo navio mais lento. Naval Combat V1 continua usando seus próprios stats, dano, organização e retirada.

A auditoria identificou que manutenção terrestre diária vinha de `Province.stationedMilitaryMaintenance`. Um Army com location null deixaria de pagar. O tick econômico agora agrega manutenção dos embarcados por owner e passa essa parcela a `processDailyTick`, com os mesmos modificadores tecnológicos, de leis e de governo. Ela não entra na população estacionada nem na demanda de comida local. A manutenção naval continua separada, cobrando apenas os navios. Não há desconto nem dupla cobrança das tropas embarcadas.

Não há consumo de logística terrestre em alto-mar, supply naval, drain de organização ou recuperação de manpower embarcado. Repair naval continua possível em porto acessível com tropas a bordo. Após desembarcar, recovery e logística terrestre voltam ao comportamento existente.

## Desembarque amigo

`disembarkArmy` valida ownership, associação, Fleet DOCKED e acesso ao porto pelo contrato naval existente: próprio, aliado ou military access na direção válida. Guerra com owner bloqueia desembarque normal mesmo com um acordo stale. Uma invasão ativa deve ser cancelada antes do desembarque comum.

Cada ação desembarca um Army: remove `embarkedFleetId` e restaura `location` na Province do porto. Os demais embarcados continuam na Fleet. Não altera territory owner.

## Invasão e landing

O player seleciona os Armies no FleetPanel, pressiona **Plan Invasion** e clica no alvo. A engine valida guerra pelo índice de hostilidade de campanhas, coast metadata, Army/Fleet, capacidade, status fora de COMBAT/RETREATING e rota naval real.

**Limitação geográfica explícita:** V1 aceita Province costeira com porto. `navalWorld.json` fornece IDs costeiros gerais, mas somente os portos possuem ligação validada a SeaNode e coordenadas de conexão. Não se inventam landing points por distância ao centro provincial. Porto inimigo não é usado para docking: a Fleet permanece no SeaNode marítimo associado ao porto. Costa sem porto recebe feedback específico da limitação.

`NavalState.invasions` persiste uma ordem por Fleet, com `fleetId`, `armyIds`, `targetProvinceId`, `targetOwner`, `seaNodeId`, `status: SAILING | LANDING` e `landingDays`. Cada Army é selecionado individualmente e só pode participar de uma ordem. A Fleet navega pelo motor existente até o node. No primeiro tick diário em HOLDING nesse ponto, inicia LANDING e conta o primeiro dos **três dias** constantes (`LANDING_DAYS`). Enquanto desembarca, o Army continua embarcado; ao concluir, produz um evento de chegada terrestre.

A Fleet fica comprometida com a ordem desde SAILING. Comandos de movimento/retorno/interceptação da UI pedem cancelar primeiro. **Cancel Order** encerra a invasão e usa a parada naval existente, preservando a aresta em travessia. Naval AI ignora Fleets comprometidas.

Combate naval cancela a ordem, inclusive uma batalha que começa e termina no mesmo tick. Tropas sobreviventes continuam embarcadas; perdas por capacidade continuam sendo aplicadas. Paz, mudança de owner (inclusive para outro inimigo), desaparecimento de Army/Fleet ou abandono do node durante LANDING também cancelam. Hostilidade e owner são revalidados antes do desembarque e novamente após War Resolution/cleanup, sem avançar o relógio duas vezes.

## Integração terrestre e ordem do tick

As chegadas anfíbias entram em `processBattleArrival` junto com as chegadas terrestres. Esse caminho existente identifica defensores, cria/junta ActiveBattle e transfere somente território desocupado por `transferProvince`. Não há ownership antecipado, batalha paralela, bônus anfíbio ou alteração das fórmulas terrestres.

Sequência relevante: movimento terrestre → movimento naval → Naval Combat → perdas de transporte imediatas → repair naval → amphibious/chegadas → Battle Arrival → combate contínuo terrestre → War Resolution → rebellion/cleanup → revalidação sem progresso. Naval Combat foi colocado antes das chegadas para impedir desembarque de tropas que perderam transportes ou foram interceptadas nesse mesmo dia. Fórmulas de dano/retirada naval permanecem iguais. A data, ref e state final são publicados juntos antes de autosave.

## Baixas no mar e população

Depois de Naval Combat, antes de repair, capacidade é recalculada. Quando a carga excede capacidade, soldados sobreviventes são distribuídos proporcionalmente entre Armies em ordem estável de id, com arredondamento determinístico para vagas inteiras. Perdas são aplicadas aos regimentos do Army real por `applyTroopLoss`; um ajuste pelo mesmo helper completa eventuais resíduos de arredondamento. Não há conversão automática de strength de navios para soldados.

Exemplo: 8.000 tropas em dois TRANSPORTS → um TRANSPORT destruído → restam 5.000 vagas → 3.000 baixas. Sem TRANSPORTS ou sem Fleet, todas as tropas embarcadas são perdidas e os Armies vazios são removidos. A população é atualizada por `applyMilitaryCasualties(before, after)`, atribuindo deltas por `originProvinceId`, exatamente como no combate terrestre. Regimentos legados sem origem não recebem uma origem inventada; isso mantém o contrato atual. Os índices derivados não retêm referência órfã. A mesma rotina cobre Fleet removida no cleanup territorial existente.

Relatório naval mantém `embarkedTroopLosses` separado de `lossesA/B` (strength dos navios), atribuído uma vez à batalha mais recente da Fleet. Toast informa soldados perdidos e destruição da Fleet. A fórmula de War Score não muda. **Nesta V1, baixas no mar não alimentam `recordBattleWarCasualties`**, cujo contrato atual registra resultado final de batalha terrestre com lados/Army e id deduplicado na campanha. Não se fabrica CombatResult terrestre nem se atribui uma perda logística arbitrariamente a guerras simultâneas. Capturas e batalhas terrestres posteriores continuam contribuindo normalmente.

## Save V3

Extensão aditiva, sem mudar versão ou respawnar naval state em saves antigos. Army persiste `embarkedFleetId`; NavalState persiste `invasions`; NavalBattle pode persistir `embarkedTroopLosses`. Rotas navais e progresso usam o schema existente. Save/Load mantém Army único, location null em alto-mar e andamento de SAILING/LANDING.

`readNavalSave` valida campos, node/porto do alvo, Army IDs únicos por ordem, uma ordem por Fleet, progresso inteiro no intervalo, status e localização coerentes. `validateTransportSave`, chamado na fronteira raw pelo validador militar, verifica Fleet existente, owner igual, capacity, Army IDs duplicados, ausência de presença/ordem/batalha terrestre, seleção de cargo válida e alvo existente. Uma cópia persistida `embarkedArmyIds` é rejeitada para evitar outra fonte de verdade. Validação ocorre antes de migration e também ao salvar.

## UI e feedback

- Army panel: Embark, Fleet select com total/usada/disponível, estado **Embarked on**, localização naval e Disembark em porto.
- FleetPanel: **Transport Capacity usada / total**, Armies e soldados embarcados, Disembark por Army, checkboxes para escolher invasores, Plan Invasion e status/progresso da ordem.
- Map: modo explícito de seleção de alvo com instrução visível e botão para cancelar; clique em Province ou ícone de porto seleciona o alvo. Botão direito naval continua com seus comandos existentes.
- NavalBattlePanel: tropas atualmente a bordo e baixas embarcadas separadas das perdas navais.
- Validações produzem mensagens específicas para inland, ownership, battle, porto diferente, capacidade necessária/disponível, costa sem conexão, neutralidade, rota ausente e acesso inválido.

## AI, Simulation Activation e endgame

Não há planejamento de transporte ou invasão pela AI nesta V1, nem reposicionamento automático por portos aliados. A AI naval existente continua operando suas Fleets normais e não sobrescreve ordens comprometidas. Player commands funcionam com FULL; movimento, bookkeeping, combate e landing em andamento rodam independentemente de FULL/PASSIVE. Usa-se a ativação existente por player/war, sem nova regra estratégica de ativação. Tropas embarcadas não preservam existência territorial do Country: endgame e cleanup territorial não foram alterados.

## Performance e profiler

Índices temporários: Armies embarcados por id/Fleet; Fleets por id e os índices `byPort` existentes; metadata `portByProvince`/coastal IDs. Não há produto cartesiano Army × Fleet nem Province × Fleet. Tick de landing percorre somente ordens ativas, e o caminho sem ordens não monta índices provinciais nem hostilidade. Resolver capacity sem perdas preserva as referências originais. Population casualty accounting recebe apenas Armies afetados.

Profiler tem fase `amphibious` e agrega somente em DEV os contadores `embarkedArmies`, `transportedTroops`, `activeLandings`, `completedLandings`, `troopLossesAtSea`. Os três primeiros são somas das observações diárias na janela; os dois últimos são eventos. Cleanup acrescenta perdas sem duplicar os demais contadores. A janela reseta junto com o profiler existente, sem log individual por Army.

`npm run benchmark:amphibious` gera `artifacts/amphibious-invasion-v1-benchmark.json`: 30 warmups e 200 amostras, com 0/10/50 Armies transportados e 20 landings ativos. Mede bookkeeping, landing tick, capacity sem perdas e capacity com destruição de transportes/população. Reporta mediana, p95 e média; não aplica threshold de máquina. O cenário de perdas mede todos os TRANSPORTS destruídos em todas as Fleets do fixture.

Medições locais de referência (mediana em ms; ambiente completo no JSON):

| Armies | Landings | Bookkeeping | Landing tick | Capacity | Capacity + perdas |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 0 | 0,0003 | 0,0004 | 0,0005 | 0,0004 |
| 10 | 0 | 0,0014 | 0,0017 | 0,0037 | 0,1060 |
| 50 | 0 | 0,0025 | 0,0041 | 0,0094 | 0,4533 |
| 20 | 20 | 0,0010 | 0,0201 | 0,0034 | 0,1869 |

## Validação automatizada e navegador

`src/engine/__tests__/amphibiousV1.test.ts` cobre embarque, guards terrestres, capacidade, múltiplos Armies, movement, acesso/aliança, manutenção, landing, território/defensor, cancelamentos, perda proporcional/população, Naval Combat real, Save/Load e corrupção, PASSIVE/FULL, mapa e determinismo/profiler. `src/components/GameMap/__tests__/amphibiousUIV1.test.tsx` cobre ações e seleção de Fleet/cargo/alvo, ausência de marker, capacity e relatório naval.

Validação final: **76 testes adicionados (67 engine + 9 UI); 2.145 testes passaram em 86 arquivos** com `npm run test:run -- --maxWorkers=2`. `npm run lint`, `npm run typecheck`, `npm run build` e `git diff --check` passaram. Build mantém o aviso de bundle maior que 500 kB; a suíte em Node 26 também emite o aviso experimental de localStorage, sem falhas. Benchmark e smoke de navegador passaram, com zero exceções de runtime registradas no Chrome.

`npm run smoke:amphibious` usa Chrome headless/CDP e perfil temporário próprio. Inicia New Game BRA, move o Army real para São Paulo, embarca pela UI, verifica marker/cargo, navega pelo Atlântico, salva/carrega sem duplicar, retorna a porto amigo e desembarca por Army. Também valida declaração de guerra pela UI. **Fixtures explicitamente acelerados** de Save V3 colocam a Fleet no node do alvo inimigo para validar Plan Invasion e captura por ticks reais em x3; outro fixture coloca TRANSPORT quase destruído junto de BATTLESHIP inimigo para validar batalha naval, perda de tropas e remoção do Army. Defesa terrestre é validada no teste de chegada canônica; o smoke de captura usa alvo vazio. Os artifacts JSON/PNG registram evidências, não equivalem a uma avaliação humana de toda a experiência.

Checklist para validação humana adicional:

1. New Game BRA; selecionar Army e mandar a São Paulo; confirmar Fleet DOCKED.
2. Embark; Army some da Province e cargo aparece no FleetPanel.
3. Mover Fleet pelo Atlântico; salvar/carregar com Army embarcado; confirmar ausência de duplicação.
4. Retornar a porto amigo e Disembark; Army volta a receber movimento terrestre.
5. Reembarcar, declarar guerra, selecionar cargo e Plan Invasion numa Province costeira inimiga com porto.
6. Rodar x3; observar SAILING → LANDING → chegada após três dias.
7. Alvo vazio é capturado; alvo defendido mantém owner até resolução de batalha terrestre.
8. Encerrar guerra ou transferir owner durante landing; observar cancelamento e cargo preservado.
9. Combater no mar com cargo; destruir um TRANSPORT de Fleet sobrecarregada e depois todos os TRANSPORTS; verificar perdas, população por origem e relatório naval.

## Limitações

Sem Marines, planning bonus, shore bombardment, landing craft tech, naval supply, convoy/trade, convoy escorts, interceptação durante aresta naval, Naval Range, Blockades, transporte multi-Fleet, split automático, AI anfíbia complexa, beachhead separado ou World Wrap. Invasões V1 exigem costa com porto e conexão naval validada. Sem novas fórmulas terrestres ou de War Score; nenhuma alteração de stats/dano/retirada do Naval Combat V1.

Nenhum commit ou push faz parte desta implementação.
