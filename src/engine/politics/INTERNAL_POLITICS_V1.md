# Internal Politics / Government V1

Sistema nacional jogável sobre governo/leis, estabilidade e Rebellion V2 existentes. Não requer partidos, eleições, parlamento, personagens ou constituição complexa agora ou no futuro. Extensões são opcionais.

## Auditoria e arquitetura

Auditados `government`, `governance`, `stability`, `prestige`, `laws`, `tax`, `taxation`, `reform`, `policy` e `political` em engines, tipos, hooks e UI.

Legado útil preservado:

- `engine/government.ts` já normalizava leis e compunha seus efeitos. `constants/laws.ts` continua sendo o catálogo único. `activeLaws.taxation` e `activeLaws.governance` não foram duplicados ou convertidos para enums incompatíveis.
- `resources.stability` continua sendo a única estabilidade nacional. `engine/stability.ts` conserva efeitos econômicos/construtivos/militares, eventos de prestígio e helpers de UI.
- `population.ts` continua calculando satisfação/emprego provinciais. Não há satisfação ou unrest políticos paralelos.
- `GovernmentModal` existente foi expandido, e a TopBar ganhou um botão explícito Governo. Outras leis permanecem disponíveis em uma seção recolhível.
- Rebellion V2 já tinha pressão de estabilidade, impostos, centralização, guerra e objetivos para pretendentes/revolucionários. Integração acrescenta fontes/consequências; não substitui a engine. O antigo valor fixo `victoryStability:55`, que ficou sem uso, foi removido: o choque governamental agora pertence à única tabela de política.
- Tecnologia, conscription, economia de guerra, políticas agrária/comercial e inteligência permanecem. Cheats continuam sendo comandos de depuração e não decisões políticas comuns.

Novo: `types/politics.ts`, `politics/index.ts` e `politics/balance.ts`. O país recebe `politics` com tipo de governo, legitimidade, capital político, aprovação histórica dos cinco grupos e relógios/cooldown. Influência, apoio, targets e explicações são derivados. Nenhuma rede/cache provincial é criada.

## Formas de governo

| Tipo | Label | Target de legitimidade | Target de estabilidade | Taxação | Manutenção | Unrest | Custo de reforma |
| --- | --- | --- | --- | --- | --- | --- | --- |
| absolute_monarchy | Monarquia Absoluta | +5 | +2 | ×1 | ×1 | −1 | ×1,10 |
| constitutional_monarchy | Monarquia Constitucional | +2 | +4 | ×1 | ×1 | 0 | ×1 |
| republic | República | 0 | 0 | ×1 | ×1 | 0 | ×0,90 |
| oligarchy | Oligarquia | −2 | 0 | ×1,03 | ×1 | +1 | ×1,05 |
| military_government | Governo Militar | −5 | +2 | ×1 | ×1,02 | −2 | ×1,10 |

`GOVERNMENT_DEFINITIONS` também centraliza a afinidade dos grupos. Military modifier representa manutenção e não bônus de ataque. Não existe botão para trocar livremente de governo.

Defaults: legitimidade 65 + modificador do governo; capital político 40; estabilidade existente preservada e limitada a 0..100 (fallback 60 se inválida/ausente). Os 13 países recebem defaults no início de jogo ou migração. BRA/ECU/GUF: monarquia constitucional; ARG/CHL/URY/PER/COL: república; PRY: monarquia absoluta; BOL/GUY/SUR: oligarquia; VEN: governo militar. É cenário de gameplay, não reconstrução histórica, com bônus modestos.

## Legitimidade, estabilidade e capital

Todas as escalas nacionais são 0..100. Legitimidade mede reconhecimento do governo; estabilidade mede funcionamento institucional e ordem. É possível uma estar alta e a outra baixa.

Faixas de legitimidade: 0–19 crise, 20–39 fraca, 40–59 contestada, 60–79 estável, 80–100 forte.

