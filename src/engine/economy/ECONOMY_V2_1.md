# Economy V2.1

## Arquitetura

O sistema é provincial, com coordenação nacional e comércio bilateral direto.
Não existe inventário nacional independente, preço mundial, ordem global,
contrato permanente ou dependência de um mercado mundial futuro.

- `balance.ts`: `ECONOMY_V2_BALANCE`.
- `nationalMarket.ts`: visão nacional pura e regras de necessidade/reserva.
- `internationalTrade.ts`: elegibilidade, matching, transferência real, pagamento
  e política comercial automática compartilhada pelo jogador e pela IA.
- `tradeState.ts`: defaults e normalização segura da fronteira de save/load.
- `src/types/economy.ts`: tarifa e métricas externas do último ciclo.
- `src/components/NationalEconomyPanel.tsx`: painel acessível pela barra superior.
- `src/styles/national-economy.css`: apresentação responsiva do painel.

`Country.trade` é opcional para compatibilidade com os dados iniciais e saves
existentes. Os estoques continuam em `Province.market.goods`.

Arquivos criados (10): os sete módulos/tipos/componentes/estilos acima, esta
documentação, `src/engine/__tests__/economyV2_1.test.ts` e
`src/components/__tests__/NationalEconomyPanel.test.tsx`.

Arquivos alterados (10):

- `src/engine/economy.ts`
- `src/engine/market.ts`
- `src/engine/internalTrade.ts`
- `src/engine/saveSystem.ts`
- `src/hooks/gameLoop/economyTick.ts`
- `src/hooks/useGameLoop.ts`
- `src/types/country.ts`
- `src/App.tsx`
- `src/components/TopBar.tsx`
- `src/index.css`

## Fluxo econômico diário

1. Concluir recrutamentos e construções pelas rotinas existentes.
2. Calcular tropas estacionadas e manutenção como antes.
3. `prepareCountryMarkets`: emprego, produção/consumo provincial, countdown de
   edifícios e comércio interno existente, para todos os países.
4. `processInternationalTrade`: agregação nacional e transferências bilaterais.
5. Recalcular escassez, preço e poder de compra nas províncias transferidas.
6. `processDailyTick(..., marketsPrepared = true)`: finalizar satisfação,
   persistência de fome, crescimento, migração interna, renda, despesas e manpower.
7. Recuperar exércitos pela rotina existente, usando os estoques após o comércio.

A assinatura pública de `processDailyTick` mantém seus argumentos anteriores e
seu comportamento completo quando chamada sem mercados preparados. Produção,
população, crescimento e comércio interno não são executados duas vezes.

## Mercado provincial e comércio interno

`processProvinceMarket`, população, emprego e cadeias produtivas permanecem como
antes. `internalTrade` mantém as mesmas rotas domésticas, reservas, prioridade
FOOD, critérios e métricas `imported/exported`.

A atualização final de escassez/preço/poder de compra foi extraída para
`refreshProvinceMarket`, compartilhada pelos dois comércios. Ela não produz nem
consome novamente e usa `calculateLocalPrice`, sem impor preço nacional aos
mercados provinciais. Importações e exportações externas ficam no registro
nacional, sem misturar os indicadores de comércio doméstico.

Os estoques WOOD/IRON/TOOLS continuam disponíveis para oficinas, obras,
recrutamento e recuperação militar pelas rotinas atuais. Não foram criadas
compras militares especiais. Supply militar mantém sua regra de terreno,
infraestrutura, barracas e carga dos exércitos.

## Agregação nacional

As províncias são selecionadas pelo proprietário atual, em ordem estável por ID.
Para cada bem:

```text
produção nacional = soma(produção provincial)
consumo nacional = soma(consumo provincial registrado)
estoque nacional = soma(estoque provincial real)
demanda nacional = soma(demanda provincial)
saldo produtivo = produção nacional - consumo nacional
```

Demanda e consumo são distintos: consumo não atendido não deve desaparecer da
regra de importação. O preço nacional é a média ponderada pela demanda. Sem
demanda, usa estoque como peso; sem demanda/estoque, usa média simples dos preços
locais. Um país sem mercados usa o preço-base do bem.

Agregados são recalculados, não salvos. Importações/exportações, valores pagos,
receita tarifária e parceiros vêm do último ciclo comercial concluído.

## Reserva, excedente e déficit

O mercado é observado depois do consumo provincial. Para não contar novamente
uma necessidade já atendida:

```text
reserva provincial = demanda * strategicReserveDays
demanda atual pendente = max(0, demanda - consumo)
alvo de estoque provincial = reserva provincial + demanda atual pendente
alvo nacional = soma(alvos provinciais)
excedente nacional = max(0, estoque nacional - alvo nacional)
necessidade nacional = max(0, alvo nacional - estoque nacional)
```

