# Rebellion V2

## Comportamento

O sistema de teste foi substituído por pressão social acumulada (unrest, 0–100), organização provincial (progress, 0–100) e facções com objetivos persistentes. Unrest converge gradualmente à pressão explicada pelos fatores locais; não cresce incondicionalmente nem fica permanentemente bloqueado em zero. A organização aumenta ou diminui conforme a faixa de unrest, presença militar e repressão. Somente progress completo forma uma revolta. Formar uma facção não reseta unrest nem gera reforços infinitos.

Os pesos, limites, custos, duração de respostas, bandas e penalidades principais ficam em `balance.ts`. Habitação (incluindo templos de saves legados) fornece no máximo seis pontos de alívio, e edifícios inacabados não fornecem alívio. Fazendas, mercados e leis continuam usando seus próprios sistemas e influenciam revoltas pelos resultados econômicos e sociais.

## Arquitetura e persistência

- `types.ts`: tipos de província, facção, ações e objetivos; religiosos/nacionalistas preparados, sem geração artificial.
- `unrestEngine.ts`: causas positivas e negativas, incluindo alimentos, poder de compra, satisfação, impostos, estabilidade, prestígio, mobilização, déficit, guerra, conquista, ocupação, edifícios, tropas e respostas.
- `rebellionProgress.ts`: organização independente de unrest e penalidades graduais de produção, receita, manpower e crescimento.
- `rebellionSpawner.ts`: seleção por prioridade, agrupamento de províncias adjacentes de mesmo tipo/país e força variável por população, desenvolvimento, apoio/unrest, progress e força militar nacional.
- `rebellionEngine.ts`: transições diárias, formação e integração das guerras civis, ocupação desimpedida e resolução depois do combate.
- `rebellionObjectives.ts`: controle contínuo de alvos, interrupção por reconquista ou disputa militar, derrota por ausência simultânea de tropas e território, e consequências da vitória.
- `rebellionActions.ts`: API pura para repressão, alívio fiscal, concessões, autonomia, investimento e negociação, com custos e duração persistidos.
- `rebellionAI.ts`: reserva de forças antes da IA militar geral, avaliação de vantagem, concessões quando necessário, compromisso com alvos e marcha dos rebeldes. Reutiliza movimento, estatísticas e recuperação do Military V2.
- `rebellionMigration.ts`: validação na fronteira de saves e conversão de rebeldes legados com repartição de regimentos acima do limite, sem perder tropas. Várias tropas de uma facção continuam compartilhando a facção.
- `rebellionUtils.ts`, `feedback.ts` e `index.ts`: helpers, traduções e API pública.

Estado provincial fica em `Province.rebellion`; explicação derivada em `Province.unrestExplanation`; facções em `Country.rebellions`; associação militar em `Army.rebellionFactionId`. Esses campos usam os objetos que já são salvos, evitando uma segunda fonte de estado e novas refs. Ausência de campos recebe defaults; facções inválidas são descartadas e vínculos órfãos são reparados quando há país/província suficientes. A migração também renomeia relações, guerras e lados/snapshots de batalhas ativas. A explicação é recalculada após carregar. O formato externo V1/V2 continua compatível.

## Tipos e objetivos

| Tipo gerado | Critério prioritário | Objetivo | Vitória |
| --- | --- | --- | --- |
| Separatistas | Território conquistado com proprietário histórico diferente | Controlar todas as províncias envolvidas por 120 dias | Restaurar país existente; autonomia se o país não puder ser restaurado |
| Revolucionários | Estabilidade abaixo de 25 e governo centralizado | Controlar capital por 60 dias | Governança descentralizada e estabilidade 55 |
| Pretendentes | Estabilidade abaixo de 35 e prestígio negativo | Controlar capital por 45 dias | Governança balanceada e estabilidade 55 |
| Camponeses | Demais pressões econômicas e sociais | Controlar províncias envolvidas por 60 dias | Tributação nacional baixa e concessões temporárias |

A capital usa a primeira província do país, compatível com o fallback militar existente; o alvo fica fixado na formação. Os tipos têm multiplicadores de força diferentes. Perder qualquer objetivo ou ter tropas do país original disputando o alvo reinicia a contagem de controle. A derrota exige perder todas as tropas vivas e todos os territórios controlados; perder uma província não encerra a facção. A ocupação rebelde temporária não encerra imediatamente a partida nem marca o país como anexado enquanto sua guerra civil estiver ativa.

## Respostas e consequências

Repressão exige tropas locais livres; o efeito imediato e as baixas civis escalam com tropas/população. Ela reduz progress, aplica supressão por 30 dias e aumenta ressentimento e perda de prestígio. Uma guarnição ajuda a impedir organização, mas não resolve as causas sociais.

