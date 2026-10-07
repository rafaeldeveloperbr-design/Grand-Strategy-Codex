# Buildings / Construction V2

Implementado sobre o mercado provincial, a fila e os ticks existentes. Nenhum sistema econômico, militar, político ou logístico foi substituído. A versão é suficiente com os quatro bens atuais; Units V3 é uma extensão opcional.

## Fonte de verdade e APIs

`src/data/buildings.ts` mantém `BUILDING_DEFINITIONS`. Os campos existentes `type`, `name`, `baseCost`, `resourceCost`, `baseBuildTime` e `bonusPerLevel` correspondem a id, label, custo de ouro, custos de recursos, prazo e efeitos. Foram adicionados categoria e requisitos simples, sem criar uma segunda tabela. Emprego, produção, produtividade, armazenagem, população, defesa, supply, recrutamento e influência política consultam essa fonte.

APIs: `getBuildingLevel`, `getBuildingBonus`, `getBuildingPoliticalInfluence`, `getBuildingEffect`, `getBuildingUpgradeCost`, `getBuildingBuildTime`, `getBuildingBlockReasons`, `canUpgradeBuilding`, `getConstructionTargetLevel`, `getMilitaryEquipmentCostMultiplier` e `meetsBuildingRequirement`. Os acessores antigos de custo/tempo permanecem compatíveis.

## Conjunto final e balance

Todos os edifícios têm níveis 0..5; ausência representa nível zero. Custos uniformes por terreno. Os efeitos abaixo são por nível concluído.

| Categoria | Edifício / ID | Ouro base | WOOD / IRON / TOOLS | Dias base | Efeito principal |
|---|---|---:|---|---:|---|
| Produção | Fazenda / farm | 220 | 12 / 0 / 2 | 30 | 3 FOOD por 1.000 trabalhadores |
| Produção | Serraria / lumber_mill | 260 | 8 / 2 / 3 | 32 | 2 WOOD por 1.000 trabalhadores |
| Produção | Mina de Ferro / iron_mine | 340 | 14 / 2 / 4 | 40 | 1,25 IRON por 1.000 trabalhadores |
| Produção | Oficina / workshop | 400 | 18 / 10 / 5 | 45 | 1 TOOLS por 1.000 trabalhadores |
| Comércio | Mercado / market | 350 | 12 / 4 / 4 | 45 | +5% produtividade |
| Comércio | Armazém / warehouse | 300 | 24 / 4 / 3 | 35 | +50% capacidade de estoque |
| População | Habitação / housing | 280 | 20 / 3 / 2 | 35 | +5.000 população máxima |
| Militar | Quartel / barracks | 450 | 16 / 12 / 8 | 40 | +15% velocidade de treinamento; +1 supply local |
| Militar | Arsenal Militar / military_arsenal | 600 | 24 / 20 / 12 | 60 | −3% consumo militar de IRON/TOOLS |
| Defesa | Fortaleza / fortress | 700 | 20 / 24 / 12 | 60 | +2 defesa |
| Infraestrutura | Infraestrutura / infrastructure | 520 | 20 / 14 / 10 | 55 | +4% produtividade; +8% logística; +2 supply local |

Produção usa a alocação de trabalhadores existente, sem duplicar mão de obra. O resultado é multiplicado por desenvolvimento (`0,5 + desenvolvimento × 0,1`), produtividade e satisfação. FOOD preserva subsistência. Oficina consome exatamente 1 WOOD e 0,75 IRON por TOOLS; falta de insumo limita proporcionalmente a produção.

Com nível atual L, preservam-se as fórmulas existentes: ouro = `floor(base × 1,5^L)`; cada recurso = `ceil(base × 1,5^L)`; tempo = `ceil(diasBase × 1,25^L)`. Leis, tecnologia e estabilidade continuam afetando o avanço da obra. Níveis inválidos são normalizados a inteiros 0..5.

## Construção e pagamento