Equivalentemente, com consumo limitado à demanda:
`disponível nacional = estoque + consumo`; o alvo é demanda atual mais reserva.
Produção não é somada outra vez: já entrou no estoque antes da agregação.

Além do excedente agregado, cada província exportadora conserva seu próprio
alvo de estoque. Se alguma província não consegue atender a demanda atual com
`consumo + estoque`, o país não exporta aquele bem, mesmo que tenha estoque
abundante em uma província desconectada.

Importações são limitadas pela necessidade agregada e pela capacidade real de
armazenagem das províncias. Uma reserva desejada que excede a capacidade continua
aparecendo como necessidade teórica, mas nunca permite importar para descartar
recursos. É necessário produzir excedente e ter armazenagem suficiente para
exportar; a reserva FOOD de 30 dias pode exigir depósitos adicionais no mapa
atual. A capacidade provincial existente não foi ampliada automaticamente.

## Matching e transferências bilaterais

Para cada bem, em ordem FOOD, WOOD, IRON, TOOLS:

1. Importadores: maior proporção de escassez, maior necessidade, tag.
2. Exportadores: menor preço nacional, maior excedente, tag.
3. Verificar cada par através de `canCountriesTrade`.
4. Quantidade: mínimo do excedente nacional restante, necessidade restante,
   excedentes provinciais seguros, capacidade de recepção e orçamento disponível.
5. Retirar das províncias com maior excedente seguro; desempatar por ID.
6. Entregar primeiro para demanda atual não atendida em todas as províncias,
   depois formar reservas; priorizar gravidade, déficit e ID.

Quantidades usam unidades de 0,01, arredondadas para baixo. O mesmo volume sai de
uma origem e entra no destino, sem estoque nacional fantasma. Oferta e demanda
são decrementadas após cada negócio; nenhum país reexporta importações do mesmo
ciclo nem vende além do excedente inicial protegido.

Com o mesmo estado, parceiros, volumes, preços e pagamentos são iguais.
Reordenar países/províncias de entrada não altera decisões. Não há `Math.random`.

## Preço, ouro e tarifa

```text
preço bilateral = clamp(
  (preço nacional exportador + preço nacional importador) / 2,
  preço-base * priceMinMultiplier,
  preço-base * priceMaxMultiplier
)
valor = quantidade * preço bilateral
tarifa = valor * tarifa do importador
orçamento inicial = max(0, ouro inicial - minTreasuryReserve)
quantidade financiável = orçamento restante / (preço bilateral * (1 + tarifa))
saldo comercial = valor exportado - valor importado
```

O importador debita `valor + tarifa`; o exportador recebe `valor`; a tarifa entra
no tesouro do próprio importador. Como só há tesouros nacionais neste modelo, a
tarifa é uma transferência interna: a variação líquida do importador é `-valor`.
Exemplo: 111 ouro, compra de 10 ouro e tarifa de 1 ouro resulta em 101 ouro no
importador e +10 ouro no exportador. Não há criação de dinheiro.

O orçamento do ciclo desconta o custo **bruto** e não recicla tarifas nem receitas
de exportação para fazer novas compras no mesmo dia. Tarifas mais altas reduzem
o volume financiável. Não há crédito, dívida ou tesouro negativo causado pelo
comércio. A reserva mínima restringe comércio automático; despesas militares,
obras, pesquisas e manutenção continuam seguindo suas próprias regras.

Receita/despesa fiscal da barra superior mantém o significado original; o saldo
comercial e a receita tarifária aparecem separadamente no painel nacional.

## Dependência e métricas

```text
dependência = clamp(importações do último ciclo / consumo registrado, 0, 1)
```

Sem importação, dependência é zero. Se existem importações mas consumo é zero,
o indicador é 100%, evitando divisão por zero. Este é um indicador de fluxo do
ciclo, não rastreamento da origem de cada unidade em estoque. Compras para
reservas também entram no numerador e podem levar o indicador a 100%.

O mercado atual só registra consumo cotidiano em FOOD; consumo industrial e
custos pontuais de WOOD/IRON/TOOLS continuam representados nas movimentações de
estoque existentes. A UI informa essa limitação, sem alterar o mercado provincial
para fabricar uma série de consumo nova.

Persistem apenas os fluxos do último ciclo por país/bem (`imports`, `exports`,
`importValue`, `exportValue`, `tariffRevenue`), parceiros desse ciclo, tarifa e dia
processado. Não há acumulados, histórico ilimitado nem caches nacionais. Produção,
consumo, saldo produtivo, preço e dependência são derivados.

## IA econômica

