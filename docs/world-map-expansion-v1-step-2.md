# World Map Expansion V1 — Passo 2: Europe + Africa

## Resultado e arquitetura

Branch: `feat/World-Map-Expansion-V1`. Sem commit/push.

O mesmo `assembleMap` agora monta `[southAmerica, northAmerica, europe, africa]`.
Cada região mantém `countries.ts`, `definitions.ts`, `provinces.ts`, `topology.ts`,
`geometry.ts`, `terrain.ts` e `index.ts`. Não existe sistema paralelo de mapa.
Os 27 países/91 províncias das Américas permanecem intactos.

| Região | Países | Províncias |
|---|---:|---:|
| América do Sul | 13 | 56 |
| América do Norte | 14 | 35 |
| Europa | 28 | 56 |
| África | 34 | 49 |
| **Total** | **89** | **196** |

São **62 países e 105 províncias adicionados**. Capitais explícitas pertencem aos
países e também alimentam `mapCapitals`, exércitos iniciais e logística.

## Países e escala

Europa: PRT Portugal; ESP Espanha; FRA França; GBR Reino Unido; IRL Irlanda;
BEL Bélgica; NLD Países Baixos; DEU Alemanha; DNK Dinamarca; NOR Noruega;
SWE Suécia; FIN Finlândia; POL Polônia; CZE Tchéquia; AUT Áustria; CHE Suíça;
ITA Itália; HUN Hungria; ROU Romênia; BGR Bulgária; GRC Grécia; SRB Sérvia;
HRV Croácia; UKR Ucrânia; BLR Belarus; LTU Lituânia; LVA Letônia; EST Estônia.

França/Alemanha têm cinco províncias; Espanha/Itália/Reino Unido, quatro;
Polônia/Ucrânia, três; os demais, uma ou duas. Rússia fica para Ásia/Eurásia.
Microestados e Luxemburgo não são modelados.

África: MAR Marrocos; DZA Argélia; TUN Tunísia; LBY Líbia; EGY Egito;
MRT Mauritânia; MLI Mali; SEN Senegal; GIN Guiné; CIV Costa do Marfim; GHA Gana;
BFA Burkina Faso; NER Níger; NGA Nigéria; CMR Camarões; TCD Chade;
CAF República Centro-Africana; SDN Sudão; ETH Etiópia; ERI Eritreia; SOM Somália;
KEN Quênia; UGA Uganda; TZA Tanzânia; COD República Democrática do Congo;
COG República do Congo; AGO Angola; ZMB Zâmbia; ZWE Zimbábue; MOZ Moçambique;
NAM Namíbia; BWA Botsuana; ZAF África do Sul; MDG Madagascar.

África usa uma a três províncias por país. Argélia, Congo e África do Sul têm três;
Marrocos, Líbia, Egito, Mali, Nigéria, Sudão, Etiópia, Tanzânia e Angola têm duas.

IDs estáveis: `eu_<tag lowercase>_<ascii snake province>` e
`af_<tag lowercase>_<ascii snake province>`. Exemplos: `eu_fra_paris`,
`eu_deu_bavaria`, `af_egy_cairo`, `af_zaf_cape`, `af_nga_lagos`.
Nomes visíveis permanecem amigáveis e independentes dos IDs.

## Gameplay e terreno

As novas províncias usam `createProvinceGameplay`, o helper do Passo 1: população,
capacidade, buildings, mercado/estoques, defesa, unrest, owner e originalOwner.
Todas usam terrenos existentes. Alpes/Atlas/planalto etíope têm mountains;
Escandinávia tem forest/hills; Europa Central, plains/forest; Bálcãs, hills/mountains;
Saara, desert; Congo, jungle; África Austral, plains/hills/desert.

Capitais começam com 30 mil habitantes e desenvolvimento 7; outras regiões,
22 mil e desenvolvimento 5. São valores de gameplay, sem pretensão censitária.
Todos os países usam DEFAULT_LAWS e recursos iniciais proporcionais ao próprio
desenvolvimento. Alemanha e França têm recursos iniciais equivalentes, e os
países africanos têm mercados, recursos e recrutamento utilizáveis.

## Geometria, projeção e tooling

