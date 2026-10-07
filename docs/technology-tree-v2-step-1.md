# Technology Tree V2 — Passo 1

## Arquitetura e escopo

O catálogo possui 32 tecnologias genéricas: MILITARY 11, INDUSTRY 7, ECONOMY 6 e SOCIETY 8. `Technology` ganhou `position: { column, row }`, com coordenadas lógicas inteiras, sem pixels. `CountryTechState` permanece com os mesmos campos, uma única `activeResearchId` e um único `researchProgressDays`.

`getTechnologyBlockReason` centraliza inexistência, conclusão anterior, pesquisa ativa, pré-requisitos e ouro. Engine, ResearchModal, ações do jogador e IA usam essa regra. `startTechnologyResearch` retorna estado e custo; bloqueios retornam `{ techState: null, cost: 0 }`. O débito continua nos callers, somente após sucesso. O hook consulta e atualiza os refs imediatamente, impedindo dois inícios e dois débitos antes do próximo render.

`processDailyTechProgress` mantém a API do game loop e executa foco primeiro, pesquisa depois. `processDailyResearchProgress` normaliza o estado e mantém dificuldade da IA, bônus tecnológicos/de foco, modificadores de leis, notificações, conclusão única e reset. Assim, um foco concluído nesse tick pode acelerar a pesquisa no mesmo tick, como antes.

`cancelTechnologyResearch` remove a pesquisa e zera todo progresso, sem reembolso. `useTechActions.handleCancelResearch` atualiza estado/ref e emite o aviso. App apenas conecta o callback; cancelamento de foco não mudou.

## Catálogo e grafo

Todos os 15 IDs anteriores, títulos, custos, durações, pré-requisitos e efeitos foram preservados. Agricultura, serrarias, mineração e ferramentas foram reclassificadas de ECONOMY para INDUSTRY. Administração Comercial continua em ECONOMY, inclusive com sua dependência de Agricultura Melhorada, agora entre categorias.

| Categoria | ID preservado | Pré-requisitos |
| --- | --- | --- |
| MILITARY | military_organization | — |
| MILITARY | improved_weapons | military_organization |
| MILITARY | military_logistics | military_organization |
| MILITARY | fortifications | improved_weapons |
| MILITARY | professional_army | military_logistics, improved_weapons |
| INDUSTRY | improved_agriculture | — |
| INDUSTRY | advanced_sawmills | — |
| INDUSTRY | advanced_mining | — |
| INDUSTRY | standardized_tools | advanced_sawmills, advanced_mining |
| ECONOMY | commercial_administration | improved_agriculture |
| SOCIETY | sanitation | — |
| SOCIETY | medicine | sanitation |
| SOCIETY | public_administration | — |
| SOCIETY | education | public_administration |
| SOCIETY | urbanization | medicine |

As 17 tecnologias novas:

| Categoria | Tecnologia / ID | Pré-requisitos | Efeito |
| --- | --- | --- | --- |
| MILITARY | Motorização / motorization | military_logistics | manutenção −5% |
| MILITARY | Blindados / armor | professional_army | combate geral +5% |
| MILITARY | Artilharia Avançada / advanced_artillery | improved_weapons, motorization | combate geral +5% |
| MILITARY | Engenharia Militar / military_engineering | fortifications | fortificação +10% |
| MILITARY | Reconhecimento / reconnaissance | improved_weapons | combate geral +5% |
| MILITARY | Doutrina Logística / logistics_doctrine | motorization, military_engineering | manutenção −5% |
| INDUSTRY | Produção em Massa / mass_production | standardized_tools | produção geral +5% |
| INDUSTRY | Infraestrutura Industrial / industrial_infrastructure | standardized_tools | produção geral +5% |
| INDUSTRY | Produtividade Industrial / industrial_productivity | mass_production, industrial_infrastructure | produção geral +5% |
| ECONOMY | Mercados Organizados / organized_markets | — | renda +5% |
| ECONOMY | Comércio Interno / internal_commerce | organized_markets | renda +5% |
| ECONOMY | Administração Fiscal / fiscal_administration | organized_markets | renda +5% |
| ECONOMY | Eficiência Econômica / economic_efficiency | internal_commerce, fiscal_administration, commercial_administration | renda +5% |
| ECONOMY | Gestão Nacional / national_management | economic_efficiency | produção geral +5% |
| SOCIETY | Educação Técnica / technical_education | education | produção geral +5% |
| SOCIETY | Instituições Científicas / scientific_institutions | technical_education | pesquisa +10% |
| SOCIETY | Saúde Pública Avançada / advanced_public_health | medicine, urbanization | crescimento +10% |

