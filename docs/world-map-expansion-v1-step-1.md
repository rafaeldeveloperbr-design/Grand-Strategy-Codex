# World Map Expansion V1 — Passo 1

## Arquitetura e cenário

O mapa ativo usa `mapRegions = [southAmerica, northAmerica]` e o mesmo `assembleMap`. Gameplay, topology, geometry, países e capitais continuam separados em `MapRegion`. Não existe um sistema paralelo de mapa.

São **27 países e 91 províncias**: os 13 países/56 províncias sul-americanos preservados, mais 14 países/35 províncias novos. IDs, gameplay, capitais e ligações terrestres internas da América do Sul permanecem intactos. Sua geometria foi regenerada no espaço mundial. Um helper pequeno de inicialização provincial evita copiar mercados/buildings/população, preservando os defaults sul-americanos.

O assembler exige rosters correspondentes de gameplay/topology/geometry, rejeita IDs e tags duplicados e aceita uma lista genérica opcional de conexões entre regiões. Não conhece regras específicas de EUA/Canadá.

## Países, capitais e escala

| Tag | País | Províncias | Capital representada |
| --- | --- | ---: | --- |
| CAN | Canadá | 6 | Ottawa, em Ontário |
| USA | Estados Unidos | 12 | Washington, no Atlântico Médio |
| MEX | México | 6 | Cidade do México, no Centro |
| GTM | Guatemala | 1 | Cidade da Guatemala |
| BLZ | Belize | 1 | Belmopan |
| HND | Honduras | 1 | Tegucigalpa |
| SLV | El Salvador | 1 | San Salvador |
| NIC | Nicarágua | 1 | Managua |
| CRI | Costa Rica | 1 | San José |
| PAN | Panamá | 1 | Cidade do Panamá |
| CUB | Cuba | 1 | Havana |
| HTI | Haiti | 1 | Porto Príncipe |
| DOM | República Dominicana | 1 | Santo Domingo |
| JAM | Jamaica | 1 | Kingston |

As 35 províncias adicionadas:

- Canadá: Colúmbia Britânica, Pradarias, Ontário (Ottawa), Quebec, Canadá Atlântico, Norte do Canadá.
- EUA: Noroeste do Pacífico, Califórnia, Montanhas do Oeste, Sudoeste, Texas, Grandes Planícies, Centro-Oeste, Grandes Lagos, Sul Profundo, Flórida, Atlântico Médio (Washington), Nova Inglaterra.
- México: Baixa Califórnia, Norte do México, Centro (Cidade do México), Costa do Golfo, Yucatán, Sul do México.
- América Central: Cidade da Guatemala, Belmopan, Tegucigalpa, San Salvador, Managua, San José, Cidade do Panamá.
- Caribe: Cuba (Havana), Haiti (Porto Príncipe), República Dominicana (Santo Domingo), Jamaica (Kingston).

Todas as capitais existem, pertencem ao país e estão em seu índice de províncias. `mapCapitals` continua derivado das regiões. Algumas capitais aparecem entre parênteses no nome da região estratégica, sem criar uma província urbana adicional.

Country contém cores, bandeiras, recursos/economia e cópia de `DEFAULT_LAWS`. Recursos são balanceados por população/desenvolvimento de gameplay; EUA ficam acima de Canadá/México, sem multiplicadores militares novos ou tesouro extremo. Valores e países contemporâneos são convenções do cenário, não reconstrução histórica/censo de 1444.

## Convenção de IDs

IDs ASCII snake_case independem dos nomes visíveis: `sa_` e `na_` estão ativos; `eu_`, `af_`, `as_`, `oc_` ficam reservados. North America usa `na_<tag lowercase>_<province>`. Todos os 56 IDs sul-americanos permanecem.

## Metadata e coordenadas mundiais

`worldMetadata.ts` define o único metadata global ativo:

```text
id: world-v1
name: World Map V1
bounds: x=0, y=0, w=5040, h=2520
initialViewBox: x=500, y=100, w=1750, h=2050
defaultPlayerCountry: BRA
```

Projeção equiretangular compartilhada: `x = (longitude + 180) × 14`, `y = (90 − latitude) × 14`. A escala antiga foi preservada; na América do Sul isso equivale a translação de +1372 em x e +1078 em y. Não foram mudadas proporções, distâncias ou seeds.

O viewBox inicial enquadra as duas Américas, dentro do espaço que comportará os próximos continentes. `southAmericaMetadata` foi removido para evitar um metadata regional como cenário ativo global.

GameMap mantém um único SVG, seleção por path, tooltip, pan em coordenadas SVG e zoom/reset. Somente fundo/grid passaram a usar os bounds mundiais. As apresentações existentes já usam índices memoizados; não houve refactor de UI ou otimização ampla. Há 91 shapes selecionáveis únicos, preservando as sombras existentes.

## Geometria e tooling

