# Research Slots V1

## Objetivo e escopo

O jogo prevê campanhas longas de dominação mundial, com várias horas de duração. Technology Tree e Focus Tree serão significativamente maiores no futuro. A coleção de slots suporta esse crescimento sem um novo modelo de estado.

O balanceamento atual é **1 slot inicial e máximo de 2**, definido em `src/constants/research.ts`. O máximo de 2 é temporário, não uma limitação estrutural. Não foram adicionadas tecnologias, focos, filas, auto-research, drag/zoom ou pesquisa específica por país. Os 32 IDs tecnológicos e os 36 focos permanecem. As árvores não foram redesenhadas.

Antes da edição foram inspecionados engine, ações do jogador, IA econômica, save/load e Research UI. O loop diário continua usando a mesma integração; sua lista de notificações já permite múltiplas conclusões.

## Estado

```ts
interface ResearchSlot {
  id: number;
  technologyId: string | null;
  progressDays: number;
}

// Dentro de CountryTechState:
researchSlots: ResearchSlot[];
```

`researchSlots` representa somente os slots desbloqueados. IDs são zero-based; a UI apresenta Slot 1, Slot 2 etc. Não há contador serializado redundante nem campos antigos no estado vivo. Capacidade efetiva é derivada por `getResearchSlotCount`:

```text
min(MAX_RESEARCH_SLOTS, INITIAL_RESEARCH_SLOTS + bônus acumulado)
```

O bônus é inteiro e a quantidade nunca fica abaixo da inicial. `researchSlotBonus` faz parte dos bônus calculados, não do save.

## Normalização

`normalizeTechState` aceita conteúdo unknown, filtra IDs conhecidos e cria todos os slots da capacidade efetiva. Ordena por ID; preenche slots ausentes; descarta IDs negativos, fracionários, não numéricos ou fora da capacidade. Para IDs repetidos, a primeira entrada vence. Para tecnologia duplicada, vence o menor ID de slot, independentemente da ordem do array recebido.

Referências desconhecidas e tecnologias já concluídas tornam-se null. Progresso negativo ou não finito torna-se zero; slots vazios nunca retêm progresso. As listas de concluídos são deduplicadas e preservam IDs válidos. A normalização é idempotente e não modifica o argumento.

Se `researchSlots` for um array, ele é a fonte de verdade, inclusive em conteúdo misto. Caso contrário, o par legado `activeResearchId` / `researchProgressDays` é migrado para o slot 0. Um foco Academias Nacionais concluído em save antigo já produz o segundo slot vazio.

## Save V3 e compatibilidade

Foi escolhido **Save V3**, pois a substituição de um par de campos por uma coleção altera estruturalmente o formato persistido. `CURRENT_VERSION = 3`; o carregador aceita V1 (também sem version), V2 e V3, retornando sempre V3 normalizado.

- V1: mantém a migração das seções antigas e normaliza jogador e bots.
- V2: mantém as seções existentes e migra pesquisa/progresso para slot 0.
- V3: preserva slots/progressos independentes e normaliza conteúdo inválido.
- Escrita: normaliza jogador e bots antes de persistir, serializando o Map de bots como pares.

Metadados, mundo, exércitos, diplomacia e construções mantêm suas estruturas. O subsistema de diplomacia continua com sua própria versão 2. A tipagem de compatibilidade do mapa aceita saves V2 e V3; os snapshots atuais usam V3.

## Desbloqueio

O foco confirmado é `focus_national_academies`, **Academias Nacionais**, cuja descrição é “Organiza uma rede permanente de pesquisa.”

Foi adicionado o RewardEffect real `{ type: 'RESEARCH_SLOTS', value: 1 }`, preservando `RESEARCH_SPEED +10%`, ID, título, descrição, categoria, ícone, duração, posição e prerequisites. O novo efeito é integrado ao tipo, cálculo de bônus, capacidade/normalização e formatter. O tooltip de foco mostra automaticamente “Slots de pesquisa: +1”, sem mudança na Focus UI.

O cálculo soma recompensas de focos concluídos. Futuras fontes podem alimentar o mesmo bônus: para tecnologias será necessário ampliar o union TechnologyEffect e seu applicator; para leis, integrar a fonte de bônus na capacidade e disponibilizar o contexto correspondente. Não há concessão de slots por tecnologias ou leis neste passo.

## API e cobrança

```ts
getTechnologyBlockReason(state, technologyId, country, slotId?)
startTechnologyResearch(state, technologyId, country, slotId = 0)
cancelTechnologyResearch(state, slotId = 0)
getResearchProgress(state, slotId = 0)
```

Sem slot alvo, o validador inspeciona disponibilidade no primeiro slot livre desbloqueado; sem slot livre, retorna o motivo canônico. Com alvo explícito, valida existência, desbloqueio e ocupação. Também valida tecnologia conhecida, não concluída, ausência de duplicação ativa, prerequisites e ouro.

