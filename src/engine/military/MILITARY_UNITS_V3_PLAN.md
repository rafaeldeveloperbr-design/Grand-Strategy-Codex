# Military Units V3 moderno — auditoria e plano

> Registro da etapa preparatória preservado. O catálogo moderno foi posteriormente implementado na branch `feat/Military-Units-V3`; decisões finais, compatibilidade e balance estão em [MILITARY_UNITS_V3.md](./MILITARY_UNITS_V3.md). Os trechos abaixo descrevem o estado auditado antes dessa implementação.

## Escopo desta etapa

Auditoria realizada na branch atual `feat/Buildings-V2`, com árvore limpa no início. Nenhuma unidade moderna foi implementada. Catálogo, custos, balance, IA, UI, recrutamento, combate e formato de saves continuam iguais. Não houve commit ou push.

Catálogo ativo (sete IDs): `infantry`, `cavalry`, `artillery`, `archers`, `heavy_cavalry`, `elite_guard`, `siege_engine`.

Catálogo moderno pretendido (sete IDs): `infantry`, `motorized_infantry`, `armor`, `artillery`, `reconnaissance`, `engineers`, `garrison`.

`infantry` e `artillery` são IDs compartilhados. `heavy_cavalry`, `elite_guard` e `siege_engine`, além de `cavalry`/`archers`, precisam de uma decisão explícita na migração futura. Não existe equivalência segura automática entre cavalaria e blindados.

## Infraestrutura tipada implementada agora

Somente `src/types/army.ts` recebeu mudanças de código:

- `UnitType` continua exatamente com os sete IDs ativos atuais.
- `ModernUnitType` descreve os sete IDs planejados, somente em nível de tipo.
- `PlannedUnitType` é a união dos IDs atuais e planejados.
- `UnitDefinition<TType extends PlannedUnitType = UnitType>` permite especificar uma futura definição tipada, por exemplo `UnitDefinition<'armor'>`. A utilização sem parâmetro mantém o contrato anterior.

Não há definições, instâncias, listas de disponibilidade, requisitos, conversores, caches ou campos persistidos modernos. `Army`, `Regiment`, `Recruitment` e relatórios continuam aceitando apenas `UnitType`. Portanto `createRegiment('armor')` e `queueRecruitment('armor', ...)` continuam inválidos em TypeScript. `UNIT_DEFINITIONS` segue um `Record<UnitType, UnitDefinition>` completo, sem tornar acessos opcionais e sem liberar um ID sem definição. Os novos tipos são exportados pelo `src/types/index.ts` já existente.

## Inventário: referências diretas e consumidores do catálogo

Os caminhos abaixo são relativos à raiz do repositório. “Adaptar” indica dependência concreta da futura migração, não alteração feita nesta etapa.