```text
targetLegitimidade = clamp(0,40 × satisfação ponderada
                         + 0,20 × estabilidade
                         + 0,40 × apoio
                         + modificador de governo
                         − 3 se em guerra
                         − 8 se warScore próprio < −25
                         + 3 se saldo econômico diário positivo
                         − 10 × taxa de desemprego, 0, 100)

targetEstabilidade = clamp(0,25 × satisfação + 0,25 × legitimidade
                        + 0,50 × apoio + modificador de governo, 0, 100)
capitalMensal = 3 × (legitimidade + estabilidade + apoio) / 300
```

Drifts máximos por processamento mensal: legitimidade ±1,5, estabilidade ±1, aprovação ±6. Capital tem cap 100; um governo forte gera até 3 por mês. Approval é atualizada antes de calcular apoio/targets. Legitimidade/estabilidade usam o estado da etapa, sem iterações para resolver dependências recíprocas.

O relógio usa o calendário existente de 360 dias/ano (30 por mês). O cooldown solicitado é de 365 **ticks diários**. O primeiro tick estabelece `lastTickDay`; outro no mesmo dia é idempotente. A cada 30 dias ocorre uma atualização. Saltos externos de data não simulam automaticamente todos os meses ausentes. Sem território, anexados e `rebel_*` não processam política nacional.

A recuperação diária rudimentar de estabilidade é desativada para países com Politics V1, evitando dois drifts concorrentes. Ela e os helpers antigos de promulgação/escolha de lei continuam disponíveis para chamadas sem contexto político e testes/compatibilidade. No jogo inicializado/migrado, jogador e IA usam exclusivamente o validador de política novo. Os efeitos antigos de estabilidade (renda, manpower e construção/recrutamento) permanecem centralizados em `stability.ts`.

Batalha com pelo menos 500 baixas totais: vencedor recebe +1 legitimidade/+3 aprovação militar; perdedor −2/−3. Não altera baixas, combate ou prestígio existente. Concessões/investimento em Rebellion V2 dão +1 legitimidade; repressão −2, além dos custos/ressentimento existentes.

## Grupos, influência e aprovação

Grupos: Proprietários, Comerciantes, Trabalhadores, Militares e Reformistas. Não são partidos. Influência é derivada e normalizada para somar 100; approval mantém história em −100..100.

Pesos brutos, com mínimo seguro 10:

```text
Proprietários = 10 + 4 × fazendas + 0,6 × desenvolvimento total
Comerciantes = 10 + 5 × mercados + 0,01 × valor do comércio externo recente
                   + 0,0001 × tesouro positivo
Trabalhadores = 10 + 4 × oficinas + empregados / 20.000
Militares = 10 + 4 × quartéis + tropas / 2.000 + 2 × manutenção das tropas
Reformistas = 10 + 0,3 × desenvolvimento total
                 + 8 em república/monarquia constitucional
influência = peso / somaDosPesos × 100
apoio = clamp(50 + médiaDaApprovalPonderadaPorInfluência / 2, 0, 100)
```

Somente edifícios concluídos e forças do país entram. Não há loops sobre pessoas individuais.

Approval target soma: afinidade com governo + 0,5 × (satisfação −60) + 0,15 × (estabilidade −60) + modificadores de cada lei. Trabalhadores perdem 60 × desemprego relativo. Comerciantes recebem ±4 conforme sinal do saldo econômico. Militares recebem +5 em guerra sem derrota relevante ou −12 com derrota. Targets recebem clamp −100..100.

`POLITICS_BALANCE.policyApproval` centraliza reações. Impostos baixos: proprietários/comerciantes +10, trabalhadores +15; altos: −10/−15/−20. Gasto militar baixo/alto: militares −20/+20. Apoio social: trabalhadores +15/reformistas +10; restrição social: −15/−10. Centralização desagrada reformistas (−15), descentralização agrada (+10). Os demais valores estão na tabela única de balance.

Uma reforma aplica imediatamente a diferença entre o efeito da nova e da antiga lei. Nos meses seguintes, approval converge gradualmente para o target completo. Tooltips mostram os principais fatores.

