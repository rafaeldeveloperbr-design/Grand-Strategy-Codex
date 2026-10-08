# Country Selection V1

## Fluxo e inicialização

Sem autosave válido, abrir o jogo mostra Country Selection. Novo Jogo nas configurações e reiniciar após endgame usam `?newgame=1`: ignoram o autosave e abrem a seleção, preservando saves existentes. O parâmetro é removido da URL após a entrada.

`CampaignEntry` monta `GameApp` apenas ao confirmar um Country válido ou carregar um save válido. Antes disso não existem refs da partida, game loop, timers da simulação, tecnologia de bots, ações automáticas ou autosave. Selecionar e trocar de país não inicia a partida. O snapshot mundial estático pode ser consultado com segurança; nenhum tick o modifica.

Confirmar define `playerCountryTag` e cria tecnologia do jogador para esse tag, com os outros 200 Countries no mapa de tecnologia dos bots. A partida começa pausada, como anteriormente; os controles existentes de velocidade iniciam os ticks. Não há mudança na cadência da IA ou do scheduler.

Não havia menu anterior para voltar: a tela permite carregar os saves existentes. Novo Jogo continua acessível nas configurações da partida.

## Mapa e busca

Reutiliza `GameMap`, `ProvinceLayer`, shapes e controles de zoom/pan existentes. Clique resolve `province.owner` no índice de Countries jogáveis, sem consultar o proprietário original. Greenland seleciona Denmark (`DNK`), Puerto Rico seleciona USA e Réunion seleciona France. Uma dependência ausente do roster não aparece como Country separado. Todas as províncias/holdings do Country selecionado recebem o destaque; hover mantém o tooltip com nomes amigáveis. Controles de mapa militar não são apresentados na seleção.

Busca por nome é case-insensitive, com tag como fallback técnico. A lista é ordenada pelo nome usando `pt-BR` e apresenta botões leves em um painel com rolagem, sem cards por país. Os 201 Countries estão disponíveis, incluindo Andorra, Monaco, San Marino, Liechtenstein, Tuvalu e Nauru. Nenhuma geometria foi ampliada. O botão fica desabilitado sem seleção e passa a mostrar `Jogar como <nome>`.

## Summary e dificuldade informativa

Um índice efêmero memoizado agrega províncias/população por owner atual e tropas por army owner, em uma passagem por cada coleção. Capital é resolvida pelo ID explícito do Country e mostrada pelo nome da província; nunca pelo ID. Exibe holdings, população, tesouro, renda/despesas diárias iniciais, manpower e tropas iniciais. São os valores do snapshot inicial, sem executar economia para preencher a tela.

Helper isolado `estimateCountryDifficulty`:

```
score = provinceCount + population / 1_000_000
      + max(0, goldIncome - goldExpense) / 10
      + manpower / 10_000 + armyStrength / 5_000
```

Score >= 40: Easy; >= 15: Medium; >= 5: Hard; abaixo: Very Hard. Não modifica dificuldade da IA, recursos, fórmulas ou gameplay. É uma aproximação dos recursos disponíveis, sem avaliar fronteiras, alianças ou riscos estratégicos. Não é um sistema de balanceamento.

## Player dinâmico e sistemas existentes

`GameApp` recebe o país inicial de `CampaignEntry`; o default do mapa deixa de determinar o player. Tecnologia/focus, economia, exército, diplomacia/feedback, cheats, UI, endgame, guerra/rebelião e logs/toasts continuam recebendo o mesmo `playerCountryTag` dinâmico, pelos contratos existentes. A exclusão da IA usa esse tag. Não se alteraram suas regras.

Os estados e refs são criados com o país confirmado ou diretamente com o snapshot do save, evitando um render inicial de partida com player errado. Cheats globais ficam disponíveis somente na partida.

## Save / Load

Save V3 já persiste o jogador em `technology.player.countryTag`. Esse campo é a fonte única da identidade do player; não foi adicionado um segundo campo redundante nem alterada a versão. Saves manuais e autosave continuam usando o formato existente e `world-v1`.

Autosave válido abre diretamente `GameApp`, com país, tecnologia, bots, data e demais domínios restaurados antes das refs. Carregar um slot pela seleção dispensa Confirm. Carregar nas configurações restaura o mesmo tag, sem reabrir seleção. O hook de saves não recarrega autosave por efeito ao montar uma nova partida, evitando substituir o país recém-confirmado.

Save de outro mapa ou com país do jogador ausente/inválido é rejeitado com mensagem; não há fallback para um jogador diferente. A compatibilidade e migrações já existentes de Save V3 são preservadas; não foi criado um novo sistema de migração.

## Câmera e limitações

Ao entrar na partida, viewport centralizado na capital (ou primeira província owned se não houver capital válida), com extensão aproximada baseada nos centros das províncias próximas. Mínimo 240 × 180 unidades para microestados. Holdings distantes não deslocam a câmera da capital. É apenas foco inicial aproximado: não calcula bounds completos dos paths, não resolve países atravessando o antimeridiano, nem altera a navegação existente. Reset continua mostrando o overview mundial. Trocar país por Load remonta o mapa e aplica o foco do player restaurado.

## Validação e próximos passos

Testes cobrem entrada, ausência de simulação/autosave antes da confirmação, owner/dependências, microestados, busca/labels/roster, summary/dificuldade, câmera, destaque/geometry, identidade inicial, Save V3, Load, cheats, endgame, pesquisa/focus, diplomacia e exclusão do player pela IA. Há integração com o game loop real para verificar que a data só avança após Confirm e escolha de velocidade.

Validação desta entrega: 39 testes adicionados; 1.737 testes passaram em 72 arquivos com `npm run test:run -- --maxWorkers=2`. A primeira execução com paralelismo automático excedeu 5 segundos em dois testes existentes de movimento/economia; a repetição com dois workers passou sem alterar esses testes ou o processamento da IA. `npm run lint`, `npm run typecheck`, `npm run build` e `git diff --check` passaram. Build mantém o aviso de chunk acima de 500 kB. Sem commit ou push.

Próximo passo: **Simulation Activation V1**. Depois: **Map Navigation UX V1**. **World Horizontal Wrap V1** permanece apenas no backlog distante.

Fora desta implementação: active/passive countries, throttling da IA, Naval Warfare/sea zones, navegação completa, World Wrap, Peace Conference, Battle System V3, Provinces V2 e novas migrações de save.
