# Military Units V3 moderno

Implementado na branch `feat/Military-Units-V3`, após a leitura de `MILITARY_UNITS_V3_PLAN.md`. O plano anterior continua como registro da auditoria preparatória. Esta implementação ativa o catálogo moderno sem converter exércitos existentes nem substituir Military V2, Buildings V2, Terrain V1, Logistics V2, Economy V2.1 ou Rebellion V2.

## Arquitetura e tipos

`LegacyUnitType` reconhece infantry, cavalry, artillery, archers, heavy_cavalry, elite_guard e siege_engine. `ModernUnitType`/`RecruitableUnitType` reconhecem infantry, motorized_infantry, armor, artillery, reconnaissance, engineers e garrison. `UnitType`/`RecognizedUnitType` são a união: 12 IDs distintos.

`UNIT_DEFINITIONS` permanece um `Record<UnitType, UnitDefinition>` completo. `RECRUITABLE_UNIT_IDS` limita recrutamento novo, IA e UI aos sete tipos modernos. Não há fallback para um tipo arbitrário, conversão de cavalry para armor ou remoção de definições legadas.

## Balance final

Valores brutos por regimento; manutenção por dia. Ouro e tempo podem ser modificados pelas leis/tecnologia existentes. Ferro e ferramentas recebem o desconto de equipamento existente do Arsenal.

| ID / nome | Força máxima | Manpower | Ouro | Ferro | Ferramentas | Dias | Ataque | Defesa | Choque | Cerco | Mobilidade | Supply | Manutenção | Arsenal |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| infantry / Infantaria | 1000 | 1000 | 50 | 4 | 3 | 30 | 10 | 12 | 4 | 1 | 1 | 1 | 0.10 | Não |
| motorized_infantry / Infantaria Motorizada | 1000 | 1000 | 100 | 10 | 8 | 40 | 16 | 11 | 8 | 1 | 1.6 | 1.6 | 0.20 | Nível 1 |
| armor / Blindados | 500 | 500 | 240 | 24 | 18 | 70 | 32 | 18 | 28 | 4 | 1.3 | 3 | 0.50 | Nível 2 |
| artillery / Artilharia | 600 | 1000 | 120 | 12 | 8 | 60 | 20 | 5 | 6 | 18 | 0.5 | 1.8 | 0.28 | Nível 1 |
| reconnaissance / Reconhecimento | 500 | 500 | 70 | 5 | 5 | 25 | 7 | 6 | 5 | 0 | 2 | 0.7 | 0.14 | Nível 1 |
| engineers / Engenheiros | 600 | 600 | 90 | 8 | 10 | 35 | 9 | 17 | 2 | 12 | 0.9 | 1.1 | 0.15 | Nível 1 |
| garrison / Guarnição | 1000 | 1000 | 35 | 2 | 2 | 20 | 5 | 15 | 1 | 0 | 0.4 | 0.6 | 0.06 | Não |

Organização/moral máximas: infantaria e motorizada 100/100; blindados 90/100; artilharia 80/85; reconhecimento 95/90; engenheiros 100/95; guarnição 95/90. Artilharia também exige a tecnologia existente `improved_weapons` (Armas Melhoradas).

Infantaria é a base equilibrada. Motorizada oferece mobilidade com custo maior. Blindados concentram choque e ataque, com supply e manutenção elevados. Artilharia oferece fogo e cerco, com defesa e mobilidade baixas. Reconhecimento é leve e rápido. Engenheiros oferecem defesa e cerco. Guarnição é barata e lenta. Não existem combustível, tanques como recurso, pontes ou novo fog of war.

## Decisões de compatibilidade

