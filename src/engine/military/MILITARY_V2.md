# Military V2

## Auditoria do protótipo

O sistema anterior possuía dois resolvedores de batalha (`battleResolver` instantâneo e
`continuousBattle` diário), poder baseado sobretudo em `strength`, retirada condicionada
ao número de homens e sete unidades cujos atributos de ataque/defesa não eram usados no
fluxo diário. Recrutamento era validado e cobrado separadamente na UI, IA e engine. A IA
escolhia unidade/província aleatoriamente e limitava suas forças pelo total de tropas do
jogador. Manutenção considerava somente homens estacionados; merge da IA excedia o limite
de um regimento; moral não decidia batalhas; organização, experiência, supply e reforço não
existiam. Logs de debug e um botão de “destravar” movimento evidenciavam responsabilidades
do protótipo na camada React.

## Arquitetura canônica

- `armyStats.ts`: todos os valores derivados de Army/Regiment (força, prontidão, ataque,
  defesa, choque, cerco, consumo e manutenção).
- `recruitmentEngine.ts`: custo, tempo, requisitos, bloqueio, pagamento único e conclusão.
- `supplyEngine.ts`: capacidade provincial simples, compartilhamento local e estados
  `good`, `low` e `critical`. O contrato neutro de terreno permanece desligado.
- `recoveryEngine.ts`: reforço e recuperação diária fora de combate; consome manpower
  nacional e ouro/ferro/ferramentas canônicos.
- `continuousBattle.ts`: único fluxo usado pelo game loop. Aplica pressão diária,
  baixas progressivas, dano de organização/moral, experiência, supply, fortificação,
  cerco, reforços e retirada. O resolvedor instantâneo permanece apenas como API legada
  isolada, sem participação no loop.
- `balance.ts`: constantes ajustáveis sem números dispersos.

## Ordem diária

1. recrutamentos concluem; 2. construções concluem; 3. economia, mercados, comércio e
população processam; 4. forças paradas reforçam e recuperam; 5. diplomacia/tecnologia;
6. IA; 7. movimento (afetado por supply); 8. chegada e batalha diária; 9. rebeliões.
Recursos de recrutamento são pagos ao enfileirar e nunca na conclusão.

## Unidades e papéis

- Infantaria: linha versátil; arqueiros: apoio defensivo econômico; cavalaria: mobilidade
  e choque; cavalaria pesada: ruptura cara; artilharia: fogo e cerco; guarda real:
  resistência profissional; armas de cerco: redução especializada de fortes.

Artilharia, cavalaria pesada, guarda e armas de cerco dependem de Technology V2. Focos
continuam escolhas estratégicas de composição/doutrina; tecnologias representam capacidade
técnica/institucional. Leis entram pelos multiplicadores canônicos de recrutamento,
manpower e manutenção.

## Limitações e expansão

Supply é deliberadamente provincial, sem comboios ou comércio internacional. Não há
efeitos de terreno: `TerrainType` e os modificadores neutros são somente extensão futura.
O relatório histórico ainda usa o formato público `CombatResult`; uma futura migração pode
armazenar séries diárias de organização sem alterar o motor.
