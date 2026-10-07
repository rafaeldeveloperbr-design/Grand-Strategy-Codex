# Logistics V2

Camada terrestre determinística sobre o supply de Military V2. Os mercados provinciais, comércio interno/externo da Economy V2.1, Terrain V1 e o pathfinding estratégico permanecem existentes. Não há transporte físico nem consumo de bens por aresta.

## Arquitetura e origem

`index.ts` resolve a origem e constrói snapshots derivados. `balance.ts` centraliza os números. A capital (`capitalId`, com fallback para `capital`) é usada somente se seu controlador atual for o país. Se estiver ocupada ou inválida, a origem passa à província controlada com maior infraestrutura concluída, depois desenvolvimento, depois ID. Índices de território desatualizados em `Country.provinces` não definem o controle: `Province.owner` é a autoridade usada pelo jogo.

País anexado ou sem província controlada não tem origem. Ganhar/perder território e restaurar um país mudam a próxima rede automaticamente. Facções `rebel_*` não constroem rede nacional: conservam o supply local de Military V2/Terrain V1 e a lógica atual de rebelião.

## Rede e distância

Uma BFS por país parte da origem sobre as arestas terrestres existentes em `Province.neighbors`. Províncias e vizinhos têm ordenação estável por ID. Cada província visitada armazena conexão, distância em arestas, origem e modificadores. A origem tem distância zero.

Controle próprio permite passagem. Aliança ou acesso militar dirigido usa `hasMilitaryAccess` da Diplomacy V2. Guerra, tanto nas relações quanto no registro de guerras, prevalece sobre acesso. Neutros sem acesso e controladores rebeldes bloqueiam. Não há arestas adicionais sobre água, oceano ou estreitos.

O caminho escolhido é o primeiro caminho mínimo em arestas segundo a ordenação estável; não otimiza custo de terreno. Uma rota inimiga ainda não conquistada nunca pertence à rede real.

| Distância | Modificador |
| --- | --- |
| 0–2 | 1,00 |
| 3–5 | 0,90 |
| 6–8 | 0,80 |
| 9–12 | 0,70 |
| 13+ | 0,60 |

## Terreno, infraestrutura e ocupação

Terreno logístico específico: plains 1,00; forest 0,95; jungle 0,80; hills 0,90; mountains 0,75; desert 0,80. Usa-se o menor fator na rota, incluindo origem e destino. Ele entra uma vez, não como produto repetido por aresta. Isso permite que montanhas no corredor afetem uma província posterior sem penalidades exponenciais.

Infraestrutura concluída do destino: `min(1,40, 1 + nível × 0,08)`. Sua contribuição anterior à capacidade local também permanece. Construções não concluídas não dão bônus.

Ocupação ativa usa fator 0,80, uma única vez na rota. Uma província transferida durante guerra é detectada pelo controlador diferente do `originalOwner` inimigo, ou pelos registros de ocupação cujo ocupante ainda controla a província. Registros antigos não cortam um corredor reconquistado. Território ocupado pelo inimigo bloqueia a rede do país anterior; após conquista, pode integrar a rede do conquistador com degradação. Paz remove a degradação de ocupação ativa.

## Fórmulas de eficiência e supply

```text
conexão = conectado ? 1 : 0,25
distância = conectado ? banda(distância) : 1
eficiência = clamp(conexão × distância × terrenoDaRota × infraestruturaDestino × ocupação, 0,10, 1,40)
baseLocal = max(0, 3 + desenvolvimento × 0,55 + infraestrutura × 2 + quartel)
capacidade = baseLocal × eficiência × (controlador == donoDoExército ? 1 : 0,55)
demanda = soma do supplyUse proporcional à força dos regimentos aliados do mesmo dono na mesma província
ratio = clamp(capacidade / demanda, 0, 1)
```

Demanda zero retorna ratio 1. Dados não finitos de capacidade ou demanda recebem tratamento seguro. Sem província, ratio 0. O forrageamento desconectado mantém capacidade reduzida, sem attrition novo.