A política automática está no motor central e vale também para o jogador:
importar déficits relevantes, vender excedentes reais, preservar reserva de bens
e ouro e não fazer compras sem necessidade. Ela não prevê anos, usa crédito nem
planejamento macroeconômico. Não existe uma segunda rotina de compra concorrente
em `aiEconomy.ts`; a IA já existente continua escolhendo obras, pesquisa, leis e
recrutamento normalmente.

## Diplomacia, guerra, anexação e rebelião

`isDiplomaticCountry` e `areAtWar` são reutilizados. Também são verificados os
países e proprietários atuais e os registros de guerra, inclusive quando falta
uma relação sincronizada.

Países em paz comerciam sem fronteira, aliança, NAP, garantia, acesso militar ou
tratado. Guerra bloqueia a próxima transferência imediatamente; não há negócio
enfileirado ou contrato a cancelar. Apenas o par em guerra é excluído: o comércio
com terceiros em paz continua permitido. Estoques já comprados não desaparecem.

Anexados, países sem território e tags `rebel_*` não participam. Métricas antigas
de participantes inválidos são limpas no tick comercial, preservando tarifa e
estoques provinciais. Uma província transferida leva seu estoque real consigo.
Um país restaurado pode comerciar quando volta a ter território válido.

`canCountriesTrade` é a fronteira limpa para futuros tratados/embargos opcionais;
nenhum desses mecanismos foi implementado ou se tornou dependência obrigatória.

## Saves

V1 e V2 carregam `Country.trade` via `normalizeNationalTrade`.
Saves sem o campo recebem tarifa de 10% e fluxos vazios. Valores novos inválidos
são normalizados; tarifa recebe clamp 0..50%; não surgem agregados ou inventários
nacionais durante a migração. Ouro e estoques seguem os dados existentes.

`lastTradeDay` impede repetir transferências ao carregar/reprocessar o mesmo dia.
O save continua na versão 2, sem alterar Military V2, Rebellion V2, Terrain V1,
pathfinding ou formatos diplomáticos.

## Balance final

| Campo | Valor |
| --- | ---: |
| strategicReserveDays | 30 |
| defaultTariffRate | 0,10 |
| maxTariffRate | 0,50 |
| minTreasuryReserve | 100 ouro |
| tradeTickInterval | 1 dia |
| minimumTradeVolume | 1 unidade |
| minimumImportNeed | 1 unidade |
| priceMinMultiplier | 0,5 |
| priceMaxMultiplier | 3 |
| volumePrecision | 100 (0,01 unidade) |
| volumeEpsilon | 1e-8 (tolerância de ponto flutuante em unidades) |
| displayedPartners | 3 por direção |

## Auditoria, testes e limites

Foram auditados market, internalTrade, economyTick, buildings, population,
satisfaction, recruitment, supply, saveSystem, aiEconomy e UI. A correção de ordem
permite importações antes de satisfação/população, sem tick duplo. A rotina
compartilhada de preços evita fórmulas locais divergentes. A capacidade de
armazenagem evita comprar bens que seriam perdidos imediatamente por overflow.

`economyV2_1.test.ts` cobre agregação, reservas, déficit, origem/destino, conservação,
ouro, tarifa, capacidade, preços, determinismo, guerra, restauração, saves V1/V2,
idempotência e integração com satisfação. Inclui 180 dias no mapa da América do
Sul com guerra Brasil–Argentina no dia 60, além de cenários bilaterais
Brasil–Argentina e Brasil–Chile.

`NationalEconomyPanel.test.tsx` cobre renderização, valores, sinais de saldo,
parceiros, tarifa, defaults, fechamento e acesso pela barra superior. As suítes
anteriores são mantidas como regressão de mercado, população, comércio doméstico,
recrutamento, supply, diplomacia, rebelião e terreno.

O navegador integrado não está disponível nesta sessão. A validação de UI usa
renderização DOM automatizada; os seis meses são simulação de engine, não uma
inspeção visual interativa. A simulação econômica não substitui um playtest
completo das decisões militares e de construção da IA.

Limites intencionais: transporte internacional sem custo/distância, destinos
diretos sem rota física internacional, matching sequencial com prioridades
determinísticas, reserva fixa, indicadores de um ciclo e ausência de série de
consumo industrial completa. O estoque pós-consumo importado alivia a escassez
pela mesma interpretação de disponibilidade usada pelo comércio doméstico.

Extensões opcionais podem acrescentar bens, edifícios, cadeias produtivas,
especialização, tratados, embargos e políticas tarifárias sobre esta mesma base
bilateral. Mercado mundial, moedas, câmbio, inflação, dívida, bancos, bolsas,
sanções, comboios e bloqueios não foram implementados.

## Validação desta implementação

- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm run build`: passou; permanece o aviso de bundle acima de 500 kB.
- `npm run test:run`: 519 testes em 34 arquivos passaram, incluindo 44 testes novos.
- `git diff --check`: passou.
- Não foi realizado commit ou push.