Natural Earth Admin 0 1:110m, domínio público, igual ao Passo 1. Os extracts
versionados em `europe.outlines.json`/`africa.outlines.json` permitem geração offline.
O maior polígono de cada país é usado, exceto Dinamarca, que retém Jutlândia e
Zelândia. `outlinePart` nos seeds dinamarqueses impede que a célula de Copenhague
incorpore fragmentos da Jutlândia. Nenhum SVG foi desenhado manualmente.

`generate_europe.py` e `generate_africa.py` chamam `generate_region.py`, que reutiliza
os helpers de recorte por semiplanos/SVG do gerador sul-americano e a projeção
compartilhada de `world_projection.py`:

```text
x = (longitude + 180) × 14
y = (90 − latitude) × 14
bounds = { x: 0, y: 0, w: 5040, h: 2520 }
```

Células são recortadas ao país, com centros internos auditados após arredondamento.
Fragmentos lineares sem área de GeometryCollections não são exportados como paths.
Cobertura do país aceita somente slivers numéricos inferiores a 1e-6 grau².
`audit_world.py` confere os 196 SVGs efetivamente gerados: roster, IDs únicos,
validade, centros internos, bounds e overlap estrutural. Também verifica contato
geométrico das ligações terrestres explicitamente escritas nas duas novas regiões.
O maior overlap arredondado foi **0,0082361 unidade SVG²**, abaixo da tolerância
de 0,05 herdada do Passo 1. O audit não infere nem escreve neighbors.

## Topologia e landmasses

Topologia terrestre explícita, expandida simetricamente por região. A ligação
cross-region Panamá–Colômbia permanece a única existente.

São 11 componentes intencionais:

| Landmass | Províncias |
|---|---:|
| american-mainland | 87 |
| cuba | 1 |
| hispaniola | 2 |
| jamaica | 1 |
| european-mainland | 44 |
| scandinavian-mainland | 6 |
| great-britain | 4 |
| ireland | 1 |
| zealand | 1 |
| african-mainland | 48 |
| madagascar | 1 |

**Sem Rússia, a ligação terrestre da Escandinávia ao restante da Europa está fora
do roster ativo.** Por isso há dois blocos continentais europeus intencionais;
não se inventa uma ponte Dinamarca–Suécia. Qualquer split adicional dentro de
um desses blocos ou da África continental continua falhando no validator.

Irlanda do Norte não é modelada: Irlanda e Grã-Bretanha têm landmasses próprios.
Copenhague está na Zelândia, sem travessia terrestre para Jutlândia. Não há
Channel Tunnel, Gibraltar, Mediterrâneo nem ligação Madagascar–continente.
Fronteiras por lagos interiores seguem o modelo coarse já existente, incluindo
Congo–Tanzânia. Territórios e países omitidos continuam lacunas geométricas.

Rotas testadas: Portugal→Alemanha, Espanha→Polônia, França→Itália,
Noruega→Finlândia (incluindo via Suécia), Croácia→Grécia, Marrocos→Egito,
Nigéria→África do Sul, Etiópia→África do Sul. Acesso diplomático continua obrigatório.
Rotas marítimas e conexões a países ausentes são rejeitadas.

Futuros edges para Rússia/Eurásia e Egito/Sinai→Oriente Médio serão declarados
no Passo 3, somente após os endpoints existirem. Não há placeholders inválidos.

## UI, viewBox e performance

GameMap continua um único SVG com quatro regiões, paths clicáveis, tooltips,
nomes, capitais e army markers. Sem redesign. Zoom, pan e reset são preservados.
O reset inicial agora usa `{x:500,y:100,w:2900,h:2050}`, que contém todos os centros
ativos e oferece overview das Américas, Europa e África. Europa é densa e exige
zoom para leitura detalhada; o mapa não tenta tornar todos os labels legíveis
ao mesmo tempo no overview.

ProvinceLayer usa Maps memoizados para cores por país e origem provincial de
revoltas, eliminando buscas lineares repetidas nesses pontos. Sem rewrite do render.

A expansão para 3.916 relações expôs um custo desnecessário nos ticks econômicos.
Foram feitas duas otimizações pequenas, sem alteração de regras:

- `getRelation` compara diretamente os dois sentidos do par, preservando primeiro
  match, em vez de ordenar/serializar JSON para cada registro candidato.
- Logística filtra relações do país antes de chamar `hasMilitaryAccess` canônico.
  Acesso direcional, alianças, hostilidade e primeiro match permanecem iguais.

O teste de **30 ticks do mapa inteiro**, com conservação de comércio e recursos
finitos/não negativos, mantém a duração e o timeout originais. Não houve aumento
de timeout, redução de simulação nem remoção de assertivas para esconder regressão.

## Integração e save

Inicialização genérica cria 89 exércitos em capitais controladas. Logística fornece
eficiências finitas para todas as províncias; Jutlândia fica corretamente sem rota
terrestre da capital insular. Trade doméstico não atravessa essa separação.
Recrutamento foi iniciado e concluído nas capitais dos 62 novos países.
Diplomacy V2 cria todos os 3.916 pares sem exceções continentais.

FRA×DEU e EGY×LBY passaram pelo fluxo real de declaração, movimento, Combat V2,
baixas, transferProvince, rendição e cleanup de campanha. Fórmulas de War Resolution,
controle por Province.owner, originalOwner, Rebellion V2 e combate permanecem intactos.

`mapId` permanece **world-v1**; schema de save permanece V3. Round-trip cobre o
roster completo. Saves das Américas com world-v1 são incompatíveis por roster exato,
mesmo sem mapId; não se mesclam regiões nem se cria migração. O sistema já existente
faz essa checagem antes de publicar o estado carregado.

## Arquivos

Criados:

- `src/data/map/regions/{europe,africa}/{countries,definitions,provinces,topology,geometry,terrain,index}.ts`.
- `tools/map/{europe,africa}.{outlines,provinces}.json`.
- `tools/map/{generate_region,generate_europe,generate_africa}.py`.
- `src/engine/__tests__/worldMapStep2.test.ts` e este documento.

Alterados:

- `src/data/map/{index,worldMetadata}.ts`.
- `src/components/GameMap/ProvinceLayer.tsx`.
- `src/engine/diplomacy/diplomacyRelations.ts` e `src/engine/logistics/index.ts`
  (otimizações de consultas equivalentes, sem mudança de regra).
- `src/engine/__tests__/{worldMap.test.ts,worldMapRendering.test.tsx,southAmerica.test.ts,southAmericaRendering.test.tsx,terrainV1.test.tsx,internalPoliticsV1.test.ts}`.
- `tools/map/{audit_world.py,README.md}`.

## Testes e validação

**173 testes adicionados**: 164 novos de dados/topologia/rotas/integração e nove
de UI. Testes anteriores foram adaptados ao roster ampliado, mantendo suas
assertivas funcionais e todos os testes das Américas. Total final: **1.245 testes
em 62 arquivos**, incluindo Movement Commands V2, Logistics V2, Diplomacy V2,
War Resolution V1, Rebellion V2 e Combat V2.

Comandos de validação: lint, typecheck, test:run, build, quatro geradores,
audit_world.py e git diff --check. Resultados finais registrados após execução
integral: todos aprovados. O build mantém o aviso de bundle acima de 500 kB.

Pan/zoom/reset, clicks, context menu, tooltip, labels, capitais e army markers
foram verificados por testes de UI. Não havia navegador habilitado na sessão;
a inspeção visual utilizou render offline dos polígonos gerados, não browser real.

## Limitações e próximos passos

Geometria contemporânea simplificada, não fronteiras históricas de 1444. Não há
todos os países reais, Rússia, Irlanda do Norte, territórios ultramarinos ou
ilhas secundárias (incluindo Córsega, Sicília/Sardenha, Svalbard e Cabinda).
Países insulares são jogáveis internamente, mas não projetam exércitos pelo mar.
O build maior e a expansão futura podem justificar code splitting/profiling;
não foi feito refactor amplo de rendering ou engine.

Passo 3: Ásia + Oceania; depois Naval Warfare V1. Naval/sea zones/transporte naval,
Air Warfare, Peace Conference e Battle System V3 continuam fora deste passo.
Battle System V3 permanece dívida futura; nenhum overhaul de combate foi feito.