`calculateLocalSupplyCapacity` continua oferecendo a capacidade antiga com o fator de supply de Terrain V1 para chamadas locais, rebeldes e o mapa Supply existente. Nas etapas com contexto nacional, a eficiência logística entra sobre a base local **antes** do antigo fator de terreno, substituindo somente esse fator no cálculo de supply. Assim, não se multiplica o terrain de supply duas vezes. Os fatores de movimento e defesa do Terrain V1 não mudam.

O cálculo central filtra exércitos por dono/localização e inclui o exército consultado quando necessário. Exércitos remotos ou inimigos não entram na demanda. Exércitos maiores e várias forças juntas pressionam a mesma capacidade.

## Military V2 e fluxo do tick

1. Construções, produção, consumo, mercado/comércio interno e Economy V2.1 continuam na ordem existente.
2. A recuperação usa o snapshot do estado econômico atualizado. Reinforcement ainda exige ouro, manpower e IRON/TOOLS provinciais reais.
3. Após diplomacia e resposta a rebeliões, a IA recebe uma rede compartilhada entre seus países.
4. Movimento usa o ratio e multiplicador de supply existentes; não ganha penalidade extra de distância. `findPath` permanece intacto.
5. Após chegadas e transferências de controle, uma rede atualizada alimenta as batalhas novas.
6. Combate diário usa uma rede compartilhada pelas batalhas dessa etapa. Transferências de controle ao finalizar combates são processadas depois; a etapa/tick seguinte recalcula a rede.

Supply continua afetando recuperação, reinforcement, movimento e combate pelas regras de Military V2. Supply crítico reduz recuperação/eficiência e nunca gera deltas negativos de organização/moral. Não foram adicionados efeitos militares ou attrition.

## IA

Os scores de Military AI V3 recebem integração pontual:

- Poder efetivo usa o supply real da rede, mantendo os fatores anteriores de prontidão.
- Ofensivas avaliam cada trecho da rota estratégica já encontrada. Uma projeção temporária assume a conquista sequencial de províncias inimigas com fator de ocupação 0,80. Ela não altera território, permissões ou rede real.
- Supply projetado abaixo de 20% elimina a opção ofensiva. Os objetivos territoriais e exércitos-alvo recebem até +30 pelo ratio projetado.
- Inimigo desconectado recebe bônus de vulnerabilidade +15.
- Posição defensiva precisa estar conectada e recebe ratio × 40, eficiência × 30 e bônus de corredor até +25.
- Corredores são estimados pelo número de províncias próprias descendentes na árvore BFS (3 saturam o bônus). É um indicador simples, não uma prova de que a província seja ponto de articulação.
- Força desconectada ou abaixo de 20% tenta voltar a uma posição defensiva alcançável. Sem rota válida, mantém a posição. Defesa urgente da capital e ordens de reagrupamento existentes mantêm prioridade.
- Em paz, opções de fronteira conectadas são ordenadas pela eficiência, distância de movimento e ID.

Não existe aleatoriedade logística. Chamadas antigas da IA sem contexto de países conservam o comportamento local.

## UI

O modo **Logística** é separado de **Supply**. Mostra a rede do controlador atual de cada província: verde >=95%, verde claro >=80%, amarelo >=65%, laranja conectado abaixo disso, vermelho desconectado. Origem válida recebe destaque dourado, inclusive fallback. Eficiência pode superar 100% por infraestrutura; ratio militar permanece limitado a 100%.

Tooltip: conexão, origem, distância e eficiência. Popover da pilha, painel do exército selecionado e aba militar provincial mostram supply real e conexão/distância relativos ao dono do exército. A rede provincial pode diferir da rede de um exército estrangeiro na mesma província.

App compartilha um snapshot memoizado entre painéis e mapa. A UI não determina as regras do engine.

## Performance e saves

