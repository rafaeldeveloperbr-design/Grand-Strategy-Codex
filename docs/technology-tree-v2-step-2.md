# Technology Tree V2 — Passo 2: Research UI V2

## Escopo e arquivos

A ResearchModal anterior foi inspecionada antes da edição: ela organizava quatro listas de cards grandes, com descrição, efeitos, custo, requisitos e ação diretamente em cada card. A implementação substitui essa apresentação por uma única árvore compacta.

Criados:

- `src/components/research/ResearchTree.tsx`
- `src/components/research/ResearchNode.tsx`
- `src/components/research/ResearchTooltip.tsx`
- `src/components/research/presentation.ts`
- `src/styles/research-tree.css`
- `src/components/__tests__/researchTreeV2.test.tsx`
- `docs/technology-tree-v2-step-2.md`

Alterado: `src/components/ResearchModal.tsx`.

Engine, catálogo de 32 tecnologias, IDs, custos, durações, efeitos, prerequisites, posições, IA, save/load, CountryTechState e Focus Tree V2 permanecem intactos. Não há slots, fila ou múltiplas pesquisas. Nenhuma alteração fora da UI foi necessária.

## Arquitetura visual

A modal gerencia inspeção, detalhes fixados, foco, Escape e callbacks. ResearchTree deriva a geometria do catálogo e desenha conexões. ResearchNode apresenta apenas ícone, título, estado e progresso ativo. ResearchTooltip concentra os detalhes e ações. Presentation fornece nomes amigáveis, cores discretas e estados de apresentação.

A linguagem visual acompanha a Focus UI V2, com componentes e CSS próprios, sem importar componentes ou estilos de foco. Os nós medem 152 × 88 na apresentação; esses valores não são armazenados nos dados.

O header fica fora da viewport rolável e apresenta pesquisa atual, ouro, legenda das quatro categorias e chips de modificadores obtidos de `getActiveTechnologyModifierEntries`.

## Posições e conexões

`technology.position.column` e `row` são a fonte de verdade para CSS Grid. O máximo de cada eixo determina as dimensões da árvore. A viewport permite rolagem horizontal e vertical e preserva a geometria em telas menores.

Cada prerequisite gera uma curva SVG até a tecnologia dependente. Os pontos derivam das mesmas métricas da grade. Conexões têm estados apagado, requisito concluído ou pesquisa ativa; o SVG usa `aria-hidden`, `focusable="false"` e `pointer-events: none`.

## Popover e ações

Hover ou foco inspecionam; clique ou ativação nativa por Enter/Space fixam os detalhes. O primeiro clique nunca inicia pesquisa. Detalhes fixados não são substituídos por hover em outro nó.

O popover mostra descrição, categoria, custo, duração base, efeitos via `formatTechnologyEffect`, requisitos por título, estado e motivo canônico de bloqueio. Pesquisa ativa mostra progresso e estimativa obtidos de `getResearchProgress`; modificadores de velocidade por tecnologias e focos vêm de `calculateTechBonuses`.

`getTechnologyBlockReason` determina disponibilidade, bloqueio e permissão para iniciar, incluindo ouro insuficiente. A ação revalida antes de chamar `onStartResearch(id)`. Cancelar chama `onCancelResearch()` e informa perda de progresso e ausência de reembolso. Concluídas e bloqueadas permanecem inspecionáveis, sem ação de iniciar. Não existem regras de recursos ou prerequisites duplicadas na UI.

## Acessibilidade

Nós são buttons nativos navegáveis por Tab, com nome amigável, `aria-disabled`, `aria-haspopup`, `aria-expanded` e `aria-controls`. `aria-disabled` representa indisponibilidade da pesquisa e preserva a inspeção por teclado. Há estilo `focus-visible`.

Ao abrir a modal, o foco vai para o fechamento; ao desmontar, retorna ao elemento anterior. Fixar detalhes move o foco para a ação adequada ou retorno à árvore. Escape fecha primeiro os detalhes e restaura o nó; outro Escape fecha a modal. Tab/Shift+Tab ficam contidos na modal. Scroll fecha detalhes fixados e restaura o foco quando necessário; inspeção do nó focado acompanha rolagem. Resize fecha os detalhes e devolve o foco se ele estava dentro do popover.

## Testes e validação

28 testes de UI cobrem categorias, 32 nós, posições/dimensões, estados, progresso, bloqueios, conteúdo rico, títulos amigáveis, ausência de IDs visíveis, conexões, hover, fixação, início/cancelamento, foco, Escape, Tab, scroll, modificadores, atualização de estado/ouro e validação canônica inclusive no momento da ação. Os testes usam roles, labels, classes semânticas e comportamento, sem coordenadas exatas.

Validação do trabalho: `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` e `git diff --check` passaram. A suíte completa passou com 856 testes em 53 arquivos, incluindo os 28 novos testes de UI. Os testes funcionais existentes são preservados. O build emitiu aviso de chunk acima de 500 kB, sem falha.

## Limitações futuras

Não há drag/zoom, navegação espacial por setas, slots ou fila. A estimativa canônica considera tecnologias e focos; leis e dificuldade podem alterar o ritmo diário, conforme informado no popover. Rolagem e resize descartam a fixação para evitar detalhes ancorados em nós fora da viewport. Validação visual em navegador real ainda é recomendada para diferentes alturas de tela e fontes.
