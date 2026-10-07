# Movement Commands V2

Implementado na branch `feat/Movement-Commands-V2`, sem commit ou push. A auditoria encontrou os campos existentes `destination` (próxima aresta), `targetDestination` (fim do trecho BFS) e `path` (arestas restantes). `processArmyMovement` retorna chegadas separadamente; `battleArrivalTick` resolve ocupação/combate e limpa a rota ativa em batalha. Retiradas existentes alteram a posição e preservam os demais campos do Army por spread.

## Comandos

- Direito normal substitui a ordem atual e remove o plano manual quando a nova ordem é válida. Cada exército usa `moveArmy`; falhas preservam a ordem anterior. O gesto individual existente de clicar direito na província atual para parar foi preservado e também limpa o plano.
- Shift+direito acrescenta um checkpoint ao fim do plano. O primeiro ponto inicia movimento imediatamente se não houver trecho ativo. Uma ordem normal já ativa é incorporada como primeiro checkpoint ao ser estendida.
- Ctrl+clique no marcador individual alterna seleção; stacks mantêm os controles existentes. Escape limpa seleção.
- `Limpar rota` / `Limpar rotas` removem o plano e a ordem ativa sem alterar localização, tropas ou estado de combate. Parar marcha também elimina o plano, evitando retomada indesejada.

## Estado e invariantes

`ArmyMovementPlan { waypoints: string[] }` é um campo opcional `Army.movementPlan`. A fila contém checkpoints ainda não concluídos, incluindo o objetivo do trecho ativo até sua chegada ser processada. É necessário conservar esse objetivo porque a batalha interrompe e limpa a rota física existente.

Não há cópia persistida de um destino final manual: ele é o último waypoint. `destination`, `targetDestination` e `path` continuam pertencendo ao motor atual. Não há nova ordem dentro de ActiveBattle, cache de caminhos futuros, fila em React ou versão alternativa de BFS.

Adicionar valida somente o novo segmento a partir do último checkpoint planejado, ou do destino final ativo, ou da posição atual. Um Army virtual é usado apenas como entrada de `moveArmy` para validar esse segmento; sua posição nunca é aplicada ao Army real. A rota ativa não é recalculada ao acrescentar pontos. Repetir o último ponto não acrescenta um checkpoint inútil porque a API existente rejeita origem igual ao destino.

## Execução, batalha e retirada

`movementCommands.ts` fornece `issueMoveCommand`, `appendWaypoint`, `clearMovementPlan` e `advanceMovementPlans`.

O tick de movimento recebe um pequeno passo anterior que retira checkpoints já alcançados e, se o Army estiver parado e fora de combate, inicia o próximo trecho por `moveArmy`. O motor atual então processa velocidade, supply, terreno e cada travessia. Chegadas continuam indo para `battleArrivalTick` antes da próxima ativação. Não há várias travessias de waypoint no mesmo tick nem salto sobre conquista/combate.

Durante batalha, o plano fica pausado no Army. A engine continua limpando apenas a rota ativa, preservando o campo opcional. No tick posterior à resolução, um sobrevivente revalida o objetivo ainda pendente a partir de sua localização real. Se já estiver no checkpoint, ele é retirado da fila e o próximo é iniciado.

Retirada manual e derrota usam a posição escolhida pelo sistema existente. O checkpoint disputado permanece pendente; não é considerado concluído enquanto o Army recuou. O próximo tick recalcula a partir da nova posição, sem reutilizar caminho anterior ou impedir a retirada. Se o retorno não for possível, o plano é interrompido.

Exércitos destruídos têm seus planos limpos se ainda houver um registro vazio; registros removidos não deixam um cache externo. IDs inexistentes são tratados sem lookup inseguro.

## Diplomacia e invalidação

Todos os segmentos são validados por `moveArmy`, que usa os helpers diplomáticos/pathfinding atuais. Acesso directional e override de guerra continuam iguais. O plano é revalidado quando um segmento é ativado, e o motor existente revalida as arestas ativas durante a execução.

Se o próximo checkpoint ou uma aresta ativa ficar inacessível por guerra, revogação, controle ou território transferido, o Army permanece na posição atual, a rota inteira é limpa e uma notificação agregada informa os exércitos do jogador afetados. Checkpoints posteriores não são pulados. Limpar o plano impede notificações repetidas em ticks seguintes. Não há bloqueio novo baseado em supply ou logística.

## Comandos em grupo

