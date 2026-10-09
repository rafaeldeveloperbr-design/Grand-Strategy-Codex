# Province Panel UX Cleanup V1

## Organização

As abas são **Info | Obras | Militar | Porto**. Porto aparece somente para províncias registradas em `portByProvince`, a fonte operacional já utilizada pelo jogo. O bloco naval deixa de ocupar o topo do painel.

Porto reúne nível/status operacional, recuperação/reparo, frotas presentes e seleção, nível/velocidade do shipyard, IRON/TOOLS locais, ouro nacional, destino de reforços, upgrade, quatro opções de navios, motivos de bloqueio, fila e cancelamentos. O componente de Naval Construction e suas ações/permissões são reutilizados sem alterações. Portos estrangeiros continuam inspecionáveis, com ações bloqueadas pelas regras existentes.

Selecionar uma província sem porto enquanto Porto está ativa redefine a aba para Info. Outras abas mantêm o comportamento anterior; voltar a uma província costeira depois do fallback mantém Info.

## Atividades

A coluna agrega, em ordem, Obras, Recrutamento e Naval (navios e upgrade do shipyard), ocultando seções vazias. A mensagem vazia é **Nenhuma atividade em andamento.**

O bug anterior vinha de `recruitmentsHere` ser substituído por uma lista vazia na aba Militar. Agora o resumo recebe sempre a fila real da província. Obras/recrutamento mantêm seus cancelamentos anteriores; o resumo naval não duplica comandos, que ficam em Porto.

Progresso usa os campos existentes: `totalDays`/`daysRemaining` para obras e recrutamento (com fallback de tempo legado), `progress`/`requiredProgress` para navios e upgrade. O resumo informa produção ativa, em fila ou pausada pelo upgrade. As barras reutilizam o estilo de construção. As seleções de filas são memoizadas pelas referências das filas e pela província; nenhuma fila é criada ou modificada pela apresentação.

As abas ficam fora da área rolável; conteúdo e Atividades têm scroll independente e limites flexíveis. No layout empilhado, Atividades ocupa no máximo 35% da área central, evitando comprimir o conteúdo com um limite fixo em pixels.

## Validação e limites

- 25 regressões novas em `provincePanelUXCleanupV1.test.tsx`; teste antigo de informação portuária adaptado para abrir Porto.
- Checklist reproduzível: `node scripts/smoke-province-panel-ux.mjs` (Chrome local; `NAVAL_CHROME_PATH` pode sobrescrever o caminho). Usa perfil temporário isolado e não acessa saves pessoais.
- Checklist real: BRA → São Paulo, Porto, iniciar Destroyer, recrutamento de Guarnição e obra de Serraria; confirmar três categorias; selecionar inland; voltar a São Paulo. Fazenda já começa no nível máximo em São Paulo, por isso o checklist usa Serraria.
- Viewports verificadas: 1440×900, 1280×720, 1024×768 e 768×720, com tabs visíveis, scroll independente e sem overflow horizontal do painel.
- Relatório e captura em `artifacts/province-panel-ux-cleanup-v1-browser.json` e `artifacts/province-panel-ux-cleanup-v1.png`.
- Casos sem shipyard, com upgrade e porto estrangeiro são cobertos pelas regressões de componente; não são todos reproduzidos no checklist de nova campanha.
- Sem mudanças em gameplay, Save, Naval Construction, Recruitment, Construction V2, Simulation Activation ou Naval Combat. Range/Blockades continuam fora do escopo. A fonte de portos e as regras de visibilidade de frotas permanecem as existentes.

Validação final: `npm run lint`, `npm run typecheck`, `npm run test:run -- --maxWorkers=2` (84 arquivos, 2.069 testes aprovados), `npm run build` e `git diff --check` aprovados. O build mantém o aviso de bundle maior que 500 kB. Sem commit ou push.