Novos custos/durações crescem com a linha: 400 + 100 × row de ouro; 40 + 10 × row de dias. Bônus mantêm a acumulação aditiva existente.

## Validação estrutural

`validateTechnologyTree` retorna todos os erros sem modificar dados. Verifica IDs únicos, referências existentes, ausência de autodependência, pré-requisitos não duplicados, coordenadas inteiras não negativas, posições únicas **por categoria**, ciclos e linha de cada pré-requisito estritamente anterior à do sucessor, inclusive entre categorias. O catálogo real é validado em testes; a função também aceita definições externas para validação.

## IA

Fluxo: catálogo → filtro canônico → prioridade determinística → início canônico → débito e log após sucesso. Prioridade militar em guerra; industrial com escassez de bens ou menos de duas instalações produtivas em alguma província; econômica com déficit ou renda menor que 5; social nos demais casos de paz. Apenas províncias do próprio país entram na avaliação. Ordem do catálogo desempata e fornece fallback quando a categoria preferida não possui candidato disponível.

## Save/load

`CURRENT_VERSION` continua 2. Não há nova migration nem alteração no saveSystem. Categoria e posição pertencem às definições e não são serializadas no estado tecnológico. O normalizador existente preserva IDs/progresso válidos, filtra referências inválidas, deduplica conclusões, zera progresso órfão e limita progresso negativo. Saves V1 continuam usando a migração existente; saves V2 continuam sendo normalizados, inclusive bots. Pesquisas antigas não são revalidadas contra os pré-requisitos ao carregar.

## Testes e arquivos

Criados: `industry.ts`, `validation.ts` em `src/data/technology/technologies`; `technologyTreeStep1.test.ts` e `technologyActionsStep1.test.tsx` em `src/engine/__tests__`; este relatório.

Alterados: `src/types/technology.ts`; catálogo `military.ts`, `economic.ts`, `infrastructure.ts`, `index.ts`; `src/engine/technology.ts`; `src/engine/aiEngine/aiEconomy.ts`; `src/hooks/app/useTechActions.ts`; `src/App.tsx`; `src/components/ResearchModal.tsx`; testes `technology.test.ts` e `saveSystem.test.ts`.

Novos testes cobrem catálogo/15 IDs, casos estruturais inválidos, bloqueios com custo zero, cancelamento imutável, dificuldade/leis/bônus, conclusão/notificação, normalização, quatro prioridades da IA, API canônica, falha sem débito/log e duplo clique do jogador sem duplo débito. Os testes V1/V2 existentes foram ampliados com pesquisa ativa, progresso fracionário, conclusões e normalização de bots, mantendo as verificações de foco. O mock antigo de tecnologia passou a usar `effects`; sua expectativa de custo bloqueado foi atualizada para zero. Nenhum teste foi removido ou silenciado. Testes de produção, combate, população, manutenção e composição TechnologyEffect/RewardEffect permanecem na suíte.

## Limitações e dívidas técnicas

- Bônus militares permanecem genéricos para todos os UnitTypes. Blindados, motorização e reconhecimento não desbloqueiam unidades, nem adicionam movimento, visão ou bônus exclusivos por unidade.
- Tecnologias comerciais representam renda/produtividade pelos efeitos já integrados; não modificam diretamente preços, rotas ou eficiência do comércio interno.
- Infraestrutura Industrial melhora produção, sem desconto de construção, capacidade de armazenamento ou novas instalações.
- Nenhum efeito novo, terceiro sistema de efeitos ou unificação com RewardEffect foi criado.
- Balanceamento do catálogo e prioridades simples da IA podem ser refinados com dados de partidas.
- ResearchModal mantém cards e layout atuais, apenas com quatro categorias e validação central. As posições serão consumidas pela UI V2 no passo 2.
- Research slots, filas e múltiplas pesquisas continuam fora do escopo.
- Os 36 focos, suas definições, posições, exclusões e FocusModal não foram alterados. Nenhum refactor amplo, commit ou push foi realizado.

## Validação final

`npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` e `git diff --check` passaram. A suíte terminou com 52 arquivos e 828 testes aprovados. O build emitiu aviso de chunk JavaScript acima de 500 kB; otimização de bundle ficou fora deste passo. Diff revisado, incluindo os novos arquivos: sem mudança de versão do save, slots, remoção dos IDs antigos ou alterações na árvore/UI de foco.