Os defaults de slot 0 preservam chamadas simples; UI e IA passam explicitamente o alvo. Nenhuma regra de disponibilidade é duplicada entre UI e IA.

Início retorna `{techState, cost}` e altera apenas o alvo, com progresso zero. Falha retorna `{techState:null, cost:0}`. A engine não debita recursos: hook e IA descontam uma vez após sucesso. O hook usa refs atuais tanto para estado quanto para ouro, impedindo débito duplo mesmo com cliques antes do rerender.

Cancelamento zera somente o slot escolhido; progresso é perdido e não há reembolso. Não afeta pesquisas nos outros slots.

## Processamento diário

Todos os slots ativos progridem na ordem crescente de ID, após normalização. Cada incremento considera dificuldade (quando bot), velocidade de pesquisa de tecnologias/focos e leis. Os bônus são recalculados a cada slot: uma tecnologia de velocidade concluída pelo slot 0 beneficia o slot 1 no mesmo tick. Essa regra é determinística e testada inclusive com entrada em ordem inversa.

Conclusão adiciona a tecnologia uma única vez, limpa apenas seu slot e gera sua própria notificação. Duas conclusões no mesmo dia geram dois efeitos e duas notificações. O loop existente percorre todas as notificações para log/toast do jogador e log da IA. Focos continuam processados antes da pesquisa: desbloqueio aparece imediatamente na conclusão do foco.

## IA

A IA normaliza a capacidade e percorre todos os slots vazios desbloqueados. Filtra candidatos com o validador canônico para aquele alvo, excluindo naturalmente tecnologias já ativas. Preserva as prioridades existentes por contexto, favorecendo categorias ainda não pesquisadas quando houver alternativas; ordem do catálogo desempata de forma estável.

Após cada início bem-sucedido, atualiza estado e ouro antes de avaliar o próximo slot. Falha não debita nem cria log de início. Não há scoring ampliado nem mudança dos outros sistemas de IA.

## UI

`ResearchSlots` apresenta resumos compactos no header até o limite configurado: bloqueado, disponível ou título/progresso da pesquisa. Ouro, legenda e modificadores permanecem.

A árvore mantém posições, dimensões dos nós, gaps, conexões, centralização, scroll e cores. Nós e conexões ativos consultam a coleção de slots; cada progresso usa `getResearchProgress` com o ID correto.

O popover mostra “Pesquisando — Slot N”. Cancelar envia esse ID. Havendo somente um slot vazio, iniciar o escolhe diretamente; com mais de um vazio, um select acessível permite escolher dentro do próprio popover. Slots ocupados não são oferecidos. O alvo é recalculado quando o estado muda e o início revalida no momento da ação. O focus trap inclui o select; inspeção, fixação, Escape e retorno de foco foram preservados.

## Arquivos

Criados: `src/constants/research.ts`, `src/components/research/ResearchSlots.tsx`, `src/engine/__tests__/researchSlotsV1.test.ts`, `src/engine/__tests__/researchSlotsSaveV3.test.ts`, `src/components/__tests__/researchSlotsV1.test.tsx` e este documento.

Alterados: tipos tecnológicos/snapshot, engine tecnológica, IA econômica, hook de ações, saveSystem, compatibilidade tipada do mapa, ResearchModal, ResearchTree, ResearchTooltip, presentation e CSS de pesquisa. No catálogo de focos, somente a recompensa de Academias Nacionais mudou. Testes existentes receberam novas fixtures/expectativas de slots e versão do save, mantendo seus cenários funcionais. Nenhum arquivo de definição tecnológica ou componente/estilo da Focus UI foi alterado.

## Testes e limites futuros

64 testes novos: 45 de engine/IA, 6 de save/migração e 13 de UI/hooks. Cobrem capacidade, normalização/idempotência, V1/V2 e bots, round-trip V3, validação, início/cancelamento, cobrança única, progresso paralelo, conclusões, ordem de bônus no mesmo tick, IA, seleção e identificação de slots e formatter do foco. Os testes anteriores permanecem e foram adaptados ao novo estado sem remoção de cenários.

Validação final: lint, typecheck, suíte completa, build e `git diff --check` passaram. A suíte contém 920 testes aprovados em 56 arquivos, incluindo os testes anteriores. O build emitiu o aviso de chunk acima de 500 kB já presente no projeto.

Para aumentar a capacidade futura, alterar `MAX_RESEARCH_SLOTS` e acrescentar recompensas reais que concedam slots. Engine, save e UI já iteram coleções/capacidade, sem branches específicos para exatamente dois slots. O formato V3 não exige nova mudança estrutural para 3, 4 ou mais. Balanceamento e testes que fixam o limite atual precisarão ser atualizados deliberadamente. Não há terceiro slot neste V1.

Estimativas de duração continuam seguindo `getResearchProgress`, que considera tecnologias/focos; leis e dificuldade podem mudar o ritmo real, como informa o popover. Expansão de árvores, novas fontes de slots, fila e auto-research ficam para passos futuros.