- Infantry/artillery são IDs compartilhados: todos os seus stats anteriores foram preservados, inclusive manpower de artilharia distinto de sua força máxima. Apenas os novos pedidos de artilharia exigem Arsenal. Não é necessário marcador de versão no regimento.
- Todos os sete IDs legados continuam reconhecidos. Cavalry, archers, heavy_cavalry, elite_guard e siege_engine não podem receber novos pedidos, mas continuam movendo, combatendo, recuperando e concluindo filas já pagas.
- Tecnologias/focos antigos de cavalaria permanecem disponíveis para compatibilidade de progresso e beneficiam somente o ID ao qual se referem. Não concedem bônus de cavalaria a blindados. Bônus gerais percorrem os 12 IDs reconhecidos.
- `paidCost` é o custo total efetivamente pago pela entrada da fila. Cancelar um regimento divide esse total pela quantidade, aplica o fator de reembolso existente entre 10% e 100% e reduz proporcionalmente o orçamento restante. Filas antigas sem `paidCost` usam o custo bruto da definição legada. Não há devolução nova de manpower ou bens.
- Novos pedidos registram `totalDays`: leis e tecnologia ajustam o trabalho de treinamento uma vez, e Quartel ajusta a progressão diária. Filas antigas sem esse campo mantêm a progressão anterior. Nenhuma fila carregada recebe cobrança adicional ou novos requisitos.
- Batalhas ativas e snapshots são preservados no load, sem regeneração de composição ou reinicialização de perdas, experiência, moral e organização. Apenas ticks posteriores seguem o cálculo compartilhado atual.

## Recrutamento, Arsenal e recuperação

Requisitos são centralizados em `getRecruitmentBlockReason`; `queueRecruitment` cobra ouro, manpower, ferro e ferramentas reais uma única vez. As províncias mantêm seus estoques. Arsenal pronto concede 3% de desconto de equipamento por nível, limitado a 15%, através dos helpers existentes. Não concede ataque direto. Custos e bloqueios são os mesmos para jogador, IA e interface.

Reinforcement mantém a simplificação existente: consumo de ouro/manpower/ferro/ferramentas por soldado reposto, com o desconto do Arsenal. Não foram criadas cadeias de reposição por tipo. Experiência é preservada. Critical supply reduz recuperação e eficiência; não introduz deltas negativos de organização ou moral.

## Combate, movimento e logística

`calculateArmyCombatStats` é a fonte de ataque, defesa e choque para resolução antiga e batalha contínua. Considera força relativa ao máximo persistido, organização, moral, experiência e bônus tecnológico específico por unidade. A antiga tabela independente de multiplicadores de poder foi removida.

O adaptador antigo calcula `power = (attack + defense × 0.35 + shock × 0.45) × 100`. Essa mudança elimina divergência com o combate diário; os stats das unidades antigas continuam iguais, mas o poder do resolvedor antigo deixa de usar sua tabela anterior. O lifecycle diário, perdas, duração, retirada e ocupação não foram reescritos.

Velocidade de composição continua sendo a menor mobilidade dos regimentos; reconhecimento rápido não acelera magicamente artilharia. Supply e manutenção somam o uso de cada regimento proporcional à força atual/máxima. Terrain V1 e Logistics V2 continuam aplicando seus modificadores existentes uma vez. Não foram alterados BFS, pathfinding, rede logística, controle territorial ou retirada.

## IA, cenário e rebeldes

`aiRecruitment.ts` classifica projetos de forma determinística em todas as províncias do país. Considera regimentos atuais e pedidos pendentes, requisitos, recursos, capacidade local/rede e carga projetada. Score: peso de composição dividido por `1 + quantidade equivalente existente`, multiplicado pelo supply projetado.

Pesos: infantaria 8; motorizada 2; blindados 1; artilharia 2; reconhecimento 1; engenheiros 1; guarnição 2 (4 em defesa estratégica durante paz). Reserva de tesouro: 150. Blindados exigem guerra e tesouro mínimo de 1000. Blindados/artilharia/motorizada não são selecionados com supply projetado abaixo de 60%. Guarnições são restritas à capital ou fronteira estrangeira. A avaliação militar de ataque/retirada existente continua usando os stats e logística compartilhados, sem uma segunda fórmula por tipo.