| Área | Arquivo | Dependência / trabalho futuro |
|---|---|---|
| Tipos | `src/types/army.ts` | União ativa; definição; `Regiment.type`; `Recruitment.unitType`; composição em `BattleSideReport`/`BattleSideSnapshot`. Ativar IDs somente com catálogo completo. |
| Exportação | `src/types/index.ts` | Reexporta os contratos; verificar imports públicos. |
| Catálogo e custo bruto | `src/data/units.ts` | Sete definições completas e `getRecruitmentCost`; stats, manpower, ouro, IRON/TOOLS, prazo, tecnologia, supply e manutenção. |
| Criação | `src/engine/military/militaryUtils.ts` | `createRegiment` consulta limites e defaults; `calculateArmySpeed` usa a menor mobilidade. Não há switch de quatro IDs. |
| Recrutamento | `src/engine/military/recruitmentEngine.ts` | Lookup por ID; validação de tecnologia, pagamento, prazo, custos pagos, processamento, cancelamento. |
| Stats / custos contínuos | `src/engine/military/armyStats.ts` | Ataque/defesa/choque, moral/organização normalizadas, cerco, supply e manutenção derivados das definições. |
| Recuperação | `src/engine/military/recoveryEngine.ts` | Limites por unidade; custo de reinforcement ainda genérico por homem; desconto do Arsenal sobre IRON/TOOLS. |
| Combate legado | `src/engine/combat/combatCalculations.ts` | Tabela separada `UNIT_POWER_MULTIPLIERS` para sete IDs; fallback 1; branches tecnológicos somente infantry/cavalry/artillery. |
| Resolução legada | `src/engine/combat/battleResolver.ts` | Assinaturas de bônus com apenas três IDs; reavaliar em conjunto com cálculo legado. |
| Combate diário | `src/engine/combat/continuousBattle.ts` | Stats genéricas e composição `Partial<Record<UnitType, number>>`; assinatura antiga de bônus com três IDs. |
| Relatórios / loop | `src/hooks/gameLoop/battleContinuousTick.ts` | Bônus por país usa **máximo** de infantry/cavalry/artillery; snapshots e união de IDs na composição. |
| Tipos tecnológicos | `src/types/technology.ts` | `UnitKind` distinto de `UnitType`, limitado a três IDs; `RewardEffect.COMBAT_POWER.unitType`. |
| Tecnologia | `src/engine/technology.ts` | `TechnologyBonuses.combatPowerBonus`, defaults e efeitos globais enumeram três IDs; efeitos de foco específicos indexam esses IDs. |
| Focos | `src/data/technology/focuses/military.ts` | Focos de infantaria, artilharia e cavalaria; IDs de focos já concluídos precisam continuar reconhecidos. |
| Desbloqueios | `src/data/technology/technologies/military.ts` | Tecnologias exigidas pelas unidades atuais (`improved_weapons`, `professional_army`, `fortifications`); preservar IDs e progresso antigo ao definir requisitos modernos. |
| IA de composição | `src/engine/aiEngine/aiEconomy.ts` | Enumera catálogo, porém `desiredWeight: Record<UnitType, number>` fixa sete pesos; guerra muda artilharia/cerco. Contagem considera recrutamentos pendentes. |
| Estado inicial | `src/data/map/initialState.ts` | Cria infantaria com valores explícitos de força/moral/organização e velocidade inicial; reavaliar defaults quando o balance futuro existir. |
| Cheats | `src/hooks/app/useCheats.ts` | Spawn explícito: 9 infantry, 4 cavalry, 2 artillery, 1 archers; godMode atribui moral/org 100. Não remover suporte legado ao modernizar. |
| Spawn rebelde | `src/engine/rebellion/rebellionSpawner.ts` | Infantaria explícita, limites vindos da definição. Escolher composição futura sem reescrever Rebellion V2. |
| Reforço rebelde | `src/engine/rebellion/reinforcements.ts` | Limites por ID e infantaria explícita nos novos regimentos. |
| Migração rebelde | `src/engine/rebellion/rebellionMigration.ts` | Lookup direto na definição durante load; divide regimentos grandes e normaliza limites. ID ausente pode impedir carregar o save. |
| Ação do jogador | `src/hooks/app/useEconomyActions.ts` | Recrutamento recebe `UnitType` e passa pelo motor central. |
| UI provincial | `src/components/ProvincePanel/ProvinceMilitaryTab.tsx` | Enumera todas as chaves do catálogo para oferecer recrutamento; mostra role/stats/custos/prazo. Exige separar catálogo compatível de unidades recrutáveis na migração. |
| Props provinciais | `src/components/ProvincePanel/ProvincePanel.tsx` | Callback de recrutamento tipado com `UnitType`. |
| Fila na UI | `src/components/ProvincePanel/ProvinceSidebar.tsx` | Definição do ID da fila, nome/ícone e duração base para progresso. |
| Mapa | `src/components/GameMap/ProvinceLayer.tsx` | Lookup por `Recruitment.unitType` para mostrar recrutamento no tooltip. |
| UI principal | `src/App.tsx` | Lookup direto em regimentos para exibir nome/ícone/força. |
| Relatório visual | `src/components/BattleReportModal.tsx` | Dicionário local de sete labels duplicado; composição dinâmica com fallback para ID bruto. |
| Traduções | `src/utils/translations.ts` | Dicionário `UNIT_NAMES` com sete IDs; `getUnitName` usado nos logs. |