Alívio fiscal e concessões reduzem pressão e receita local por 180 dias. Concessões custam ouro e reduzem ressentimento. Autonomia reduz pressão, receita e manpower e decai lentamente. Investimento custa ouro e reduz pressão por 360 dias, com benefício gradual pela convergência de unrest. Negociação encerra facções camponesas/separatistas com custos e concessões; pretendentes e revolucionários exigem vitória militar. Respostas têm intervalo de 60 dias para impedir aplicação repetida de efeitos instantâneos. O cooldown de logs é independente das regras de organização e spawn.

## Integração militar e legado removido

Regimentos usam `UNIT_DEFINITIONS` e `createRegiment`, com `maxStrength`, moral, organização, experiência e origem provincial. Movimento, supply, recuperação de prontidão, batalhas, baixas, snapshots de relatório e retirada usam Military V2. Não há uma segunda implementação de retirada. Rebeldes recuperam prontidão sem consumir o manpower do governo ou ganhar reforços gratuitos.

O código militar e a Military AI V3 não foram reescritos. Guerras civis usam as estruturas existentes de guerras/relações para permitir combate e movimento. Ocupação passa por `transferProvince`, mantendo índices territoriais e cancelando recrutamentos/construções do antigo controlador. A lógica de reconquista/libertação legada não atua em facções V2.

Problemas encontrados no legado:

- Províncias com unrest zero nunca acumulavam pressão.
- Unrest 100 criava rebeldes e voltava a 30, permitindo ciclos de spawn/ganho ilimitado de tropas.
- Acúmulo e fusão somavam homens dentro de um regimento acima de `maxStrength`.
- Rebeldes eram tratados como aliados do próprio país original na chegada e na batalha pendente.
- Ocupação rebelde era automaticamente devolvida no movimento, impedindo objetivos de controle.
- O painel consultava dados estáticos do país, podendo mostrar estabilidade/leis diferentes do estado da partida.

Foi removida a API de acúmulo fixo de mil tropas, incluindo constantes e gerador de IDs sem uso. Os helpers legados restantes servem à compatibilidade de órfãos antigos sem dados suficientes; facções modernas ficam isoladas desse caminho. A fusão de órfãos concatena regimentos em vez de ultrapassar os limites.

## Limitações explícitas

- Não há base própria de cultura/religião nem entidade de líder/legitimidade; esses dados não foram inventados. Pretendentes afetam governo existente, sem criar um líder fictício.
- Não são criadas tags de países inéditas. Catálogo estático, consultas por tag na UI e inicialização de estados tecnológicos/diplomáticos ainda exigem um registro nacional coordenado. Separatistas restauram registros existentes, inclusive países anexados, e recuperam exatamente as províncias ocupadas. Objetivo sem registro restaurável recebe autonomia. A criação dinâmica de países permanece preparada pelo objetivo de independência, mas exige uma migração mais ampla dessas dependências.
- Guerra prolongada usa duração das guerras externas. Desvantagem militar usa o war score disponível, não um histórico novo de derrotas recentes. A estabilidade/pressão de guerras existentes foi mantida sem reescrever war score.
- Investimento oferece alívio social temporário; infraestrutura e melhora material permanente continuam nas obras e na economia existentes. Províncias sob controle rebelde deixam de gerar renda/manpower para o governo, seguindo a ocupação territorial já existente.
- Não há reforço infinito de facções nem economia nacional autônoma dos rebeldes. O balanceamento é uma primeira configuração, coberta por testes, e ainda demanda partidas prolongadas para calibração de dificuldade.

## Arquivos existentes integrados

`src/types/{province,country,army}.ts`; `src/engine/{unrest,economy,saveSystem}.ts`; `src/engine/rebellions/{rebelAI,rebelAccumulation,rebelHelpers}.ts`; `src/hooks/useGameLoop.ts`; `src/hooks/gameLoop/{unrestTick,aiTick,rebelTick,movementTick,battleArrivalTick}.ts`; `src/App.tsx`; `src/components/ProvincePanel/{ProvincePanel,ProvinceInfoTab}.tsx`; `src/components/GameMap/ProvinceLayer.tsx`; `src/engine/__tests__/unrest.test.ts`.

O painel provincial oferece respostas compactas e feedback de causas, organização, autonomia, ressentimento, força, tipo e progresso do objetivo. Os indicadores do mapa mostram organização separada, sem assumir que unrest alto equivale a spawn imediato.

## Verificação

`rebellionV2.test.ts` cobre pressão/modificadores, habitação limitada, fome, estabilidade, conquista e decaimento, progresso ascendente/descendente, escala militar, grupos, ausência de spawn duplicado, objetivos e vitórias, reconquista/disputa, ocupação e cancelamento de atividades, ações/trade-offs, supply/recuperação, combate e retirada/aniquilação reais, IA/compromisso/cooldowns, defaults e migração de saves, preservação de facções/objetivos e renomeação de batalhas/diplomacia legadas. Os testes antigos conflitantes foram atualizados para a semântica de organização separada; os demais testes militares, econômicos e populacionais foram preservados.

Executar antes da entrega: `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` e `git diff --check`. Nenhum commit automático.