O cenário inicial mantém 1–4 regimentos por país, predominantemente infantaria; países com pelo menos três recebem uma artilharia. Não distribui blindados para todos. Novos rebeldes mantêm a infantaria já utilizada pela engine; regimentos rebeldes legados válidos e parcialmente danificados são preservados pela migração.

O cheat de exército misto cria infantaria, motorizada, artilharia, blindados, reconhecimento e engenheiros. O total exibido é calculado da composição real. God Mode usa os máximos de cada definição para força, organização e moral.

## UI e traduções

A aba Militar oferece apenas os sete tipos modernos, exibindo papel, ataque/defesa/choque/cerco, força, mobilidade, supply, manutenção, custos reais, tempo, requisitos e motivo de bloqueio. Não houve redesenho do painel. As traduções de todos os 12 IDs derivam de `UNIT_DEFINITIONS`; relatórios mostram corretamente unidades modernas e legadas. Filas usam `totalDays` quando disponível.

## Saves

Formato V2 permanece; saves V1 continuam passando pela migração existente. Somente `totalDays` é um campo novo opcional. Não são persistidos caches, um catálogo duplicado nem conversões de unidades. `requiredArsenalLevel` pertence à definição estática.

`saveCompatibility.ts` valida IDs antes de qualquer migração/lookup, incluindo exércitos, rebeldes, filas, snapshots e composições de relatórios. IDs desconhecidos e valores militares não finitos geram erro explícito com caminho. O load retorna falha, a UI mostra o erro e o conteúdo original permanece intacto. Save/autosave não sobrescreve um slot que já contenha ID militar desconhecido. Não há remoção silenciosa ou substituição por infantaria.

## Arquivos e validação

Criados: `military/aiRecruitment.ts`, `military/saveCompatibility.ts`, este documento e as suítes `engine/__tests__/militaryUnitsV3.test.ts` e `components/__tests__/militaryUnitsV3.test.tsx`.

Alterados: tipos de exército/tecnologia; catálogo; stats/utils/recrutamento; resolvedor/cálculos/batalha contínua; tecnologia; IA econômica e tick; estado inicial; migração rebelde; saveSystem e hook; cheats; aba Militar, sidebar e relatório; traduções. Três testes anteriores receberam somente ajustes de expectativa para tecnologia e nomes de bens em português.

As suítes dedicadas cobrem catálogo completo, custos, requisitos, filas legadas, reembolso agrupado, desconto, tecnologia específica, IA determinística/reserva/composição, proteção de IDs em estruturas aninhadas, supply compartilhado, critical supply, fórmula de combate, snapshots, UI, round-trip e preservação de batalha ativa. A suíte existente cobre as regressões de movement, battle, Logistics, Terrain, Economy, Buildings, Rebellion, Diplomacy, Politics e save V1/V2.

Falhas encontradas: divergência entre tabela antiga de poder e stats; bônus tecnológico máximo de infantaria/cavalaria/artilharia aplicado indiscriminadamente na batalha diária; reembolso baseado no custo bruto em vez do custo pago; modificadores de treinamento aplicados na criação e novamente a cada tick. Corrigidas nesta integração. Duas expectativas antigas de UI usavam nomes ingleses de bens já traduzidos na branch; somente os testes foram atualizados.

Navegador integrado indisponível nesta sessão: não foi realizada inspeção visual interativa ou campanha manual. Renderização e interação foram verificadas em jsdom; combate e saves por testes automatizados. Balance prolongado e variedade de composição durante campanhas longas ainda precisam de observação de gameplay. Não foram adicionados sistemas de combustível, aviação, naval, munição, veículos físicos ou fábricas militares novas. Extensões futuras são opcionais.

Validação final: `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:run` e `git diff --check` passaram. Foram 682 testes em 42 arquivos, incluindo 28 casos novos dedicados a V3. Build emitiu aviso de chunk JavaScript acima de 500 kB; Vitest emitiu aviso experimental de localStorage do Node, sem falhas. Nenhum commit ou push foi realizado.