## Inventário: dependências indiretas e regressões obrigatórias

Estes arquivos não precisam necessariamente de edição por novo ID. Devem ser revisados/testados porque usam tropas, stats, filas, snapshots ou estado militar derivados. A migração não deve reescrevê-los por preferência arquitetural.

| Área | Arquivos | Motivo |
|---|---|---|
| Supply | `src/engine/military/supplyEngine.ts`, `src/engine/military/balance.ts` | Demanda vem de `calculateArmySupplyUse`; capacidade territorial não depende de um ID específico. Preservar compartilhamento e ratio 0..1. |
| Movimento | `src/engine/military/movementEngine.ts`, `src/hooks/gameLoop/movementTick.ts`, `src/hooks/app/useArmyActions.ts`, `src/hooks/app/useGameSelection.ts` | Mobilidade, divisão/fusão, seleção e rotas. Não reescrever BFS/pathfinding. |
| Exportação militar | `src/engine/military/index.ts` | API pública dos motores. |
| Batalha | `src/types/battle.ts`, `src/engine/combat/battleFinalizer.ts`, `src/engine/combat/combatRetreats.ts`, `src/hooks/gameLoop/battleArrivalTick.ts` | Participantes, snapshots de Army, baixas, captura e retirada. |
| IA militar | `src/engine/aiEngine/aiMovement.ts`, `src/hooks/gameLoop/aiTick.ts` | Scores derivados de força, cerco, supply e mobilidade; conferir equilíbrio com novas composições. |
| Tick e refs | `src/hooks/gameLoop/economyTick.ts`, `src/hooks/useGameLoop.ts`, `src/hooks/useGameRefs.ts` | Recuperação/recrutamento, manutenção, estado militar e caches transitórios. |
| Save/load | `src/engine/saveSystem.ts`, `src/hooks/app/useSaveSystem.ts`, `src/types/gameState.ts`, `src/data/map/saveCompatibility.ts` | Persistem/restauram Army, Recruitment e ActiveBattle. Compatibilidade de mapa é separada da compatibilidade de unidades. |
| Economia / população | `src/engine/economy.ts`, `src/engine/population.ts`, `src/engine/market.ts` | Custos de manutenção, homens estacionados, demanda FOOD e baixas provinciais. Manter quatro bens atuais e estoques reais. |
| Arsenal / construção | `src/data/buildings.ts`, `src/engine/buildings/constructionAI.ts` | `getMilitaryEquipmentCostMultiplier`, `meetsBuildingRequirement`; Arsenal não concede ataque e pode fornecer requisito futuro opcional. |
| Logística / terreno | `src/engine/logistics/index.ts`, `src/engine/logistics/balance.ts`, `src/engine/terrain/index.ts` | Capacidade e modifiers territoriais já existentes; novas cargas usam o supply atual. Não adicionar transporte físico nem segunda penalidade de terreno. |
| Política / diplomacia | `src/engine/politics/index.ts`, `src/engine/diplomacy/diplomacyAI.ts` | Influência militar/manutenção e avaliação de força derivadas; sem nova diplomacia ideológica. |
| Rebelião / território | `src/engine/rebellion/rebellionAI.ts`, `src/engine/rebellion/rebellionEngine.ts`, `src/engine/rebellion/rebellionObjectives.ts`, `src/engine/rebellion/rebellionUtils.ts`, `src/engine/territoryTransfer.ts`, `src/hooks/gameLoop/rebelTick.ts` | Objetivos, força, progressão e transferência de unidades/filas. |
| Legado rebelde | `src/engine/rebellions/rebelAccumulation.ts`, `src/engine/rebellions/rebelHelpers.ts` | Consomem tipos/dados militares antigos; verificar uso antes de remover. Não remover nesta etapa. |
| UI derivada | `src/components/ArmyMarker.tsx`, `src/components/GameMap/GameMap.tsx`, `src/components/GameMap/mapPresentation.ts`, `src/components/ProvincePanel/ProvinceInfoTab.tsx` | Força/supply, agrupamentos, seleção e informações militares. |
| Estilos | `src/styles/province-panel.css`, `src/styles/system.css` | Sem IDs militares; validar legibilidade das novas labels quando a UI mudar. |