## Auditoria do anúncio e da persistência

O teste de integração em `rebellionLifecycle.test.tsx` executa o loop real (economia → progresso/spawn → IA → movimento → combate → objetivos → publicação das refs e estado React), sem mockar os engines. Uma revolta em Silva Antiqua, com seus dados populacionais/desenvolvimento/defesa do mapa e um exército governamental manual de seis regimentos de infantaria, pode ser derrotada no próprio tick de formação. O antigo anúncio era publicado antes do combate; portanto descrevia um estado intermediário que nunca chegava à UI. Além disso, selecionar anúncios pela data de formação e pela existência de qualquer log de spawn podia reanunciar facções antigas/encerradas do mesmo dia.

`spawnRebellions` agora retorna os IDs exatos das facções criadas, sem resetar unrest/progress antes de confirmar a criação. O loop adia logs e notificações de formação até publicar o resultado final. `collectRebellionFormationFeedback` verifica status e consequência observável no estado persistido. Facções que continuam ativas recebem o anúncio de rebelião; as já derrotadas, negociadas ou vitoriosas recebem uma mensagem explícita de resolução no mesmo dia. Nenhum limiar, custo ou peso foi alterado.

Não foi encontrada remoção indiscriminada de facções V2 pelo cleanup legado: o exército nasce com `owner = faction.id` e `rebellionFactionId = faction.id`; movimentos e libertação legados continuam isolados. Derrota militar e negociação são resoluções reais e podem remover tropas no mesmo tick. As refs e os setters finais preservam `Country.rebellions`; testes também verificam permanência no tick seguinte. O `GameState` utilizado pela aplicação é composto por esses estados React/refs; não há uma lista independente de facções fora dos países.

A reconquista pode limpar a organização e o vínculo provincial como parte da transferência territorial, sem encerrar a facção regional. A UI e a API de negociação agora consultam também `involvedProvinces`, além do vínculo local e do controlador. Todas as províncias envolvidas mostram a mesma facção, origem e localização real das tropas. Uma revolta multiprovincial mantém um exército compartilhado, sem duplicar homens por província. Um indicador de revolta no mapa independe do unrest local, e tropas V2 usam uma bandeira rebelde distinta da bandeira governamental.

Regressões cobrem anúncio após publicação com facção ativa/consequência persistente, derrota no mesmo tick com exército manual de 6k, ausência de reanúncio de facções encerradas do mesmo dia, ausência de falso spawn sem país, visibilidade/negociação em províncias envolvidas reconquistadas e distinção visual dos exércitos. A configuração de testes inclui `.test.tsx` para executar essa integração de hooks/UI em jsdom.

## Auditoria de lifecycle e resolução

A condição antiga declarava derrota quando não encontrava tropas pelo campo opcional `rebellionFactionId`, ignorando ocupações restantes. `splitArmy` também não copiava esse vínculo. Agora o `owner = faction.id` identifica as tropas de forma canônica; divisão preserva os metadados, e resolução/carregamento reparam vínculos ausentes sem criar outra facção. Arrays vazios de províncias envolvidas ou objetivos não descartam a facção no carregamento nem produzem vitória por controle vazio.

Somente três condições encerram uma facção V2: derrota sem tropas vivas **e** sem ocupação restante; controle contínuo de todos os objetivos pelo período já configurado; negociação explicitamente aceita pela API (jogador ou IA). Repressão/concessões comuns reduzem pressão e não encerram uma facção militar ativa. Não há expiração por idade, unrest baixo ou perda de uma província. Cleanup rejeita uma facção ativa ou uma derrota/vitória sem condição comprovada. A facção terminal permanece em `Country.rebellions`, com motivo e dia em `resolution`, para auditoria e saves.

O loop chama resolução uma vez, após combate. `lastObjectiveDay` impede progresso duplicado no mesmo dia. Ocupações V2 não passam por devolução/integração legada mesmo quando o vínculo militar ou registro da facção está ausente. Reconquista militar pode transferir uma província, mas não destrói outras tropas nem encerra a facção por si só.

Uma vitória camponesa após 60 dias já devolvia territórios e desmobilizava tropas sem batalha: o objetivo de alívio fiscal foi aceito como consequência da vitória. Esse período e efeito foram preservados. O defeito de feedback era emitir apenas log, sem notificação de resolução. Transições agora notificam o jogador após publicar o estado final, com causa e progresso do objetivo; negociação da IA também gera log público. O registro terminal impede anúncios repetidos nos ticks seguintes.

As regressões executam 60 ticks reais até vitória, verificam tropas/ocupação persistentes antes dela e uma única notificação depois. Também cobrem perda de território com tropas vivas, metadados vazios, vínculo ausente e carregamento, ocupação sem tropas, derrota após reconquista, cleanup inválido, divisão de exército, negociação e chamada duplicada no mesmo dia. Nenhuma constante de balanceamento foi alterada.