Uma nova obra exige ausência de obra pendente naquela província, nível abaixo de cinco, ouro, recursos e requisito atendido. O Arsenal exige Quartel nível 1 **ou** Infraestrutura nível 1 concluídos. A lista tipada de códigos de bloqueio e suas mensagens são compartilhadas por engine, UI e IA.

`startBuilding` valida controle territorial e paga ouro/recursos uma vez, usando os estoques reais conectados pelo comércio doméstico existente. Falha não altera o estado. IDs de obras são determinísticos. A conclusão incrementa o nível até cinco, sem incorporar bônus de defesa à defesa base.

Filas antigas com várias obras continuam executando apenas a primeira por província; não são descartadas. Perda territorial cancela obras do antigo proprietário. Cancelamento preserva o reembolso existente: ouro proporcional ao prazo restante (mínimo de 10%) para obra ativa, ou ouro integral para itens em espera. Bens pagos não são devolvidos. Obras embutidas em saves antigos mantêm o avanço econômico anterior e aparecem na UI.

## Arsenal e Military V2

Multiplicador de equipamento = `1 − nível × 0,03`, de 1 até 0,85. Recrutamento e reinforcement passam a consumir menos IRON/TOOLS reais; ouro e manpower não recebem desconto. Reinforcement só usa Arsenal em território controlado pelo próprio exército. Não concede ataque, defesa, moral ou recuperação gratuita, não altera unidades nem a rede logística. O helper de requisitos pode ser usado opcionalmente por unidades avançadas no futuro, sem requisito novo para as unidades atuais.

O quartel aplica seu bônus de velocidade no avanço diário de recrutamento. Foi removido o desconto adicional de prazo inicial que duplicava o efeito do edifício. Recrutamentos já pagos não têm seus dias restantes reescritos. Supply crítico continua sem drenar organização ou moral.

## Integrações

- **Economy V2.1:** produção, custos e consumo permanecem nos estoques provinciais. Armazéns aumentam sua capacidade real. Mercado aumenta produtividade e emprego; preço, poder de compra e escassez respondem pelas fórmulas existentes. Nenhum recurso ou bônus monetário artificial foi criado. Matching internacional e reservas comerciais permanecem intactos.
- **Population:** cap de Habitação preservado; empregos por nível centralizados. Arsenal adiciona capacidade de emprego de 2,5% da população por nível, limitada à força de trabalho existente.
- **Logistics V2:** o balance logístico deriva os 8% da definição de Infraestrutura e mantém clamp 1,4. Bônus aplicado somente na rede. Supply local já existente de Infraestrutura/Quartel continua separado. Terrain V1 não é multiplicado novamente pelo supply conectado.
- **Terrain / defesa:** Fortaleza fornece +2 por nível nos cálculos existentes, separado do multiplicador de terreno; não se acumula na defesa base ao concluir.
- **Politics V1:** influência bruta por nível centralizada: Fazenda → Proprietários +4; Mercado → Comerciantes +5; Oficina → Trabalhadores +4; Quartel → Militares +4; Arsenal → Trabalhadores +3 / Militares +4; Fortaleza → Militares +2; Infraestrutura → Reformistas +2. Normalização e approvals políticos existentes permanecem.
- **Diplomacy / Rebellion:** sem novas regras; defesa de fortalezas usa o efeito centralizado. Nenhum novo tipo rebelde, unidade ou bem.

## IA

`buildings/constructionAI.ts` compara todas as províncias controladas por score, desempata por ID provincial/tipo e considera affordability via API compartilhada. Nenhum projeto recebe score positivo incondicional.

Sinais: déficits/estoques abaixo de dois dias; fome severa; estoque a 90% do limite; população a 90% do cap; rede conectada com eficiência abaixo de 90%; recrutamento local; atividade militar em capital/província guarnecida; fronteira estrangeira durante guerra; desemprego com insumos disponíveis; poder de compra baixo com desemprego. Infraestrutura não é sugerida para uma ilha desconectada que ela não pode reconectar.

Reserva de ouro de construção: 150. Score mínimo: 10. Score é reduzido por nível atual e custo relativo ao tesouro. Uma decisão inicia no máximo uma obra por país; obras pendentes bloqueiam outra na província. A IA de recrutamento usa o estado provincial já atualizado após o pagamento da construção, impedindo restauração acidental de recursos gastos.