## Inventário de testes

Referências diretas a IDs ou catálogo:

- `src/engine/__tests__/militaryV2.test.ts`
- `src/engine/__tests__/combat.test.ts`
- `src/engine/__tests__/movement.test.ts`
- `src/engine/__tests__/buildingsV2.test.ts`
- `src/engine/__tests__/productiveBuildings.test.ts`
- `src/engine/__tests__/population.test.ts`
- `src/engine/__tests__/rebellionV2.test.ts`
- `src/engine/__tests__/rebellionLifecycle.test.tsx`
- `src/engine/__tests__/diplomacyV2.test.tsx`
- `src/engine/__tests__/technology.test.ts`
- `src/engine/__tests__/technologyV2.test.ts`
- `src/engine/__tests__/nationalFocuses.test.ts`
- `src/engine/__tests__/territoryTransfer.test.ts`
- `src/engine/__tests__/unrest.test.ts`
- `src/engine/__tests__/helpers/southAmericaAudit.ts` (fixture compartilhado cria infantaria; alterações se propagam a várias suítes)
- `src/components/GameMap/__tests__/uiV2.test.tsx`

Regressões indiretas e fixtures militares adicionais:

- `src/engine/__tests__/saveSystem.test.ts`
- `src/engine/__tests__/campaignMovement.test.ts`
- `src/engine/__tests__/mapRouting.test.ts`
- `src/engine/__tests__/movementSouthAmerica.test.ts`
- `src/engine/__tests__/supplySouthAmerica.test.ts`
- `src/engine/__tests__/southAmerica.test.ts`
- `src/engine/__tests__/southAmericaRendering.test.tsx`
- `src/engine/__tests__/logisticsV2.test.ts`
- `src/engine/__tests__/terrainV1.test.tsx`
- `src/engine/__tests__/economyV2_1.test.ts`
- `src/engine/__tests__/internalPoliticsV1.test.ts`
- `src/engine/__tests__/diplomacyAIProposals.test.ts`
- `src/components/__tests__/buildingsV2.test.tsx`
- `src/components/__tests__/internalPoliticsV1.test.tsx`
- `src/components/GameMap/__tests__/logisticsV2.test.tsx`

Documentação relacionada: `src/engine/rebellion/REBELLION_V2.md` contém IDs atuais; revisar junto dos documentos de Military V2, Buildings V2, Logistics V2 e Terrain V1 ao ativar V3. Não alterar descrições de sistemas anteriores antes da migração real.

## Dependências e riscos encontrados