Base: [Natural Earth Admin 0 1:110m](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson), em [domínio público](https://www.naturalearthdata.com/about/terms-of-use/). Os outlines selecionados estão versionados, permitindo geração offline.

`northAmerica.provinces.json` fornece seeds/valores. `generate_north_america.py` reaproveita a subdivisão por semiplanos, recorta células aos países e gera `geometry.ts`/`definitions.ts`. `world_projection.py` é consumido pelos dois geradores. Nenhum path foi desenhado manualmente e nenhuma conexão é inferida da geometria.

Com Python/Shapely disponíveis:

```sh
python tools/map/generate_south_america.py
python tools/map/generate_north_america.py
python tools/map/audit_world.py
```

Os geradores auditam validade, cobertura dos outlines selecionados e ausência de sobreposição interior estrutural. `audit_world.py` verifica os 91 SVGs efetivamente gerados, centros internos e bounds globais. O maior resíduo entre paths arredondados é aproximadamente 0,00658 unidade SVG²; tolerância 0,05 apenas para slivers de arredondamento.

## Topologia e componentes

Cada região mantém `landConnections` explícitas, expandidas bidirecionalmente. `crossRegionConnections.ts` define **uma única vez** `sa_col_caribe` ↔ `na_pan_panama`. O assembler expande a ligação nos dois sentidos, sem modificar os rosters regionais nem duplicar a província colombiana em North America.

O corredor liga Canadá → EUA → México → Guatemala/Honduras → Nicarágua → Costa Rica → Panamá → Colômbia → América do Sul. Belize e El Salvador mantêm suas fronteiras próprias. Routing continua exigindo acesso diplomático; rota física não concede permissão automaticamente.

`MapRegion.landmasses` declara componentes esperados. O ID compartilhado `american-mainland` une as regiões. Os quatro componentes são: continente americano com 87 províncias, Cuba com 1, Hispaniola com 2 e Jamaica com 1.

Haiti–República Dominicana possuem fronteira terrestre. Cuba/Jamaica não têm neighbors ou rotas ao continente. Somente ilhas declaradas de uma província podem ficar isoladas sem erro. Isolamento continental, split inesperado de landmass, neighbors ausentes/assimétricos, owners/capitais inválidos e ligações inventadas entre landmasses distintas continuam falhando.

O wrapper público aplica declarações do mundo ativo; outros cenários podem passar opções explícitas. O validator genérico em `validation.ts` permanece estrito por padrão. Componentes ficam disponíveis nos diagnósticos, sem desativar a validação global de conectividade.

## Sistemas existentes

`createInitialArmies` permanece genérico e cria 27 exércitos em capitais válidas. Não há exceção militar por continente. Novas províncias usam Terrain V1, mercado, população, buildings, infraestrutura, unrest e regras de recrutamento existentes.

Testes verificam logística de todas as províncias novas, recrutamento em todas as capitais novas, trade doméstico e 30 ticks econômicos do mundo inteiro com recursos/estoques finitos e importações/exportações balanceadas. A auditoria antiga de 180 dias mantém explicitamente seu escopo sul-americano e todas as asserções, sem aumentar timeout; a expansão do export ativo havia feito esse teste simular involuntariamente o mundo inteiro.

Diplomacy V2 inicializa 351 pares entre os 27 países. Testes executam guerra EUA–México, chamada de Canadá como aliado e rendição/transferência/anexação pelo War Resolution V1. Esses sistemas não foram reescritos nem receberam exceções por continente.

## Save incompatibility deliberada

Schema permanece **Save V3**; `mapId = world-v1` identifica o cenário. Não há migração South America → World nem merge de novas províncias.

O loader rejeita mapId explícito de outro mapa com mensagem controlada. Saves sem mapId ainda podem ser decodificados pelo mecanismo genérico existente, mas a aplicação exige o roster exato do mapa ativo por `isSaveCompatibleWithActiveMap`: as 56 províncias antigas não passam. Tentativa de load não modifica o save rejeitado. Mensagens usam metadata global. Não foi criada migration V4.

## Arquivos

Criados:

- `src/data/map/regions/northAmerica/{countries,definitions,provinces,topology,geometry,terrain,index}.ts`.
- `src/data/map/{worldMetadata,crossRegionConnections,provinceGameplay}.ts`.
- `tools/map/{generate_north_america,audit_world,world_projection}.py` e `northAmerica.{provinces,outlines}.json`.
- `src/engine/__tests__/{worldMap.test.ts,worldMapRendering.test.tsx}`.
- Este documento.

Alterados:

- `src/data/map/{index,types,validation}.ts` e `regions/southAmerica/{geometry,index,provinces}.ts`.
- `src/components/GameMap/GameMap.tsx`.
- `src/engine/saveSystem.ts`, `src/hooks/app/useSaveSystem.ts`.
- `tools/map/generate_south_america.py`, `tools/map/README.md`.
- Testes `southAmerica`, `southAmericaRendering`, `mapTopology`, `mapRouting`, `terrainV1`, `internalPoliticsV1`, `economyV2_1`, adaptando rosters e preservando verificações.

## Testes, limitações e próximos passos

76 novos testes: 68 de engine/mapa/integração e 8 de render/controles/save. Suíte completa: **1072 testes em 61 arquivos**, sem testes removidos, skipped ou regressões silenciadas. As suítes South America, Movement Commands V2, Terrain V1, Logistics V2, Diplomacy V2, War Resolution V1, Combat V2 e Rebellion V2 permanecem exigidas.

Uma prévia gerada dos mesmos SVGs foi inspecionada: proporções coerentes, duas Américas sem sobreposição estrutural. O navegador conectado não estava disponível nesta sessão; não se afirma validação interativa em navegador real. Seleção, hover/tooltip, zoom/reset e pan têm testes de UI; uma conferência interativa adicional é recomendada.

Limitações: sem Alaska, Hawaii, ilhas árticas canadenses, Newfoundland ou pequenas ilhas caribenhas/BHS/TTO/PRI. Mantém-se o maior polígono continental/principal de cada país. Subdivisões são estratégicas, não administrativas. Sem transporte naval, as ilhas não são alcançáveis por movimento terrestre; dominação integral dependerá dos sistemas navais futuros.

Próximos passos: Passo 2 Europe + Africa; Passo 3 Asia + Oceania; depois Naval Warfare V1. Todos compartilham coordenadas e assembler. Battle System V3 permanece dívida futura. Este passo não altera combate, Peace Conference, Research/Focus Trees ou regras de War Resolution.