Uma BFS por país por snapshot, O(V+E), com indexação de províncias/vizinhos compartilhada. Não há BFS individual para cada exército. O snapshot é reutilizado dentro de cada etapa; etapas seguintes recalculam após mudanças possíveis de diplomacia/controle. Projeções de ataque apenas percorrem a rota existente.

Nenhum campo novo, rede ou cache é salvo. A versão do save permanece 2. Saves V1/V2 passam pelas migrações existentes; a rede é reconstruída do território, capital, edifícios, terreno e diplomacia carregados. Estoques provinciais não são alterados pela rede.

## Auditoria, validação e limites

Auditados supply, recovery, movement, continuousBattle, fluxo de economyTick/AI e UI. Corrigida a seleção de demanda quando um chamador fornece todos os exércitos: ela agora exclui forças do mesmo país em outras províncias. A lógica de mercado, comércio interno/externo, população, satisfação, recrutamento e rebeliões não foi reescrita. Não há novos campos ou mudanças no saveSystem.

Suítes dedicadas verificam origem/fallback, conexão, ocupação/reconquista, diplomacia dirigida, distância, determinismo, terrain sem duplicação, infraestrutura/clamps, demanda compartilhada, finitude, 90 dias de recuperação crítica, movimento, combate, IA, cores/origem/tooltips/popover e saves V1/V2. A suíte completa verifica as regressões existentes.

Navegador integrado indisponível nesta sessão. UI validada por renderização DOM automatizada; não houve inspeção visual manual nem observação do console em uma campanha interativa.

Limites intencionais: apenas rede terrestre; sem oceanos/estreitos, hubs, transporte físico, recursos por caminho, prioridade por exército ou rotas desenhadas. Uma BFS de menor número de arestas não busca o melhor corredor ponderado. A projeção de IA considera a conquista futura apenas para avaliar uma rota existente, sem criar conexões antes da conquista. Países sem ligação terrestre dependem do forrageamento local.

Hubs, ferrovias, portos, naval, comboios e combustível seriam extensões opcionais; nenhuma delas é dependência deste sistema.

## Inventário de arquivos

Criados:

- `src/engine/logistics/index.ts`: origem, rede, consulta, projeção para IA e categorias visuais.
- `src/engine/logistics/balance.ts`: `LOGISTICS_BALANCE`.
- `src/engine/logistics/LOGISTICS_V2.md`: documentação.
- `src/engine/__tests__/logisticsV2.test.ts`: regras e integrações do engine.
- `src/components/GameMap/__tests__/logisticsV2.test.tsx`: UI e saves.

Alterados:

- `src/engine/military/supplyEngine.ts`, `recoveryEngine.ts`, `movementEngine.ts`: composição e passagem do snapshot, preservando regras militares e pathfinding.
- `src/engine/combat/continuousBattle.ts`: supply real na pressão e snapshots de batalha.
- `src/engine/aiEngine/aiMovement.ts`: scores, projeção e retirada.
- `src/hooks/gameLoop/economyTick.ts`, `aiTick.ts`, `movementTick.ts`, `battleArrivalTick.ts`, `battleContinuousTick.ts`: redes compartilhadas por etapa.
- `src/hooks/useGameLoop.ts`: encaminhamento das guerras/relações atuais.
- `src/App.tsx`: cache memoizado, conexão e supply no painel do exército selecionado.
- `src/components/GameMap/GameMap.tsx`, `mapPresentation.ts`, `MapModeBar.tsx`, `ProvinceLayer.tsx`, `GameMapTooltip.tsx`: novo modo, categorias, origem e tooltip.
- `src/components/ArmyStackPopover.tsx`: conexão/distância.
- `src/components/ProvincePanel/ProvincePanel.tsx`, `ProvinceMilitaryTab.tsx`: supply real e conexão/distância.
- `src/components/GameMap/__tests__/uiV2.test.tsx`: expectativa da legenda/fill categórico do novo modo.