1. **União ativa e catálogo completo:** ampliar `UnitType` agora exigiria definições modernas ou tornaria lookups inseguros. Tornar `UNIT_DEFINITIONS` parcial não é uma solução segura. UI e IA enumeram esse catálogo e passariam a oferecer unidades imediatamente.
2. **Dois caminhos de combate:** cálculo legado usa multiplicadores explícitos por ID; combate diário usa stats/organização/supply e um multiplicador tecnológico por país. O parâmetro `_techBonusesByCountry` de `checkAllProvinceCombats` é ignorado; não considerá-lo uma integração funcional. Adicionar só uma definição pode funcionar no diário e cair silenciosamente no fallback 1 do legado. Resolver a semântica de bônus antes de balancear V3.
3. **Tecnologia não é totalmente por unidade:** `UnitKind` tem três IDs; tecnologia genérica aplica COMBAT_POWER aos três; foco aplica a um ID específico; loop diário escolhe o maior bônus e o aplica ao país. Não assumir que o bônus de cavalaria já representa motorized/armor. Manter efeitos atuais intactos nesta etapa.
4. **Save não valida todos os IDs:** guardas atuais validam principalmente a estrutura geral. Army/Recruitment/snapshots têm strings persistidas; vários consumidores indexam diretamente a definição. Especialmente `normalizeRebelRegiments` faz isso durante load. ID desconhecido não pode ser convertido silenciosamente em infantaria ou descartado.
5. **Cancelamento de recrutamento:** `paidCost` existe na fila, mas `cancelRecruitment` ainda calcula reembolso com custo/prazo da definição atual. Mudança futura de balance pode produzir reembolso incorreto. Corrigir em etapa própria antes da conversão, preservando fallback para filas antigas sem paidCost; não foi alterado aqui.
6. **Prazo de treinamento:** leis/tecnologia influenciam prazo inicial e multiplicador de avanço no loop econômico. Auditar essa composição antes de definir tempos V3; não mexer no balance nesta preparação. O Quartel já aplica seu bônus no avanço diário após Buildings V2.
7. **Manpower versus força máxima:** não são sempre iguais (artillery custa 1.000 manpower e tem 600 de força máxima). Nunca converter regimentos pelo pressuposto de 1.000 homens fixos. Preservar força absoluta, baixas, experiência, origem, moral e organização.
8. **Reforcement genérico:** custos por homem não dependem do tipo, ao contrário de recrutamento. Decidir conscientemente se V3 mantém essa simplificação; não criar recursos novos ou uma economia militar paralela nesta etapa.
9. **Cheat e texto divergentes:** spawn atual soma 15.000 homens pelas definições atuais (9.000 infantry + 4.000 cavalry + 1.200 artillery + 800 archers), mas seu comentário ainda descreve 5.000 de cada uma de três unidades. Balance futuro pode invalidar o toast fixo de 15.000. GodMode usa 100 mesmo em unidades com máximo superior a 100. Apenas registrado, sem correção fora do escopo.
10. **IDs compartilhados:** redefinir infantry/artillery muda stats derivados de regimentos já salvos, mesmo sem renomeá-los. `maxStrength` persistido não congela ataque, mobilidade, manutenção ou supply. Política de compatibilidade precisa cobrir balance, não só IDs.
11. **Snapshots e relatórios:** batalhas ativas persistem snapshots completos de Army e composições. A migração precisa tratar essas cópias junto de armies e filas. `battleHistory`/relatório final não fazem parte de `SaveGameV2` atualmente; não presumir histórico persistido nem introduzi-lo como dependência de V3.

## Proposta de migração futura

Recomenda-se ativação incremental com compatibilidade explícita, sem substituição em massa de IDs por semelhança de nome:

- Manter definições legadas para unidades que ainda existam em saves/filas/snapshots. Separar **catálogo reconhecido** de **catálogo recrutável** quando a V3 for ativada. UI/IA usam o segundo; load e relatórios reconhecem ambos.
- Adicionar os cinco IDs novos somente com definições completas, comportamento de custo/supply/combate e validação. Infantry/artillery exigem decisão separada por serem compartilhados.
- Reutilizar WOOD/IRON/TOOLS, recrutamento, recuperação, terrain, supply e Logistics existentes. Arsenal pode ser requisito simples consultado por helper; não exigir Arsenal de unidades V2 já em curso.
- Generalizar os mapas de bônus tecnológicos e pesos da IA com defaults explícitos e testes de ausência de NaN. Não transformar bônus antigos em efeitos modernos por acidente.
- Remover duplicação de labels usando metadados de unidade, mantendo nomes legados em relatórios e filas. Nenhuma label moderna foi adicionada agora.
- Se conversão de unidades antigas for desejada, definir previamente uma tabela de transformação aprovada, inclusive para heavy_cavalry/elite_guard/siege_engine. Cavalo não vira blindado automaticamente. A opção mais segura inicial é preservar unidades antigas existentes e limitar apenas novos recrutamentos ao catálogo moderno.

## Compatibilidade de save

**Agora:** save continua versão 2; nenhum campo, ID ou dado militar é reescrito.