`armyGroupCommands.ts` foi estendido com modos `move`, `append` e `clear`. Cada ID é deduplicado; terceiros são ignorados; cada Army calcula sua própria rota. Falhas de um não desfazem sucessos dos outros e mantêm o Army falho intacto. `useArmyActions` produz um único toast/log por comando, incluindo nomes e motivos das falhas, sem mensagens por regimento.

## UI e visual

`ArmyMovementPlanPanel` mostra destino imediato, destino final e lista ordenada dos pontos restantes, ou `Sem rota planejada`. O resumo de multi-seleção mostra quantos têm rota ativa e quantos estão sem movimento ativo, sem listar várias sequências distintas. Ambos oferecem limpeza explícita.

`ArmyMovementLayer` desenha o caminho ativo real com linha sólida e a intenção futura com linha pontilhada entre checkpoints. A linha futura é uma indicação de ordem, não um caminho BFS garantido; o trajeto real é calculado na ativação conforme as condições daquele momento. Marcadores numerados identificam os pontos. Com filas longas, aparecem os primeiros oito e o último para reduzir poluição visual.

Rotas manuais visualmente idênticas (mesma origem, owner, arestas e fila) são desenhadas uma vez; rotas diferentes permanecem separadas. Rotas simples existentes continuam individuais. Planos pausados em combate continuam visíveis. A ajuda do mapa/popover/painel explica direito normal, Shift+direito, Ctrl+clique e Escape.

## Save/load

A versão continua 2. O campo opcional é serializado pelo fluxo existente, inclusive em Armies de batalhas ativas/snapshots quando presentes. Não é criada uma segunda ordem persistida na batalha. Saves antigos sem campo equivalem a fila vazia e mantêm movimento simples.

O validador militar existente agora verifica a estrutura do plano, strings de waypoint e IDs contra as províncias presentes no save. Campo malformado ou província inexistente causa erro claro antes da migração/lookup; load falha sem alterar o slot e o save/autosave não o sobrescreve. Não é feita conversão silenciosa de IDs. Saves com IDs existentes mas acesso posteriormente perdido carregam e interrompem o plano com segurança na execução.

## Arquivos

Criados: `src/engine/military/movementCommands.ts`, `src/components/ArmyMovementPlanPanel.tsx`, suítes `src/engine/__tests__/movementCommandsV2.test.ts` e `src/components/__tests__/movementCommandsV2.test.tsx`, além deste documento.

Alterados: `src/types/army.ts`; exportação `src/engine/military/index.ts`; `saveCompatibility.ts`; `src/hooks/app/armyGroupCommands.ts` e `useArmyActions.ts`; integração anterior/posterior no `movementTick.ts` e passagem de notificações em `useGameLoop.ts`; `src/App.tsx`; `ArmyMarker.tsx`, `ArmySelectionSummary.tsx`, `ArmyStackPopover.tsx`, `GameMap.tsx`, `ArmyMovementLayer.tsx`; estilos locais `src/styles/army.css`. A suíte Military UI V2 recebeu três correções de expectativa para ajustes de seleção/labels já existentes nesta branch, sem mudar esses controles.

## Testes, regressões e limitações

Cobertura dedicada: substituição simples; A→B→C→D; extensão de ordem normal; limpeza; grupo com rotas próprias, IDs duplicados e terceiros; falha parcial; acesso directional/guerra; revogação futura e corredor transferido; vitória real com continuação; derrota/retirada manual reais; interrupção após retirada sem acesso; destruição e ID inválido; Shift+direito/Ctrl+clique; linhas/markers/deduplicação; painel individual/grupo; save round-trip/continuação/legado e rejeição segura de planos malformados.

Movement engine, BFS, custos de terreno, Logistics, combat/unit balance, battle arrival, conquest, AI movement e Rebellion não foram reescritos. A IA e rebeldes continuam emitindo ordens normais. Cheats criam Armies compatíveis sem mudanças específicas.

Não foram implementados remover último ponto, edição por arraste, sincronização, patrulha, fronts, battle plans, stance, attack-move, redeployment, naval/air transport ou novos pontos de movimento. Não há previsão diplomática: um trecho futuro pode perder validade antes de ser ativado. Ordens de waypoint durante batalha são rejeitadas; planos anteriores são preservados e retomados.

Navegador integrado indisponível nesta sessão. Renderização e interação foram verificadas em jsdom, e execução/combate/save por testes; não houve campanha manual ou inspeção visual interativa do console.

Validação final: `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:run` e `git diff --check` passaram. Foram 724 testes em 45 arquivos, incluindo 25 casos novos dedicados. Build emitiu o aviso de bundle JavaScript acima de 500 kB; Vitest emitiu o aviso experimental de localStorage do Node, sem falhas. Nenhum commit ou push foi realizado.