## Políticas e confirmação

Impostos low/normal/high e governança centralizada/balanceada/descentralizada reutilizam os IDs existentes. Acrescentadas duas categorias ao mesmo catálogo:

- Gasto militar low/normal/high: manutenção ×0,85/1/1,15; recuperação e reinforcement ×0,95/1/1,05.
- Política social restrictive/balanced/supportive: despesa diária de 0/0,005/0,02 ouro por **mil habitantes**; satisfação −2/0/+3 pelo mecanismo provincial existente.

Reforma custa `ceil(20 × reformCostModifier)` de capital, o custo em ouro existente da lei, −2 legitimidade e −1 estabilidade. Cooldown **global** de 365 dias para qualquer próxima mudança, inclusive categorias legadas, impede alternância/bypass. IDs inválidos, lei já ativa, falta de capital/ouro, exigência de guerra e país sem governo territorial válido bloqueiam sem mutação.

Não existe mudança voluntária de governmentType. UI oferece adoção de políticas e uma confirmação separada com custos/choques/cooldown. Confirmação é revalidada se o estado mudar. O handler consulta refs atuais de país/data/guerras e atualiza a ref imediatamente, evitando substituir a simulação por um snapshot antigo ou aceitar duas ações no mesmo estado. A ação gera toast e log; os efeitos nos grupos são explicados nos cards.

## Economia, Military V2 e Rebellion V2

Economy V2.1 mantém produção, estoques, demanda, preços, matching bilateral, tarifas e dependência. Government aplica somente eficiência fiscal, manutenção e despesa social no cálculo econômico diário existente. Taxation/governance continuam entrando uma vez via `calculateLawModifiers`; não há sistema fiscal paralelo. Despesas sociais usam população provincial atual, debitadas junto às despesas reais. Tesouro continua limitado a zero, sem nova dívida.

Military V2 mantém custos/equipamentos de reinforcement, supply, combate, organização e moral. Spending apenas compõe recuperação/limite de reinforcement em ±5%, sempre não negativo. Logistics V2/Terrain V1/movimento não mudam. Não há golpe ou guerra civil nova.

Rebellion V2 mantém pressão de estabilidade, impostos, centralização, satisfação e demais causas. Uma fonte adicional acrescenta:

```text
pressãoPolítica = max(0, 50 − legitimidade) × 0,12
                + soma(max(0, −30 − approval) × influência / 100) × 0,08
                + unrestModifier do governo
```

O cálculo nacional é compartilhado pela etapa provincial. Estabilidade não é aplicada duas vezes. Grupos com influência >=15 e aprovação <−40 favorecem tipos existentes: trabalhadores/reformistas → revolucionários; militares/proprietários → pretendentes. Com ambos insatisfeitos, vence a maior pressão ponderada. As condições legadas de separatismo/colapso permanecem prioritárias e o agrupamento usa o mesmo contexto nacional da escolha de tipo.

Vitória de pretendentes preserva o objetivo e governança balanceada; muda para governo militar (ou monarquia absoluta se já militar). Vitória revolucionária/reforma muda para república e governança descentralizada. Ambas iniciam legitimidade 45/estabilidade 30; grupos vencedores recebem aprovação +25. Transferência/retorno de províncias, limpeza de facções, guerras internas e estoques permanecem nos mecanismos existentes.

## IA e ordem do jogo

Fluxo: economia/população/comércio e recuperação existentes → tick político mensal → unrest/Rebellion V2 → diplomacia/tecnologia → IA econômica/militar → movimento/combate → objetivos rebeldes. Efeitos de uma política nova entram na economia/recuperação no próximo tick diário. `engine/gameLoop/order.ts` registra a nova fase.

