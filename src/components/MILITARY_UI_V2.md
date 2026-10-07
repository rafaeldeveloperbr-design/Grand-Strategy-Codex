# Military UI V2

Implementada na branch `feat/Military-UI-V2`. A auditoria inicial encontrou seleção por um único `selectedArmy` em `useGameSelection`, comando individual em `useArmyActions` e abertura automática do relatório com pausa em `battleContinuousTick`. O histórico já armazenava os resultados independentemente do modal.

## Relatórios, histórico e notificações

O fim de uma batalha continua produzindo o resultado completo, snapshots, composição, perdas e transferência territorial pelo fluxo existente. As duas ramificações de conclusão agora produzem uma única notificação para o jogador envolvido, com local, vitória/derrota, baixas aliadas/inimigas e conquista/retirada quando aplicáveis. Nenhuma chama `setBattleReport` ou pausa automaticamente.

O botão inferior agora diz `Batalhas (quantidade)` e tem label acessível. O histórico abre os relatórios voluntariamente por clique, Enter ou Espaço. O comportamento de pausa ao abrir voluntariamente um relatório foi preservado. Relatórios antigos e labels modernos/legados continuam usando `getUnitName`; não houve alteração da estrutura dos dados ou do formato de save. Os parâmetros antigos de setters no fluxo de tick foram preservados para compatibilidade de seus consumidores, mas não são usados para abrir o modal na conclusão.

Histórico e relatório recebem papel de diálogo, label, foco inicial, contenção de Tab, fechamento por Escape e restauração de foco quando o elemento anterior ainda existe.

## Seleção

`useGameSelection` armazena somente `selectedArmyIds: string[]`. `selectedArmy` é a referência primária derivada dessa lista; `setSelectedArmy` é um adaptador para operações individuais existentes, sem um segundo estado independente.

Clique no marcador individual mantém seleção individual. No popover, cada botão alterna um exército e mantém a lista aberta. `Selecionar todos` acrescenta os membros controláveis do stack; `Desmarcar todos` remove esses membros, preservando seleções de outros stacks. `Limpar seleção` e Escape limpam a lista completa. Seleção de província mantém o comportamento existente de limpar exércitos.

Somente exércitos com tropas e cujo owner é o jogador entram na seleção. Inimigos, aliados, terceiros e facções rebeldes não controladas são excluídos. Os botões estrangeiros no popover permanecem informativos e desabilitados. Alterações da lista de exércitos removem IDs órfãos, regimentos destruídos ou controle perdido. Entrada em batalha e retirada não removem uma seleção válida.

Todos os marcadores/rotas selecionados recebem destaque dourado. As cores nacionais e bordas existentes de `ArmyMarker` e `ArmyStackMarker` foram preservadas. O mini-status do mapa aparece somente com uma seleção individual, evitando sobreposição de vários readouts.

## Movimento em grupo

`armyGroupCommands.ts` é um adaptador de comando de UI. Para cada ID controlável, chama as APIs existentes `stopArmyMovement` (quando necessário para trocar destino) e `moveArmy`. Não implementa validação diplomática paralela, BFS, cálculo de pontos, terreno ou logística. Cada exército recebe seu próprio destino imediato, destino final e rota.

Ordens válidas são aplicadas independentemente. Falhas preservam integralmente o exército original, inclusive uma ordem anterior. Não existe rollback coletivo, fusão automática, superexército ou movimento sincronizado. IDs duplicados são deduplicados; terceiros são ignorados defensivamente.

`useArmyActions` aplica todas as atualizações e gera um único log/toast com quantidade de ordens aceitas, destino e nomes/motivos das falhas. Quando a API retorna `null` sem detalhamento, a mensagem diz `sem rota ou acesso válido`; não inventa um diagnóstico diplomático mais específico. Combate, destino inexistente e exército já no destino têm motivos diretos. O gesto individual anterior de parar ao clicar na província atual foi preservado; não foram adicionados controles coletivos de parada.

## Painel agregado e composição

Uma seleção individual mostra o painel detalhado anterior. Mais de um exército mostra `ArmySelectionSummary`: quantidade, tropas, organização/moral/supply médios e composição agregada. As médias são ponderadas por tropas; os máximos e a classificação vêm dos helpers militares existentes. Exércitos reais não são modificados.

`militaryPresentation.ts` concentra composição e nomes compartilhados entre aba provincial, popover e resumo; status, labels de supply e textos de notificações também ficam nessa camada de apresentação. O relatório preserva sua comparação de composição inicial/final, reutilizando a fonte de labels `getUnitName`.

