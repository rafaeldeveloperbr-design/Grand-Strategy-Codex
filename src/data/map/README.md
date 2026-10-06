# South America V1

O único cenário ativo é `south-america-v1`, com **13 países e 56 províncias**.
Brasil é o jogador inicial. `regions/current` permanece para comparação, mas
não é importada pelo agregador nem pelo runtime.

| Tag | País | Províncias | Capital explícita |
| --- | --- | ---: | --- |
| BRA | Brasil | 17 | Brasília |
| ARG | Argentina | 7 | Buenos Aires |
| CHL | Chile | 6 | Santiago |
| PER | Peru | 5 | Lima |
| BOL | Bolívia | 4 | La Paz |
| COL | Colômbia | 4 | Bogotá |
| VEN | Venezuela | 4 | Caracas |
| ECU | Equador | 3 | Quito |
| PRY | Paraguai | 2 | Assunção |
| URY | Uruguai | 1 | Montevidéu |
| GUY | Guiana | 1 | Georgetown |
| SUR | Suriname | 1 | Paramaribo |
| GUF | Guiana Francesa | 1 | Caiena |

## Arquitetura

`index.ts` agrega regiões e mantém `provincesData`, `countries`,
`getCountryByTag`, `mapCapitals`, `assembleMap` e `validateMapTopology`.
`src/data/provinces.ts` e `src/data/countries.ts` continuam como reexports.

`regions/southAmerica/` contém:

- `provinces.ts`: gameplay, população, desenvolvimento, construções e mercado.
- `countries.ts`: tags, capitais `capitalId`, holdings, leis e recursos.
- `geometry.ts`: paths SVG e centros visuais; não define movimento.
- `topology.ts`: pares terrestres revisados e explicitamente declarados,
  expandidos nos dois sentidos. Não importa geometria nem infere proximidade.
- `index.ts`: região e metadados de bounds, viewport e jogador.

IDs seguem `sa_<tag minúscula>_<nome ascii snake_case>`, por exemplo
`sa_bra_brasilia`. São globalmente únicos e independentes de ordem,
coordenadas e ownership. `Province` mantém seu formato de runtime; `Country`
acrescenta `capitalId` e `capital` opcionais para compatibilidade legada.

`mapMetadata` expõe bounds de 740 × 1000 e viewport de 790 × 1040 com margem.
GameMap e zoom/reset usam esses valores; pan usa a transformação real do SVG.
Clique direito identifica o path territorial, sem fallback por distância ao
centro quando o usuário clica no mar.

## Geometria e gameplay

O contorno vem do dataset público Natural Earth 1:110m, com posições
contemporâneas dos países. Subdivisões são aproximações por regiões/cidades,
não limites administrativos oficiais. Fontes, outlines e gerador offline
estão em `tools/map/`. O gerador escreve somente geometria e audita cobertura
e sobreposições; não cria movimento. Não há dependência Python no runtime.

Populações de gameplay: 10–40 mil; desenvolvimento: 2–8. Capitais e cidades
são mais importantes; países maiores têm população e recursos maiores.
Todas as províncias possuem mercado, reservas iniciais, construções produtivas
e unrest zero. Produção inicial de alimentos cobre a demanda civil usando
as fórmulas existentes. Cada país inicia um exército na capital com regimentos
padrão de até mil homens, criados em `initialState.ts`.

## Capitais e saves

IA, marcadores, objetivos rebeldes e finalização de batalhas usam capitais
explícitas, sem fallback pela ordem de holdings. Para países sintéticos sem
capital, objetivos rebeldes mantêm a alternativa existente de território mais
desenvolvido; ela não redefine capitais nacionais.

Somente `normalizeSavedCountry` no load pode inferir capital de save legado:
prefere a capital conhecida quando pertence ao país e, na falta dela, a primeira
província antiga. Capitais explícitas são preservadas.