**Na implementação real:**

1. Manter leitura de V1/V2 e os sete IDs antigos. Fazer validação do catálogo na fronteira unknown antes de qualquer lookup, incluindo rebeldes e batalhas ativas. Para ID desconhecido, retornar erro de compatibilidade claro sem sobrescrever o slot; não fingir sucesso com perdas de tropas.
2. Preservar IDs de Army, owner, força, maxStrength, origem provincial, experiência, organização, moral, rota, estado de combate, filas, count, paidCost e dias restantes. Não cobrar novamente nem aplicar requisito novo a pedido já pago.
3. Preservar Army snapshots e composições iniciais/finais em ActiveBattle. Ao converter, aplicar a mesma política em todas as cópias, de forma idempotente, sem reiniciar batalhas nem recriar recursos.
4. Como infantry/artillery compartilham IDs, a recomendação para **balance estritamente preservado em saves antigos** é identificar explicitamente o conjunto de regras militares do save na etapa real e carregar defaults legados para saves sem esse marcador. Não implementar esse marcador ou catálogo versionado nesta preparação. Uma alternativa de conversão para regras modernas deve ser explicitamente autorizada e documentar rebalance inevitável.
5. Não alterar `CURRENT_VERSION` por simples expansão de IDs. Se a implementação futura exigir formato incompatível ou marcador obrigatório, criar migração versionada testada em vez de apenas mudar o número. Não prometer que uma versão antiga do jogo carregará um save criado com unidades modernas.
6. Focos/tecnologias concluídos antigos devem continuar reconhecidos: `normalizeTechState` hoje remove IDs que não existem nos catálogos. Renomear/remover focos de cavalaria sem mapa de compatibilidade perderia progresso.
7. Testar roundtrip e load real de saves antigos com todas as unidades, tropas parciais, rebeldes, filas pagas e batalhas em andamento; preservar conservação de recursos/manpower e valores finitos.

## Ordem recomendada de implementação

1. Aprovar papéis, stats e política de preservação/conversão de todos os IDs atuais, inclusive os três extras e os dois compartilhados. Nenhum balance proposto nesta etapa.
2. Criar fixtures de saves V1/V2, filas e batalhas ativas e testes de compatibilidade; preparar validação segura de IDs e reembolso por custo pago.
3. Separar catálogo compatível/recrutável e preparar tratamento de regras legadas, conforme a política aprovada.
4. Adaptar bônus tecnológicos e os dois caminhos de combate, preservando a semântica atual em fixtures legadas.
5. Introduzir definições modernas completas e só então ampliar a união ativa; integrar custos/recrutamento/Arsenal e processamento sem pagamento duplicado.
6. Validar supply, reinforcement, mobilidade e limites por unidade sobre os motores atuais; preservar critical supply sem dreno silencioso de moral/org.
7. Atualizar IA, forças iniciais, rebeldes e cheats com composições determinísticas; manter IDs legados reconhecidos.
8. Atualizar UI, traduções, progresso e battle reports; cobrir labels longas, custos, requisitos e composições mistas.
9. Executar migração idempotente, suíte completa, partidas de regressão e inspeção visual. Só aposentar definições legadas quando houver compatibilidade comprovada ou decisão explícita de ruptura.

## Critérios de aceitação desta preparação

Só tipos e este documento são alterados. `UNIT_DEFINITIONS` e todos os números permanecem iguais; cavalry/archers seguem recrutáveis; nenhum ID moderno aparece em save, UI, IA ou motor. A validação exigida é lint, typecheck, suíte existente completa e `git diff --check`. Não há build ou inspeção visual solicitados nesta etapa.

Resultado da validação: lint e typecheck aprovados; `npm run test:run` aprovou **654 testes em 40 arquivos**; `git diff --check` sem problemas. O runner emitiu o aviso experimental de localStorage do Node, sem falhas. A conferência do inventário não encontrou referência direta de código a IDs/UnitType/UNIT_DEFINITIONS fora da lista documentada.