Supply do exército e conexão da rede logística aparecem separadamente. Os cálculos continuam em `getArmySupply` e `getProvinceLogistics`, sem novos thresholds ou mudanças de balance. Os estados existentes `good/low/critical` são apresentados como Adequado/Baixo/Crítico na aba provincial; o popover mantém seus labels anteriores. Estados Parado/Em movimento/Em batalha/Sem rota/Baixo supply são derivados dos campos existentes. A retirada atual é instantânea na engine, sem um estado persistente `retreating`; seu resultado aparece na notificação e no relatório. Não foi inventado um novo state militar só para exibir “Recuando”.

## Recrutamento e província

A aba Militar foi organizada em tropas presentes, recrutamento moderno e fila. Exércitos mostram nome, país, força, organização, moral, supply, logística e composição, incluindo legados. A seleção individual está disponível para exércitos próprios.

Os sete cards modernos exibem papel, ataque/defesa/choque/cerco/mobilidade/força, ouro/manpower/ferro/ferramentas, supply, manutenção, tempo e requisitos. Custos e bloqueios vêm exclusivamente de `getEffectiveRecruitmentCost` e `getRecruitmentBlockReason`. Tipos legados não são oferecidos para novo recrutamento. Cards bloqueados continuam legíveis e mostram o motivo em texto e no botão.

A fila mostra tipo, quantidade, província, percentual e dias restantes; usa `totalDays` quando disponível e a definição anterior para filas legadas. Cancelamento continua chamando a ação existente. Não reaplica requisitos de Arsenal/tecnologia a pedidos pagos. Controle perdido é indicado enquanto o processamento existente cancela no próximo tick. Para evitar apresentação duplicada, os recrutamentos deixam de aparecer na sidebar quando a aba Militar mostra a fila; nas outras abas, a sidebar continua funcionando.

## Arquivos

Criados:
- `src/components/ArmySelectionSummary.tsx`
- `src/components/militaryPresentation.ts`
- `src/components/useMilitaryDialog.ts`
- `src/hooks/app/armyGroupCommands.ts`
- `src/components/__tests__/militaryUIV2.test.tsx`
- este documento.

Alterados:
- `src/App.tsx`: ligação da seleção, painel agregado e acesso ao histórico.
- `src/hooks/app/useGameSelection.ts`: seleção múltipla e limpeza.
- `src/hooks/app/useArmyActions.ts`: adaptação do comando em grupo.
- `src/hooks/gameLoop/battleContinuousTick.ts`: somente UX de conclusão.
- `src/components/GameMap/GameMap.tsx`, `ArmyMovementLayer.tsx` e `mapPresentation.ts`: seleção, rotas existentes e status.
- `src/components/ArmyStackPopover.tsx`: controles e composição.
- `src/components/BattleHistoryModal.tsx`, `BattleReportModal.tsx`: teclado e diálogo.
- `src/components/ProvincePanel/ProvinceMilitaryTab.tsx`, `ProvincePanel.tsx`: cards, tropas e fila.
- `src/styles/army.css`: estilos locais e foco visível.
- duas suítes existentes de mapa/logística: expectativas de texto atualizadas para os novos labels, preservando suas verificações funcionais.

## Compatibilidade, limites e validação

Seleção e popover não são persistidos. SaveSystem e versão do save não foram alterados. Unit definitions, custos, balance, recrutamento, IA, combate, movement engine/pathfinding, Terrain, Logistics, Buildings, Economy, Diplomacy, Rebellion e Politics não foram reescritos nem rebalanceados.

Não foram implementados waypoints, Shift+right-click, filas de destinos, rotas manuais, patrulha, attack-move, stances, fronts, templates ou reorganização coletiva. Uma eventual Movement Commands V2 será uma extensão separada e não é dependência desta UI.

Os testes novos exercitam seleção individual/múltipla/todos, exclusão de terceiros, limpeza e transferência/destruição, popover persistente, cores/destaques, resumo ponderado, rotas próprias, falha parcial, destino inválido, guerra/acesso, toast agregado, conclusão real de batalha sem modal/pausa, histórico por teclado/clique, fechamento e cards/fila legada. As suítes existentes cobrem os sistemas militares/econômicos/diplomáticos e saves.

Navegador integrado indisponível na sessão. Não houve inspeção visual interativa nem verificação manual do console; a UI foi validada por renderização/interação em jsdom. Layout real em diferentes resoluções continua sendo uma verificação manual útil.

Validação final: lint e typecheck passaram sem avisos; build passou; suíte completa passou com 699 testes em 43 arquivos (17 casos novos nesta etapa); `git diff --check` passou. O build emitiu aviso de chunk JavaScript acima de 500 kB e Vitest emitiu o aviso experimental de localStorage do Node, sem falhas. Não houve commit ou push.
