# Focus Tree V2 — Passo 2: Focus UI V2

## Escopo e arquivos

A inspeção inicial identificou cards com descrição, efeitos e requisitos dentro de seis listas. Esta etapa substitui apenas a apresentação e os testes correspondentes. Engine, catálogo de 36 focos, IDs, posições, pré-requisitos, exclusividades, IA, save/load, ResearchModal, game loop e estilos compartilhados de pesquisa permanecem intactos. Sem commit ou push.

Criados:

- `src/components/focus/FocusTree.tsx`: grade e conexões.
- `src/components/focus/FocusNode.tsx`: nó compacto reutilizável.
- `src/components/focus/FocusTooltip.tsx`: detalhes e confirmação.
- `src/components/focus/presentation.ts`: categorias, rótulos e apresentação dos estados.
- `src/styles/focus-tree.css`: estilos exclusivos da nova UI.
- `docs/focus-tree-v2-step-2.md`: este relatório.

Alterados:

- `src/components/FocusModal.tsx`.
- `src/components/__tests__/focusTreeV2.test.tsx`.

## Arquitetura visual

Uma única árvore CSS Grid usa `position.column + 1` e `position.row + 1` para colocar cada nó. O número de linhas/colunas e a dimensão total derivam do catálogo. Métricas uniformes de apresentação (nós de 152 × 88, espaços e margens) ficam no componente, sem adicionar coordenadas de pixels aos dados. Isso reduz os cards antigos de aproximadamente 155 × 220 e mantém espaço para conexões.

O cabeçalho, foco ativo e legenda de seis categorias ficam fora da viewport scrollável. A árvore mantém sua geometria em telas estreitas, com rolagem horizontal e vertical interna. Cores discretas identificam categorias; os estados disponível, bloqueado, ativo, concluído e bloqueado por exclusividade possuem classes semânticas distintas. O nó contém apenas ícone, título, estado e percentual/barra compacta se ativo.

## Conexões

Um SVG absoluto, oculto da árvore de acessibilidade e sem interceptar eventos de ponteiro, desenha uma curva entre a base do pré-requisito e o topo do sucessor. Cada conexão deriva de `prerequisites` e das posições reais dos dois focos. SVG e grade compartilham as métricas. Linhas apagadas representam requisitos ainda não concluídos; requisitos concluídos e focos ativos recebem destaque. IDs aparecem apenas em atributos internos para identificar conexões nos testes, nunca em texto visível.

## Detalhes e ações

Hover ou foco de teclado abre uma prévia rica com título, ícone, categoria, descrição, duração, status, efeitos via `formatFocusEffect`, requisitos e exclusivos por título, motivo canônico de bloqueio e progresso completo. Há uma tolerância curta de saída para mover o ponteiro ao popover; ele não fecha enquanto o nó ou os detalhes mantêm foco.

Clique ou ativação nativa por Enter/Espaço fixa o popover. Somente então aparecem `Iniciar foco` ou `Cancelar foco`. O clique inicial nunca inicia automaticamente. Concluídos e bloqueados podem ser inspecionados, mas não oferecem início/cancelamento. O popover informa que cancelar perde o progresso.

Disponibilidade vem exclusivamente de `getFocusBlockReason`, chamado também antes da confirmação. Mudanças de estado atualizam as ações de um popover aberto. A classe de exclusividade interpreta o motivo canônico existente (`exclusiva`), sem repetir verificações de requisitos ou escolhas na UI. Nenhuma alteração da engine foi necessária.

O popover é limitado à viewport, tem rolagem própria e fecha em Escape, em seu botão ou ao rolar a árvore após seleção. Rolagem decorrente de foco de teclado mantém os detalhes ancorados ao nó. Resize descarta a inspeção para não conservar uma âncora desatualizada.

## Acessibilidade

Nós são botões nativos focáveis, com título/status no `aria-label`, `aria-disabled` para início indisponível e relações `aria-haspopup`, `aria-expanded` e `aria-controls`. `aria-disabled` não impede inspecionar detalhes; não se usa `disabled` nativo nos nós bloqueados. Barra usa `progressbar` com valor acessível. Há destaque `focus-visible`, modal rotulada, região da árvore rotulada, foco inicial no botão de fechar, ciclo de Tab dentro da modal e restauração do foco ao fechar. Ao fixar detalhes, o foco vai à ação ou ao botão de voltar; Escape restaura o nó e um segundo Escape fecha a modal.

## Testes e validação

Os dois testes funcionais anteriores foram adaptados à confirmação e aos novos papéis sem remover suas verificações de catálogo, bloqueio canônico e cancelamento. A suíte da UI agora possui 14 testes, cobrindo as seis categorias e 36 nós, posicionamento por dados, cards sem descrição, estados, progresso, bloqueio por requisitos/foco ativo/exclusividade, detalhes completos, nomes amigáveis, ausência de IDs visíveis, validação canônica interceptada, atualização de estado durante seleção, confirmação, cancelamento, foco/Tab/Escape, transição entre nó e popover, scroll, conexões e fechamento pelo botão/backdrop.

No jsdom, a ativação Enter → click nativa não é sintetizada; o teste verifica botão nativo focável e dispara o clique resultante. Não há testes de pixels exatos.

Validação final: lint, typecheck, testes e build aprovados; 50 arquivos e 799 testes verdes. `git diff --check` aprovado. O build mantém o aviso de bundle acima de 500 kB. A revisão do diff confirmou ausência de alterações na engine, dados, tipos, save/load e ResearchModal.

## Limitações futuras

Sem drag/zoom, minimapa, filtros ou navegação espacial por setas. A árvore usa scroll quando ultrapassa a tela. O motivo de exclusividade depende do texto retornado pela API atual; um código estruturado de motivo pode ser considerado em outra etapa se a engine evoluir.

Não foi possível realizar validação visual em navegador nesta sessão: a ferramenta informou que não havia navegadores disponíveis/conectados. Layout e interações foram verificados por inspeção do código, testes de UI e build; screenshots desktop/mobile e testes com leitor de tela permanecem validações manuais recomendadas.
