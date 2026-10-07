# Focus Tree V2 — Passo 1

## Arquitetura

`NationalFocus` ganhou apenas `mutuallyExclusive?: string[]` e `position: { column, row }`. As posições são inteiras, não negativas, únicas no catálogo e ordenam os pré-requisitos acima dos sucessores. `CountryTechState`, `TechnologyEffect` e `RewardEffect` mantêm seus formatos.

`getFocusBlockReason` é a validação canônica compartilhada por engine, IA e modal. Bloqueia ID inexistente, conclusão anterior, qualquer foco ativo, requisitos incompletos e escolhas exclusivas concluídas. O próprio foco ativo não pode ser reiniciado; a modal mantém sua ação de cancelar. Exclusividades são verificadas nos dois sentidos, inclusive se uma definição futura for assimétrica.

`cancelNationalFocus` retorna um novo estado, limpa o ID e perde todo o progresso. `useTechActions.handleCancelFocus` atualiza estado e referência imediatamente, mantendo toast e log. `App.tsx` apenas conecta a ação.

`processDailyFocusProgress` isola o progresso dos focos. `processDailyTechProgress` continua sendo a API do game loop, delegando o foco antes da pesquisa. Dificuldade da IA, leis, conclusão, notificações e bônus de pesquisa disponíveis no mesmo dia são preservados. A conclusão evita duplicar IDs já concluídos.

`validateFocusTree` retorna erros de IDs duplicados, referências inexistentes, autorreferências, listas duplicadas, posições inválidas/duplicadas e ciclos de pré-requisitos. A suíte valida o catálogo real e definições propositalmente inválidas; não altera o save.

## Catálogo

| Categoria | Quantidade |
| --- | ---: |
| POLITICS | 7 |
| ECONOMY | 3 |
| INDUSTRY | 6 |
| MILITARY | 12 |
| DIPLOMACY | 5 |
| RESEARCH | 3 |
| Total | 36 |

Os 26 IDs antigos foram preservados, sem remoções nem renomeações. Os títulos antigos também continuam iguais. Cavalaria permanece como ramo secundário legado, mantendo seus efeitos. O novo ramo militar cobre logística, motorização, reconhecimento, blindados, engenheiros e guarnições; recrutamento, organização e fortificações reaproveitam os focos existentes.

Os seis focos industriais foram reclassificados de ECONOMY. Os três científicos foram reclassificados de POLITICS. Patronato Científico agora é raiz independente, permitindo investir em pesquisa em qualquer escolha política. Nenhum foco concede tecnologias ou slots.

Exclusividades simétricas:

- `focus_kingdom_centralization` × `focus_civil_reforms`: capacidade administrativa/fiscal versus reformas sociais locais.
- `focus_alliance_policy` × `focus_regional_projection`: cooperação versus projeção independente.

Dez focos novos: `focus_civil_reforms`, `focus_military_logistics`, `focus_motorization`, `focus_armored_corps`, `focus_combat_engineering`, `focus_regional_diplomacy`, `focus_alliance_policy`, `focus_external_guarantees`, `focus_regional_projection`, `focus_territorial_ambitions`.

Diplomacia concede somente modificadores existentes e consumidos pela engine: estabilidade, atração migratória, satisfação, defesa, manpower, renda e recrutamento. Os textos descrevem preparação e apoio doméstico. Não cria alianças, garantias ou reivindicações automaticamente.

## IA

Primeiro filtra os focos por `getFocusBlockReason`, escolhe deterministicamente e inicia por `startNationalFocus`. Ordem de prioridades: fome → ECONOMY; guerra → MILITARY; estabilidade ou satisfação abaixo de 40 → POLITICS; déficit, ouro abaixo de 100 ou desemprego acima de 20% da força de trabalho → ECONOMY; províncias com menos de duas instalações industriais → INDUSTRY; menos de um terço das tecnologias concluídas → RESEARCH; ausência de parceiros comerciais → DIPLOMACY; restante → POLITICS. Parceiros comerciais são uma aproximação simples de isolamento, pois esta função não recebe as relações diplomáticas. Sem foco válido na categoria prioritária, a ordem estável do catálogo desempata os focos válidos restantes.

## Save/load

`CURRENT_VERSION` continua 2 e `saveSystem.ts` não precisou mudar. Categorias, exclusividades e posições não entram no estado serializado. Saves V1 e V2 preservam IDs antigos, foco ativo e progresso válido; bots passam pela mesma normalização.

`normalizeTechState` filtra IDs inexistentes, deduplica conclusões e agora zera progresso órfão e limita progresso negativo a zero. Não revalida requisitos ou exclusividade de um foco ativo legado: ele pode terminar. Se ambos os exclusivos já estiverem concluídos, preserva ambos e seus bônus, sem decidir retroativamente qual remover. A normalização é determinística e idempotente.

## Arquivos

Criados:

- `src/data/technology/focuses/diplomatic.ts`
- `src/data/technology/focuses/validation.ts`
- `src/engine/__tests__/focusTreeV2.test.ts`
- `src/engine/__tests__/focusRewardCompatibility.test.ts`
- `src/components/__tests__/focusTreeV2.test.tsx`
- `docs/focus-tree-v2-step-1.md`

Alterados:

- `src/types/technology.ts`
- `src/data/technology/focuses/index.ts`
- `src/data/technology/focuses/economic.ts`
- `src/data/technology/focuses/military.ts`
- `src/data/technology/focuses/political.ts`
- `src/engine/technology.ts`
- `src/engine/aiEngine/aiEconomy.ts`
- `src/hooks/app/useTechActions.ts`
- `src/App.tsx`
- `src/components/FocusModal.tsx`
- `src/engine/__tests__/nationalFocuses.test.ts`
- `src/engine/__tests__/saveSystem.test.ts`

## Testes e validação

Novos testes cobrem disponibilidade, conclusão, requisitos, foco ativo, exclusividade nos dois sentidos, cancelamento sem afetar pesquisa, reinício sem progresso, conclusão diária, dificuldade e leis, soma de bônus, unidades modernas, IDs legados, normalização idempotente, seis prioridades da IA, chamada à API canônica, invariantes e ciclos, os dezesseis RewardEffect e a modal funcional. Os testes existentes de catálogo foram atualizados para seis categorias; os de save/load ganharam round-trip V2, carregamento V1, normalização de bots e cancelamento sem migração. Nenhum teste anterior foi removido ou silenciado.

Validação final: `npm run lint`, `npm run typecheck`, `npm run test:run` e `npm run build` aprovados. Suíte completa: 50 arquivos, 787 testes. O build informa o aviso de bundle acima de 500 kB. Diff revisado e `git diff --check` sem erros de whitespace.

## Limitações e próximos passos

A modal conserva o layout de cards atual, com as seis categorias e motivos de bloqueio no título do botão. Não implementa nós compactos, tooltip detalhada, conexões, zoom ou drag. A UI V2 futura pode consumir as posições e exclusividades já presentes.

`BUILD_COST` permanece dívida conhecida e não foi utilizado nos novos focos. `BUILD_TIME` positivo continua acelerando construção; valores negativos de `RECRUITMENT_TIME` e `MILITARY_MAINTENANCE` continuam sendo bônus. `DEFENSE_BONUS` mantém o comportamento de fortificações. Não há terceiro sistema de efeitos, research slots, mudanças de Technology V2 ou overhaul de diplomacia/economia.

Sem commit ou push.