A IA política avalia satisfação, unrest, legitimidade, estabilidade, aprovação, tesouro/saldo e guerra. Com tensão, busca reduzir impostos ou apoiar socialmente. Com déficit/tesouro ruim, busca contenção social/manutenção ou impostos altos quando o risco é aceitável. Não reduz manutenção de exércitos inexistentes. Em guerra e com tesouro adequado, considera gasto militar alto; em paz retorna de alto para normal. Só realiza mudança válida/financiável pelo mesmo cooldown/capital do jogador. Não troca governo e não usa random. Depois das prioridades urgentes, reutiliza `chooseAILaw` para preservar escolhas agrárias/comerciais, mobilização e inteligência, agora pelo mesmo custo/cooldown político. A promulgação separada da antiga IA econômica é desativada para países com estado político, evitando decisões paralelas.

## Saves, UI e validação

Save continua versão 2. Persistência: `country.politics`, `activeLaws` e `resources.stability` existentes. Aprovação/capital/cooldown/relógio não são deriváveis e são salvos. Influência/apoio/targets não são salvos. V1/V2 recebem defaults, leis normalizadas, governo válido e limites seguros; impostos, governança e estabilidade existentes são preservados. A próxima rede Logistics V2 continua derivada normalmente.

Painel Governo acessível por novo botão na TopBar e pelo acesso anterior: forma de governo, quatro indicadores nacionais, cinco grupos com barras, políticas atuais, efeitos/reação dos grupos, bloqueios e confirmação. Não há novo map mode. Unrest continua a manifestação territorial.

Suítes dedicadas cobrem tipos/defaults, migração, legitimidade/estabilidade distintas, drift/clock/clamps, dois anos determinísticos, influência/approval/apoio, custos/cooldown, economia/despesas/satisfação, recuperação segura, pressão/tipo/vitória rebelde, concessões/derrotas, IA, UI/confirmar/cancelar/revalidar e save/load V1/V2. Testes antigos foram atualizados somente para as novas categorias e o novo choque governamental em vitórias rebeldes.

Navegador integrado indisponível nesta sessão. UI verificada por renderização DOM automatizada; não houve inspeção visual manual/console de uma campanha interativa.

Validação final: lint, typecheck, build e `git diff --check` passaram; 606 testes em 38 arquivos passaram, incluindo 39 testes dedicados. O build mantém o aviso existente de bundle acima de 500 kB. Nenhum commit ou push realizado.

## Limites e extensões opcionais

Sem eleições, partidos, parlamento, personagens, ministros, orçamento ministerial ou welfare detalhado. Sem ideologia diplomática, nova rebellion engine ou golpe simulado. Recursos políticos abstratos têm geração limitada e decisões anuais; não há planejamento macroeconômico de longo prazo. Influência é uma aproximação nacional, não classes sociais individuais. Saltos de data não dão recuperação política retroativa ilimitada.

Novos governos/políticas/modificadores, eventos simples, refinamentos de grupos e IA seriam incrementais e opcionais. Este sistema é suficiente por si só.

## Arquivos

Criados: `src/types/politics.ts`, `src/engine/politics/index.ts`, `balance.ts`, `INTERNAL_POLITICS_V1.md`, `src/engine/__tests__/internalPoliticsV1.test.ts`, `src/components/__tests__/internalPoliticsV1.test.tsx`.

Alterados: `src/types/country.ts`, `government.ts`, `index.ts`; `src/constants/laws.ts`; `src/engine/economy.ts`, `saveSystem.ts`, `aiEngine/aiEconomy.ts`, `military/recoveryEngine.ts`, `gameLoop/order.ts`; `src/engine/rebellion/balance.ts`, `feedback.ts`, `unrestEngine.ts`, `rebellionEngine.ts`, `rebellionSpawner.ts`, `rebellionActions.ts`, `rebellionObjectives.ts`; `src/hooks/useGameLoop.ts`, `app/useTechActions.ts`, `gameLoop/battleContinuousTick.ts`; `src/App.tsx`; `src/components/GovernmentModal.tsx`, `TopBar.tsx`; `src/styles/government.css`; `src/engine/__tests__/government.test.ts`, `rebellionV2.test.ts`.