Saves novos registram `mapId`, mantendo o formato geral V2. A aplicação verifica
cenário e IDs antes de carregar. Autosaves fictícios não substituem o novo mapa;
saves manuais incompatíveis são recusados com mensagem. Saves South America sem
`mapId` são aceitos quando os IDs correspondem. Não há conversão entre territórios
fictícios e reais; a carga não apaga slots antigos. O jogador é restaurado a
partir de `technology.player.countryTag`.

## Auditoria e verificação

`validateMapTopology(provincesData, countries)` retorna **valid = true**,
zero issues e uma componente continental de 56 províncias. As quatro arestas
unilaterais fictícias estão fora do runtime. Capitais, owners, holdings e IDs
passam na validação real.

O BFS não foi reescrito. Testes verificam caminhos válidos para Brasília →
Buenos Aires, Santiago → Bogotá, Caracas → Montevidéu e Lima → Brasília com
acesso diplomático, e confirmam que não há passagem livre sem esse acesso.

Problemas encontrados e corrigidos: exércitos/jogador fictícios em `App.tsx`,
vencedor fixo `IMP` no histórico, inferência de capital pela lista, viewport e
pan fixos, clique por proximidade e carregamento de autosaves de outro mapa.
Uma fixture dependia de `Silva Antiqua` no cenário ativo; seus valores agora
são locais. Fixtures de objetivos/rotas passaram a declarar capitais.

`territoryTransfer`, `supplyEngine`, pathfinding e demais regras/ticks não
precisaram de mudanças. A única inferência `provinces[0]` restante é no load.
Não há IDs/tags fictícios no runtime principal.

Lint, typecheck, build e **288 testes em 24 arquivos** passaram. Incluem
topologia, rotas, capitais, mercado, transferências, saves e renderização React
das 56 províncias/13 marcadores, zoom/reset, seleção e início da aplicação.
A prévia estática dos polígonos foi inspecionada. Auditoria geométrica: cobertura
completa dos contornos selecionados e nenhuma sobreposição de área.
Não havia navegador conectado nesta sessão; não foi feita inspeção visual
interativa em navegador. `git diff --check` passou.

## Limitações e futuras regiões

Guiana Francesa é jogável provisoriamente. A data inicial permanece 1444;
o cenário não representa fronteiras políticas históricas. Ilhas offshore e
polígonos separados da Terra do Fogo foram omitidos. Não há rotas marítimas,
terreno militar novo, clima, estreitos, rios navegáveis ou sistema naval.
Capitais não são automaticamente relocadas após conquista; seu ID continua
identificando a capital original. Países estreitos/com uma província possuem
capitais próximas de fronteiras; Brasília tem apenas vizinhos brasileiros.
Labels e offsets ainda são fixos; áreas pequenas podem exigir zoom.
Buscas lineares, `queue.shift()` do BFS e filtros de renderização permanecem;
não há culling avançado nem viewport mundial. A projeção simples distorce
distâncias e não influencia tempo de movimento.

Para outra região, crie os cinco arquivos, use prefixo global exclusivo,
declare capitais e acrescente a região a `mapRegions`. Revise conexões entre
regiões e ajuste os metadados agregados. Rode validação e testes de rotas antes
de ativar. Múltiplas massas terrestres futuras serão diagnosticadas; sua política
de aceitação deverá ser definida sem inventar conexões marítimas.

## Arquivos desta entrega

Criados: `regions/southAmerica/{index,provinces,countries,geometry,topology}.ts`,
`initialState.ts`, `saveCompatibility.ts`, `southAmerica.test.ts`,
`southAmericaRendering.test.tsx` e fontes/gerador/documentação em `tools/map/`.

Alterados: agregador/tipos/README de mapa, `types/country.ts`, `App.tsx`,
`GameMap.tsx`, `useMapControls.ts`, `BattleHistoryModal.tsx`, `CheatPanel.tsx`,
`aiMovement.ts`, `battleFinalizer.ts`, `rebellionSpawner.ts`, `saveSystem.ts`,
`useSaveSystem.ts` e fixtures em `mapTopology.test.ts`,
`rebellionLifecycle.test.tsx` e `rebellionV2.test.ts`.

Branch `feat/map-expansion`, sem commit ou push.
