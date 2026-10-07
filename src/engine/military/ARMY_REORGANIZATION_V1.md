# Army Reorganization V1

Reorganização manual de regimentos inteiros, sem mudanças de balance, combate,
movimento, logística ou formato dos saves.

## Auditoria e arquitetura

As funções `splitArmy`, `splitArmyHalf` e `mergeArmies` já existiam em
`movementEngine.ts`. Foram reaproveitadas como primitivas: split copia os campos
dos regimentos; merge concatena regimentos sem combinar forças. A fusão automática
da IA em `hooks/gameLoop/aiTick.ts` permanece usando a primitiva existente.

A camada `reorganization.ts` centraliza validação, mensagens e operações sobre a
lista de exércitos. Retorna um resultado completo ou uma falha sem modificar o
estado recebido. `useArmyActions` consulta as referências atuais, aplica a operação
e atualiza a seleção. Não há mudanças em BFS, movement tick ou battle snapshots.

Problemas corrigidos na implementação anterior:

- Índices repetidos ou fracionários no split podiam duplicar ou perder regimentos.
- Os handlers verificavam poucas condições e repetiam a remoção dos regimentos.
- A velocidade derivada do exército original não era atualizada após split.
- O contador de IDs podia colidir com IDs de exércitos carregados de um save.
- A seleção após fusão podia apontar para exércitos removidos.

## Regras e bloqueios

Um exército deve existir, pertencer ao jogador, ter localização provincial válida
e ao menos um regimento vivo. Facções rebeldes não são reorganizáveis pelo jogador.
Tipos modernos e legados reconhecidos são aceitos igualmente.

Bloqueiam a operação: `inCombat`, participação em `ActiveBattle`, destino, destino
final, path, waypoints, progresso ou posição intermediária. Transferência e fusão
exigem mesmo proprietário e mesma província. As mensagens de engine e UI vêm de
`REORGANIZATION_BLOCKS` e dos seletores compartilhados.

O retreat atual é instantâneo e não possui flag persistente própria. Não foi
criado outro estado de retreat; os estados militares e de movimento existentes
continuam bloqueando a reorganização quando presentes.

## Split

`splitArmyByRegiments` recebe ID do exército, índices e contexto atual. Índices
devem ser inteiros, únicos e válidos. Nenhum/todos selecionados são bloqueados;
o original deve manter ao menos um regimento vivo.

O novo exército fica na mesma província, sem destino, path, movement plan ou
combate. Nome: `Nome (Destacamento)`, com sufixos 2, 3 etc. quando necessário.
O gerador sequencial existente ignora IDs já presentes no estado, inclusive após
load. Não usa aleatoriedade. O original mantém a ordem dos regimentos restantes;
o destacamento usa a ordem original, independentemente da ordem dos cliques.

`splitArmyByHalf` usa a mesma operação: seleciona os primeiros
`floor(regiments.length / 2)` regimentos, sem balancear força. O atalho antigo
permanece disponível. Após split, apenas o novo exército fica selecionado.

## Transferência e fusão

`transferRegiments` move os regimentos selecionados para o fim do destino,
preservando sua ordem original. O source não pode ficar vazio ou sem tropas
vivas. Após a operação, somente o source fica selecionado.

`mergeArmyGroup` valida todos os exércitos antes de executar. O primeiro da
seleção mantém ID e nome; os demais são removidos. Regimentos são concatenados
na ordem dos exércitos selecionados, sem combinar unidades do mesmo tipo.
Após fusão, somente o exército resultante fica selecionado.

## Conservação e integração

Strength, maxStrength, organização, moral, experiência, origem, tipo e campos
persistentes adicionais são preservados. Regiment não tem ID nativo; nenhum
sistema novo de IDs foi introduzido. Campos extras existentes, incluindo IDs,
são conservados e a operação não duplica regimentos.

Força total, força máxima e quantidade de regimentos permanecem iguais. Ouro,
manpower e recursos provinciais/nacionais não são alterados. A velocidade agregada
é recalculada pelos helpers existentes. Supply e logística continuam derivados
da composição e do estado territorial, sem transporte ou transferência de supply
como recurso. Regimentos danificados não são curados.

Operações usam o estado atual na confirmação. Split/transfer também validam uma
assinatura dos regimentos apresentada no modal, impedindo aplicação de índices
obsoletos após atualização da composição. Se o estado mudar enquanto o modal
estiver aberto, a UI bloqueia a confirmação: feche e reabra para revisar.

## UI e acessibilidade

`ArmyReorganizationPanel` integra o painel individual e o resumo multisseleção.
Oferece Dividir, Transferir, Fundir e o atalho Dividir pela metade. A multisseleção
oferece apenas Fundir selecionados. Alvos são filtrados pelos mesmos validadores
da engine; bloqueios são mostrados sem limpar rotas automaticamente.

O modal lista regimentos com checkbox, força atual/máxima, organização, moral,
experiência e origem. Exibe preview das tropas restantes, transferidas e composição,
ou preview da fusão. Transferência/fusão individual usam seletor de destino.
Confirmar revalida e aplica; cancelar não altera o estado militar. O hook de diálogo
existente fornece gerenciamento de foco, navegação por teclado e fechamento com
Escape. A operação gera feedback/log e não abre popovers automaticamente.

## Save/load e compatibilidade

Army e Regiment já são persistidos. Nenhum campo ou versão de save foi adicionado,
nenhuma migração foi necessária. Saves antigos, unidades legadas e regimentos
danificados continuam usando a serialização existente. A seleção é estado de UI.

As primitivas legadas e os handlers antigos permanecem disponíveis para
compatibilidade. A UI do jogador usa a camada validada; o merge da IA permanece
no seu fluxo existente, sem obrigá-la a usar regras de seleção do jogador.

## Arquivos

Criados:
- `src/engine/military/reorganization.ts`
- `src/components/ArmyReorganizationPanel.tsx`
- `src/engine/__tests__/armyReorganizationV1.test.ts`
- `src/components/__tests__/armyReorganizationV1.test.tsx`
- Este documento.

Alterados:
- `src/engine/military/movementEngine.ts`: proteção dos índices e split ordenado.
- `src/engine/military/militaryUtils.ts`: IDs sem colisões com armies existentes.
- `src/engine/military/index.ts`: exports da camada central.
- `src/hooks/app/useArmyActions.ts`: operações validadas e seleção após execução.
- `src/components/ArmySelectionSummary.tsx`: espaço para controles compartilhados.
- `src/App.tsx`: integração individual e multisseleção.
- `src/styles/army.css`: estilos locais do modal e preview.

## Testes e limitações

Suíte dedicada cobre conservação e atomicidade, unidades modernas/legadas,
danos/experiência/origem, ordem, nomes e IDs, split/half/transfer/merge, bloqueios,
batalhas ativas, assinatura obsoleta, UI, seleção e roundtrip das três operações.
Toda a suíte existente é executada para regressões.

Não há templates, auto-balance, dissolução, conversão de unidade, compartilhamento
de experiência ou split coletivo. A IA não recebe planejamento de reorganização.
Dados previamente corrompidos não são reparados pela reorganização.

Navegador integrado indisponível nesta sessão: inspeção visual manual de mapa,
batalha e exército danificado não foi realizada. A interface foi verificada por
testes DOM; essa verificação não substitui uma sessão visual interativa.