## UI

Onze cards em seis categorias, com nível atual/máximo, efeito quantitativo atual e próximo, descrição, custos discriminados, prazo e todos os bloqueios. Produção informa base e dependência de trabalhadores/desenvolvimento, sem prometer rendimento fixo. A seção de obras mostra nível alvo, prazo restante e progresso; o cancelamento existente permanece em Atividades.

## Saves e migração

Versão do save permanece **2**. Persistem edifícios e fila existentes; nenhuma cache ou tabela derivada adicional. Arsenal ausente é nível zero.

Aliases: `lumber → lumber_mill`, `ironMine → iron_mine`, `fortification → fortress`, `temple → housing`, `port → market`, `university → infrastructure`. Migração atua tanto em edifícios quanto na fila V1/V2. Preserva IDs, custos pagos, recursos pagos, prazo, ordem e níveis. Edifício concluído e upgrade embutido pendente são mantidos separadamente; aliases duplicados concluídos usam o maior nível, limitado a cinco. Tipos desconhecidos não são usados em cálculos de engine.

## Auditoria, testes e limites

Corrigidos: bônus de quartel duplicado; aliases não migrados em filas; upgrade embutido ocultando o nível concluído; obras do antigo proprietário terminando após perda territorial; recrutamento da IA restaurando estoques anteriores ao pagamento de construção. Removidos o caminho não utilizado `queueBuilding` que pagava só ouro, validação de recursos repetida e tabelas duplicadas de jobs/traduções/influência. Testes antigos de fila foram atualizados para bloqueio de novas obras; processamento serial de filas legadas continua coberto.

Suítes dedicadas: `engine/__tests__/buildingsV2.test.ts` e `components/__tests__/buildingsV2.test.tsx`, incluindo transações, produção, Arsenal, logística, política, IA, UI e save/load real. A suíte completa verifica regressões dos sistemas existentes.

Navegador integrado indisponível nesta sessão: sem inspeção visual ou console de uma partida. Renderização/interação da UI validada em jsdom. Balance de longo prazo ainda pode exigir ajustes em partidas. A IA considera fronteira estrangeira durante guerra como ameaça simples; não simula inteligência estratégica de obras. Nenhuma cadeia industrial, ferrovia, porto, nova unidade ou transporte físico foi criado. Futuras unidades podem consultar o Arsenal, mas não são dependência deste sistema.

## Arquivos e validação final

Criados: este documento, `constructionAI.ts`, `engine/__tests__/buildingsV2.test.ts` e `components/__tests__/buildingsV2.test.tsx`.

Alterados: `types/province.ts`, `data/buildings.ts`, `utils/translations.ts`, `engine/buildings.ts`, `engine/market.ts`, `engine/population.ts`, `engine/economy.ts`, `engine/saveSystem.ts`, `engine/aiEngine/aiEconomy.ts`, `engine/logistics/balance.ts`, `engine/politics/index.ts`, `engine/politics/balance.ts`, `engine/military/recruitmentEngine.ts`, `engine/military/recoveryEngine.ts`, `engine/military/supplyEngine.ts`, `engine/combat/combatCalculations.ts`, `engine/combat/continuousBattle.ts`, `engine/rebellion/rebellionAI.ts`, `hooks/gameLoop/aiTick.ts`, `hooks/gameLoop/economyTick.ts`, `components/ProvincePanel/ProvinceBuildingsTab.tsx`, `components/ProvincePanel/ProvinceSidebar.tsx`, `engine/__tests__/productiveBuildings.test.ts` e `engine/__tests__/economy.test.ts`.

Validação na branch `feat/Buildings-V2`: lint, typecheck, build e test:run passaram; 654 testes em 40 arquivos, dos quais 48 testes novos dedicados. `git diff --check` passou. Build avisou sobre chunk JavaScript acima de 500 kB; Node emitiu aviso experimental de localStorage no ambiente de testes, sem falhas. Sem commit ou push.
