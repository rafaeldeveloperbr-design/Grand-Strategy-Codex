# World Map Expansion V1 — Passo 3B: World Map Completeness

Implementado em 08/10/2026 na branch `feat/World-Map-Expansion-V1`. Sem commit ou push.
O [backlog original](world-map-completeness-backlog.md) permanece como checklist e histórico da dívida.

## Resultado

| Métrica | Passo 3A | Passo 3B |
| --- | ---: | ---: |
| Countries | 128 | 201 |
| Províncias | 274 | 494 |
| Regiões | 6 | 6 |
| Landmasses/componentes terrestres declarados | 17 | 186 |
| Fronteiras terrestres entre regiões | 11 | 14 |
| Pares diplomáticos | 8.128 | 20.100 |
| Bounds | 5040 × 2520 | 5040 × 2520 |

Foram adicionados 73 Countries e 220 províncias: 76 holdings dos novos Countries,
48 dependências agregadas e 96 holdings de geometria recuperada dos Countries CORE.
Todas as prioridades continentais, os soberanos insulares enumerados e os cinco
microestados possuem geometria vetorial. Os 274 IDs anteriores permanecem presentes.
As divisões continentais dos grandes países continuam na escala CORE; os novos
holdings recuperam territórios separados, sem iniciar Provinces V2.

Checklist M49 original: **120 = 71 IMPLEMENTED + 48 AGGREGATED + 1 DEFERRED_WITH_REASON**.
Taiwan e Kosovo acrescentam duas entradas IMPLEMENTED: **122 = 73 + 48 + 1**.
O inventário geométrico original também mantém todas as suas linhas e decisões.
As decisões geométricas adicionais e suas limitações estão explicitadas no backlog;
não são contabilizadas como novos países/áreas M49.

## Arquitetura e integração

`withCompleteness` compõe os dados nas mesmas seis MapRegions, consumindo definições,
geometria e o `createProvinceGameplay` existentes. `additionalHoldings` declara
províncias adicionais de Countries globais. `assembleMap` valida país, ID, owner e
duplicação de holding antes de acrescentá-lo a uma cópia de `Country.provinces`.
Não duplica FRA, USA, GBR ou qualquer outro Country por região. Cores territoriais
usam o Country global. Montagens repetidas não alteram os arrays de holdings CORE.

Capitais existem, pertencem ao Country e constam em seus holdings. Dependências
agregadas não ganham capital nacional, exército próprio ou pares diplomáticos.
`createInitialArmies` permanece genérico: 201 exércitos nacionais nas capitais.
Population, maxPopulation, buildings, market, terrain, defense, unrest, owner e
originalOwner seguem os defaults existentes e valores finitos de gameplay.

Logística, movimento e comércio doméstico usam somente neighbors terrestres.
Owner comum não conecta Hawaii, Réunion, Greenland ou qualquer holding ultramarino
à capital continental. Mercados locais são válidos mesmo quando a logística
nacional está desconectada. O comércio internacional nacional preexistente continua
com sua abstração anterior: não ganhou rotas marítimas, capacidade naval ou um novo
sistema de distribuição colonial. Essa abstração ainda não modela transporte físico
entre pools nacionais/holdings; não deve ser confundida com Naval Warfare.

Diplomacy V2 mantém pares apenas entre Countries. Os testes exercitam declaração,
Combat V2, perdas, transferência, rendição e limpeza de War Resolution para SVK/HUN,
RWA/BDI e KWT/IRQ, além dos cenários anteriores. Fórmulas de combate e rendição
permanecem iguais; não há regras especiais de Peace Conference.

Uma execução adicional com transferências canônicas confirmou a limitação de
rendição em países com muitos holdings ultramarinos: capturar as 5 províncias
continentais FRA, incluindo Paris, e eliminar seu exército com 5.000 baixas produz
**67,647% de surrender progress e zero resoluções**, pois o território original
possui 17 holdings. Sem acesso naval, não é possível ocupar todos esses componentes
a partir do exército continental. A fórmula continua contando todos os holdings;
não foi criada exceção colonial nem Peace Conference para contornar essa limitação.

## Geometria, proveniência e topologia

Natural Earth é domínio público. Proveniência, links, hashes completos dos dois
downloads e comandos de regeneração estão em [tools/map/README.md](../tools/map/README.md).
O extract versionado contém somente os polígonos necessários e seus dados de autoria.
Não há download em runtime nem manifesto paralelo de auditoria.

1:110m permanece a fonte geral. 1:10m é usado apenas para microestados, entidades
omitidas e ilhas ausentes/inadequadas em 1:110m. Microestados preservam sua dimensão
real; as interseções locais são retiradas dos shapes CORE vizinhos. Gibraltar e
Macao usam pequenas janelas vetoriais locais no vizinho para reconciliar costas.
Não há SVG desenhado à mão ou território ampliado para facilitar clique.

Foram recuperados Alaska/Hawaii, Newfoundland e arquipélago canadense, Tierra del
Fuego/Galápagos, Azores/Madeira, Canárias/Baleares, Corsica, Sicily/Sardinia,
Crete/Egeu, Northern Ireland, Kaliningrad, Sakhalin, Chukotka, arquipélagos russos,
Cabinda, Zanzibar, Bioko/Annobon, Tasmania, Hainan, Hokkaido/Shikoku/Ryukyu,
Mindanao/Visayas/Palawan, Kalimantan/Sulawesi/Papua/Nusa Tenggara/Moluccas,
Sabah/Sarawak, Stewart/Chatham e ilhas subantárticas neozelandesas.

Há **114 compound shapes e 2.452 partes poligonais**. Pequenos arquipélagos e
extratos offshore deliberadamente agregados podem compartilhar um holding isolado;
essa agregação estratégica não concede uma rota a outro holding. Partes grandes que
permitiriam um salto mainland–island, como Bioko e ilhas de PNG, possuem províncias
separadas. O número de landmasses refere-se a componentes do grafo de routing;
o audit também conta e valida as partes físicas dentro dos compounds.

Foram acrescentados 113 contatos terrestres explícitos, revisados e versionados
em `completeness/topology.ts`. Os geradores não produzem neighbors. Fronteiras
continentais de Moldova, Slovakia, Balkans, África e Gulf states são preservadas.
Northern Ireland conecta a Ireland; Kaliningrad conecta POL/LTU sem atalho para
a Rússia continental; Kalimantan/Sabah/Sarawak/Brunei compartilham Borneo;
PNG mainland toca somente Indonesian Papua. Nenhuma ligação marítima foi criada.
O audit mantém o limite anterior de overlap de 0,05 unidades SVG²; o máximo observado
é **0,0315197881**, uma pequena sliver de arredondamento MRT/ESH.

## Antimeridiano

`split_antimeridian` desembrulha cada anel, alinha holes ao exterior, corta nas
janelas de 360° e normaliza os fragmentos para [-180°, 180°]. A projeção continua
`x=(longitude+180)*14`, `y=(90-latitude)*14`. Fragmentos aparecem nas bordas corretas,
sem segmentos atravessando o mapa inteiro. Wrangel usa um compound com seus dois
fragmentos de borda. O fragmento oriental de Chukotka permanece intencionalmente
isolado no grafo, pois este passo não introduz uma conexão lógica pela seam.

## Decisões especiais e limitações

TWN, PSE e ESH são entidades de gameplay explícitas; XKX é uma tag interna do cenário,
não apresentada como ISO oficial. Essas representações e os owners territoriais
expressam decisões do cenário, não reconhecimento ou soberania do mundo real.
PSE possui West Bank e Gaza separadas. Crimea é um holding UKR explícito neste cenário,
em vez de herdar silenciosamente o owner do polígono russo da fonte.
COK/NIU são jogáveis. GUF mantém a representação técnica preexistente.

Antarctica é DEFERRED_WITH_REASON: não há capital nacional habitada ou gameplay
adequado para essa área neste cenário; não foi criado um exército antártico.
O backlog também registra explicitamente: representação de Northern Cyprus e de
Akrotiri/Dhekelia; bases militares sem sistema próprio; artefato PRK de área zero;
detalhe coarse de Oecusse; fus?es insulares preexistentes da fonte CORE, como Kyushu/Honshu, cuja separa??o exige reparticionar o pol?gono e os holdings de routing; fragmentos offshore abaixo do filtro da fonte;
contato terrestre de Macao e contato direto Gaza/Egypt com pequena separação
cartográfica entre as fontes. Macao permanece um holding CHN isolado; Gaza conecta
via ISR. Esses contatos não receberam bridges ou tolerâncias de auditoria maiores.

Labels de microterritórios não precisam ser legíveis no overview. Shapes preservam
eventos de clique/hover em zoom adequado; os testes verificam tooltip, nomes amigáveis,
markers de capitais, zoom, pan, reset e ausência de IDs internos no texto visível.
Renderização medida abaixo é SSR local; não equivale a FPS ou rasterização GPU
em um browser real. Saves seguem **Save V3 / mapId world-v1**, com roster anterior
incompatível e sem migração.

**World Map Horizontal Wrap V1** fica somente para avaliação futura junto de Naval
Warfare: continuidade horizontal, antimeridiano lógico, navegação no Pacífico e
possível câmera contínua. Naval/Air Warfare, sea zones, transporte naval, invasão
anfíbia, Battle System V3, Peace Conference, Espionage, sistema colonial completo,
Provinces V2 e migração não foram implementados.

## Performance e validação

O benchmark reproduz o CORE 128/274 e a composição 201/494 no mesmo processo, com
três warmups e medianas de dez amostras (30 ticks: uma amostra após warmups).
O custo dos pares diplomáticos cresce de 8.128 para 20.100; o custo foi medido,
sem reescrever os sistemas ou alterar timeouts.

Otimizações pequenas e equivalentes: comparação direta de pares em `updateRelation`;
scans táticos de IA limitados aos pares do bot, depois de preparar logística global;
índice de relações limitado aos visitantes cuja rede foi solicitada; snapshots de
logística de combate/recovery limitados a owners de exércitos; membership de comércio
indexada por tick e descarte antecipado de parceiros sem volume/budget mínimo.
Arredondamento de volume, clamping, primeira linha de pares duplicados, ordem de
registros e fórmulas permanecem iguais. Testes verificam equivalência de membership
e snapshots escopados sob peace/access/war.

As tabelas finais, o resultado da suíte e a lista de arquivos seguem abaixo.


| Mediana local (ms) | CORE 128/274 com otimiza??es atuais | Mundo 201/494 |
| --- | ---: | ---: |
| Diplomacy initialization | 3,766 | 8,739 |
| Declare war | 41,326 | 211,813 |
| Log?stica ? todos os Countries | 9,087 | 23,940 |
| Log?stica ? dois Countries | 0,583 | 0,944 |
| Economy tick com ex?rcitos nacionais | 36,422 | 70,412 |
| 30 economy ticks sequenciais com ex?rcitos | 907,430 | 1.968,852 |
| Movement tick | 9,330 | 23,781 |
| Rodada t?tica de todos os bots | 23,538 | 75,475 |
| Render SVG via React SSR | 12,761 | 24,328 |

A rodada t?tica do mundo ampliado antes do filtro de pares levava aproximadamente
2.773 ms; depois ficou em cerca de 75?77 ms. Cen?rios de guerra passaram de ~3,3 s
para ~0,5?0,6 s em execu??o direcionada ap?s eliminar aloca??es JSON repetidas.
O teste de 30 ticks sem ex?rcitos passou em **4.331,79 ms na su?te completa**;
recovery n?o constr?i redes de Countries sem ex?rcitos. Esses n?meros dependem da
m?quina/carga e n?o s?o thresholds alterados. Configura??o de workers e timeout de
5 s permaneceram iguais.

Valida??o final:

- `npm run lint`: passou sem warnings.
- `npm run typecheck`: passou.
- `npm run test:run -- --reporter=json --outputFile=test-step3b-results.json`: **1.619 testes passaram, 64 arquivos**, zero falhas; +204 testes em rela??o aos 1.415 anteriores (193 na su?te 3B e 11 casos adicionais de UI).
- `npm run build`: passou em 2,09 s; bundle JS 2.295,63 kB / gzip 806,73 kB. O Vite mant?m seu aviso de chunk >500 kB; limite n?o foi aumentado. A geometria extra tem custo de download/parse, ainda sem code splitting espec?fico.
- Todos os sete geradores: passaram; regi?es CORE 56/35/56/49/70/8 e 220 shapes suplementares.
- `python tools/map/test_world_projection.py`: **5 testes passaram** (ring cruzando seam, hole alinhado, geometria comum, idempot?ncia e bounds).
- `python tools/map/audit_world.py`: passou com os n?meros acima, owners/tags/IDs ?nicos, centros internos, bounds, partes compound e contatos reais.
- `git diff --check`: passou.
- Diff de c?digo, testes, documenta??o e extracts revisado; sem altera??o de save/schema, f?rmulas de War Resolution ou sistemas fora de escopo.

Os testes cobrem o checklist pol?tico inteiro, capitais/owners, recruitment,
initial armies, mercados, population e valores finitos; routing continental e
barreiras insulares; holdings cross-region; antimeridiano; preserva??o dos validadores;
log?stica/domestic trade; diplomacy, AI e guerras reais; shapes/click/tooltip/labels,
army markers e controles do mapa. As su?tes anteriores de Step 1/2/3A, Movement
Commands V2, Terrain V1, Logistics V2, Diplomacy V2, War Resolution, Rebellion V2 e
Combat V2 continuam na execu??o completa.

## Countries adicionados

Tags s?o est?veis do cen?rio. XKX ? interno; esta tabela n?o afirma reconhecimento pol?tico.

| Regi?o | Tag | Nome no cen?rio | Prov?ncia-capital |
| --- | --- | --- | --- |
| africa | ESH | Western Sahara | af_esh_territory |
| africa | BDI | Burundi | af_bdi_territory |
| africa | COM | Comoros | af_com_territory |
| africa | DJI | Djibouti | af_dji_territory |
| africa | MWI | Malawi | af_mwi_territory |
| africa | MUS | Mauritius | af_mus_territory |
| africa | RWA | Rwanda | af_rwa_territory |
| africa | SYC | Seychelles | af_syc_territory |
| africa | SSD | South Sudan | af_ssd_territory |
| africa | GNQ | Equatorial Guinea | af_gnq_bioko |
| africa | GAB | Gabon | af_gab_territory |
| africa | STP | Sao Tome and Principe | af_stp_territory |
| africa | SWZ | Eswatini | af_swz_territory |
| africa | LSO | Lesotho | af_lso_territory |
| africa | BEN | Benin | af_ben_territory |
| africa | CPV | Cabo Verde | af_cpv_territory |
| africa | GMB | Gambia | af_gmb_territory |
| africa | GNB | Guinea-Bissau | af_gnb_territory |
| africa | LBR | Liberia | af_lbr_territory |
| africa | SLE | Sierra Leone | af_sle_territory |
| africa | TGO | Togo | af_tgo_territory |
| europe | MDA | Republic of Moldova | eu_mda_territory |
| europe | SVK | Slovakia | eu_svk_territory |
| europe | ISL | Iceland | eu_isl_territory |
| europe | ALB | Albania | eu_alb_territory |
| europe | AND | Andorra | eu_and_territory |
| europe | BIH | Bosnia and Herzegovina | eu_bih_territory |
| europe | VAT | Holy See | eu_vat_territory |
| europe | MLT | Malta | eu_mlt_territory |
| europe | MNE | Montenegro | eu_mne_territory |
| europe | MKD | North Macedonia | eu_mkd_territory |
| europe | SMR | San Marino | eu_smr_territory |
| europe | SVN | Slovenia | eu_svn_territory |
| europe | LIE | Liechtenstein | eu_lie_territory |
| europe | LUX | Luxembourg | eu_lux_territory |
| europe | MCO | Monaco | eu_mco_territory |
| northAmerica | ATG | Antigua and Barbuda | na_atg_territory |
| northAmerica | BHS | Bahamas | na_bhs_territory |
| northAmerica | BRB | Barbados | na_brb_territory |
| northAmerica | DMA | Dominica | na_dma_territory |
| northAmerica | GRD | Grenada | na_grd_territory |
| northAmerica | KNA | Saint Kitts and Nevis | na_kna_territory |
| northAmerica | LCA | Saint Lucia | na_lca_territory |
| northAmerica | VCT | Saint Vincent and the Grenadines | na_vct_territory |
| northAmerica | TTO | Trinidad and Tobago | na_tto_territory |
| asia | BRN | Brunei Darussalam | as_brn_territory |
| asia | SGP | Singapore | as_sgp_territory |
| asia | TLS | Timor-Leste | as_tls_territory |
| asia | BTN | Bhutan | as_btn_territory |
| asia | MDV | Maldives | as_mdv_territory |
| asia | BHR | Bahrain | as_bhr_territory |
| asia | CYP | Cyprus | as_cyp_territory |
| asia | KWT | Kuwait | as_kwt_territory |
| asia | LBN | Lebanon | as_lbn_territory |
| asia | QAT | Qatar | as_qat_territory |
| asia | PSE | State of Palestine | as_pse_territory |
| asia | ARE | United Arab Emirates | as_are_territory |
| oceania | FJI | Fiji | oc_fji_territory |
| oceania | PNG | Papua New Guinea | oc_png_territory |
| oceania | SLB | Solomon Islands | oc_slb_territory |
| oceania | VUT | Vanuatu | oc_vut_territory |
| oceania | KIR | Kiribati | oc_kir_territory |
| oceania | MHL | Marshall Islands | oc_mhl_territory |
| oceania | FSM | Micronesia (Federated States of) | oc_fsm_territory |
| oceania | NRU | Naoero | oc_nru_territory |
| oceania | PLW | Palau | oc_plw_territory |
| oceania | COK | Cook Islands | oc_cok_territory |
| oceania | NIU | Niue | oc_niu_territory |
| oceania | WSM | Samoa | oc_wsm_territory |
| oceania | TON | Tonga | oc_ton_territory |
| oceania | TUV | Tuvalu | oc_tuv_territory |
| asia | TWN | Taiwan | as_twn_territory |
| europe | XKX | Kosovo | eu_xkx_territory |

## Depend?ncias e territ?rios agregados

Cada linha corresponde a uma das 48 entradas AGGREGATED do invent?rio M49. N?o cria Country nem capital nacional.

| Territ?rio | Nome | Owner do cen?rio | Regi?o |
| --- | --- | --- | --- |
| IOT | British Indian Ocean Territory | GBR | africa |
| ATF | French Southern Territories | FRA | africa |
| MYT | Mayotte | FRA | africa |
| REU | Réunion | FRA | africa |
| SHN | Saint Helena | GBR | africa |
| ALA | Åland Islands | FIN | europe |
| FRO | Faroe Islands | DNK | europe |
| GGY | Guernsey | GBR | europe |
| IMN | Isle of Man | GBR | europe |
| JEY | Jersey | GBR | europe |
| SJM | Svalbard and Jan Mayen Islands | NOR | europe |
| GIB | Gibraltar | GBR | europe |
| AIA | Anguilla | GBR | northAmerica |
| ABW | Aruba | NLD | northAmerica |
| BES | Bonaire, Sint Eustatius and Saba | NLD | northAmerica |
| VGB | British Virgin Islands | GBR | northAmerica |
| CYM | Cayman Islands | GBR | northAmerica |
| CUW | Curaçao | NLD | northAmerica |
| GLP | Guadeloupe | FRA | northAmerica |
| MTQ | Martinique | FRA | northAmerica |
| MSR | Montserrat | GBR | northAmerica |
| PRI | Puerto Rico | USA | northAmerica |
| BLM | Saint Barthélemy | FRA | northAmerica |
| MAF | Saint Martin (French Part) | FRA | northAmerica |
| SXM | Sint Maarten (Dutch part) | NLD | northAmerica |
| TCA | Turks and Caicos Islands | GBR | northAmerica |
| VIR | United States Virgin Islands | USA | northAmerica |
| BVT | Bouvet Island | NOR | northAmerica |
| FLK | Falkland Islands (Malvinas) | GBR | northAmerica |
| SGS | South Georgia and the South Sandwich Islands | GBR | northAmerica |
| BMU | Bermuda | GBR | northAmerica |
| GRL | Greenland | DNK | northAmerica |
| SPM | Saint Pierre and Miquelon | FRA | northAmerica |
| HKG | China, Hong Kong Special Administrative Region | CHN | asia |
| MAC | China, Macao Special Administrative Region | CHN | asia |
| CXR | Christmas Island | AUS | oceania |
| CCK | Cocos (Keeling) Islands | AUS | oceania |
| HMD | Heard Island and McDonald Islands | AUS | oceania |
| NFK | Norfolk Island | AUS | oceania |
| NCL | New Caledonia | FRA | oceania |
| GUM | Guam | USA | oceania |
| MNP | Northern Mariana Islands | USA | oceania |
| UMI | United States Minor Outlying Islands | USA | oceania |
| ASM | American Samoa | USA | oceania |
| PYF | French Polynesia | FRA | oceania |
| PCN | Pitcairn | GBR | oceania |
| TKL | Tokelau | NZL | oceania |
| WLF | Wallis and Futuna Islands | FRA | oceania |

## Prov?ncias adicionadas

Lista completa das 220 prov?ncias, incluindo novas capitais, depend?ncias e partes recuperadas. Os IDs abaixo s?o de autoria/documenta??o e n?o s?o expostos como labels na UI.

| ID | Nome | Owner | Fonte |
| --- | --- | --- | --- |
| af_esh_territory | Laayoune | ESH | 110m |
| af_iot_territory | British Indian Ocean Territory | GBR | 10m |
| af_bdi_territory | Gitega | BDI | 110m |
| af_com_territory | Moroni | COM | 10m |
| af_dji_territory | Djibouti | DJI | 110m |
| af_atf_territory | French Southern Territories | FRA | 110m |
| af_mwi_territory | Lilongwe | MWI | 110m |
| af_mus_territory | Port Louis | MUS | 10m |
| af_myt_territory | Mayotte | FRA | 10m |
| af_reu_territory | Réunion | FRA | 10m |
| af_rwa_territory | Kigali | RWA | 110m |
| af_syc_territory | Victoria | SYC | 10m |
| af_ssd_territory | Juba | SSD | 10m |
| af_gnq_territory | Malabo | GNQ | 110m |
| af_gab_territory | Libreville | GAB | 110m |
| af_stp_territory | Sao Tome | STP | 10m |
| af_swz_territory | Mbabane | SWZ | 110m |
| af_lso_territory | Maseru | LSO | 110m |
| af_ben_territory | Porto-Novo | BEN | 110m |
| af_cpv_territory | Praia | CPV | 10m |
| af_gmb_territory | Banjul | GMB | 110m |
| af_gnb_territory | Bissau | GNB | 110m |
| af_lbr_territory | Monrovia | LBR | 110m |
| af_shn_territory | Saint Helena | GBR | 10m |
| af_sle_territory | Freetown | SLE | 110m |
| af_tgo_territory | Lome | TGO | 110m |
| eu_mda_territory | Chisinau | MDA | 110m |
| eu_svk_territory | Bratislava | SVK | 110m |
| eu_ala_territory | Åland Islands | FIN | 10m |
| eu_fro_territory | Faroe Islands | DNK | 10m |
| eu_ggy_territory | Guernsey | GBR | 10m |
| eu_isl_territory | Reykjavik | ISL | 110m |
| eu_imn_territory | Isle of Man | GBR | 10m |
| eu_jey_territory | Jersey | GBR | 10m |
| eu_sjm_territory | Svalbard and Jan Mayen Islands | NOR | 110m |
| eu_alb_territory | Tirana | ALB | 110m |
| eu_and_territory | Andorra la Vella | AND | 10m |
| eu_bih_territory | Sarajevo | BIH | 110m |
| eu_gib_territory | Gibraltar | GBR | 10m |
| eu_vat_territory | Vatican City | VAT | 10m |
| eu_mlt_territory | Valletta | MLT | 10m |
| eu_mne_territory | Podgorica | MNE | 110m |
| eu_mkd_territory | Skopje | MKD | 110m |
| eu_smr_territory | San Marino | SMR | 10m |
| eu_svn_territory | Ljubljana | SVN | 110m |
| eu_lie_territory | Vaduz | LIE | 10m |
| eu_lux_territory | Luxembourg | LUX | 110m |
| eu_mco_territory | Monaco | MCO | 10m |
| na_aia_territory | Anguilla | GBR | 10m |
| na_atg_territory | Saint Johns | ATG | 10m |
| na_abw_territory | Aruba | NLD | 10m |
| na_bhs_territory | Nassau | BHS | 110m |
| na_brb_territory | Bridgetown | BRB | 10m |
| na_bes_territory | Bonaire, Sint Eustatius and Saba | NLD | 10m |
| na_vgb_territory | British Virgin Islands | GBR | 10m |
| na_cym_territory | Cayman Islands | GBR | 10m |
| na_cuw_territory | Curaçao | NLD | 10m |
| na_dma_territory | Roseau | DMA | 10m |
| na_grd_territory | Saint Georges | GRD | 10m |
| na_glp_territory | Guadeloupe | FRA | 10m |
| na_mtq_territory | Martinique | FRA | 10m |
| na_msr_territory | Montserrat | GBR | 10m |
| na_pri_territory | Puerto Rico | USA | 110m |
| na_blm_territory | Saint Barthélemy | FRA | 10m |
| na_kna_territory | Basseterre | KNA | 10m |
| na_lca_territory | Castries | LCA | 10m |
| na_maf_territory | Saint Martin (French Part) | FRA | 10m |
| na_vct_territory | Kingstown | VCT | 10m |
| na_sxm_territory | Sint Maarten (Dutch part) | NLD | 10m |
| na_tto_territory | Port of Spain | TTO | 110m |
| na_tca_territory | Turks and Caicos Islands | GBR | 10m |
| na_vir_territory | United States Virgin Islands | USA | 10m |
| na_bvt_territory | Bouvet Island | NOR | 10m |
| na_flk_territory | Falkland Islands (Malvinas) | GBR | 110m |
| na_sgs_territory | South Georgia and the South Sandwich Islands | GBR | 10m |
| na_bmu_territory | Bermuda | GBR | 10m |
| na_grl_territory | Greenland | DNK | 110m |
| na_spm_territory | Saint Pierre and Miquelon | FRA | 10m |
| as_hkg_territory | China, Hong Kong Special Administrative Region | CHN | 10m |
| as_mac_territory | China, Macao Special Administrative Region | CHN | 10m |
| as_brn_territory | Bandar Seri Begawan | BRN | 110m |
| as_sgp_territory | Singapore | SGP | 10m |
| as_tls_territory | Dili | TLS | 110m |
| as_btn_territory | Thimphu | BTN | 110m |
| as_mdv_territory | Male | MDV | 10m |
| as_bhr_territory | Manama | BHR | 10m |
| as_cyp_territory | Nicosia | CYP | 110m |
| as_kwt_territory | Kuwait City | KWT | 110m |
| as_lbn_territory | Beirut | LBN | 110m |
| as_qat_territory | Doha | QAT | 110m |
| as_pse_territory | Ramallah | PSE | 110m |
| as_are_territory | Abu Dhabi | ARE | 110m |
| oc_cxr_territory | Christmas Island | AUS | 10m |
| oc_cck_territory | Cocos (Keeling) Islands | AUS | 10m |
| oc_hmd_territory | Heard Island and McDonald Islands | AUS | 10m |
| oc_nfk_territory | Norfolk Island | AUS | 10m |
| oc_fji_territory | Suva | FJI | 110m |
| oc_ncl_territory | New Caledonia | FRA | 110m |
| oc_png_territory | Port Moresby | PNG | 110m |
| oc_slb_territory | Honiara | SLB | 110m |
| oc_vut_territory | Port Vila | VUT | 110m |
| oc_gum_territory | Guam | USA | 10m |
| oc_kir_territory | South Tarawa | KIR | 10m |
| oc_mhl_territory | Majuro | MHL | 10m |
| oc_fsm_territory | Palikir | FSM | 10m |
| oc_nru_territory | Yaren | NRU | 10m |
| oc_mnp_territory | Northern Mariana Islands | USA | 10m |
| oc_plw_territory | Ngerulmud | PLW | 10m |
| oc_umi_territory | United States Minor Outlying Islands | USA | 10m |
| oc_asm_territory | American Samoa | USA | 10m |
| oc_cok_territory | Avarua | COK | 10m |
| oc_pyf_territory | French Polynesia | FRA | 10m |
| oc_niu_territory | Alofi | NIU | 10m |
| oc_pcn_territory | Pitcairn | GBR | 10m |
| oc_wsm_territory | Apia | WSM | 10m |
| oc_tkl_territory | Tokelau | NZL | 10m |
| oc_ton_territory | Nuku alofa | TON | 10m |
| oc_tuv_territory | Funafuti | TUV | 10m |
| oc_wlf_territory | Wallis and Futuna Islands | FRA | 10m |
| as_twn_territory | Taipei | TWN | 110m |
| eu_xkx_territory | Pristina | XKX | 110m |
| sa_arg_restored_1 | Tierra del Fuego (Argentina) | ARG | 110m |
| sa_chl_restored_1 | Tierra del Fuego (Chile) | CHL | 110m |
| na_can_restored_7 | Newfoundland | CAN | 110m |
| na_can_restored_14 | Vancouver Island | CAN | 110m |
| na_can_restored_22 | Haida Gwaii | CAN | 110m |
| na_can_restored_25 | Anticosti Island | CAN | 110m |
| na_can_restored_26 | Cape Breton Island | CAN | 110m |
| na_usa_restored_1 | Alaska | USA | 110m |
| na_usa_restored_2 | Kodiak Island | USA | 110m |
| na_usa_restored_3 | Saint Lawrence Island | USA | 110m |
| na_usa_restored_5 | Nunivak Island | USA | 110m |
| eu_fra_restored_1 | Corsica | FRA | 110m |
| eu_gbr_restored_1 | Northern Ireland | GBR | 110m |
| eu_ita_restored_1 | Sicily | ITA | 110m |
| eu_ita_restored_2 | Sardinia | ITA | 110m |
| eu_grc_restored_1 | Crete | GRC | 110m |
| af_ago_restored_1 | Cabinda | AGO | 110m |
| as_rus_restored_1 | Novaya Zemlya | RUS | 110m |
| as_rus_restored_2 | Eastern Chukotka | RUS | 110m |
| as_rus_restored_3 | Severnaya Zemlya | RUS | 110m |
| as_rus_restored_4 | Sakhalin | RUS | 110m |
| as_rus_restored_5 | New Siberian Islands | RUS | 110m |
| as_rus_restored_6 | Bolshevik Island | RUS | 110m |
| eu_ukr_crimea | Crimea | UKR | 110m |
| as_rus_restored_8 | Franz Josef Land | RUS | 110m |
| as_rus_restored_9 | Kaliningrad | RUS | 110m |
| as_rus_restored_10 | Faddeyevsky Island | RUS | 110m |
| as_rus_restored_11 | Lyakhovsky Islands | RUS | 110m |
| as_aze_restored_1 | Nakhchivan | AZE | 110m |
| as_omn_restored_1 | Musandam | OMN | 110m |
| as_chn_restored_1 | Hainan | CHN | 110m |
| as_jpn_restored_1 | Hokkaido | JPN | 110m |
| as_jpn_restored_2 | Shikoku | JPN | 110m |
| as_mys_restored_1 | Sabah and Sarawak | MYS | 110m |
| as_idn_restored_1 | Kalimantan | IDN | 110m |
| as_idn_restored_2 | Indonesian Papua | IDN | 110m |
| as_idn_restored_3 | Sulawesi | IDN | 110m |
| as_idn_restored_4 | Halmahera | IDN | 110m |
| as_idn_restored_5 | Seram | IDN | 110m |
| as_idn_restored_6 | Flores | IDN | 110m |
| as_idn_restored_7 | West Timor | IDN | 110m |
| as_idn_restored_8 | Sumbawa | IDN | 110m |
| as_idn_restored_9 | Sumba | IDN | 110m |
| as_idn_restored_10 | Buru | IDN | 110m |
| as_idn_restored_11 | Aru Islands | IDN | 110m |
| as_phl_restored_1 | Mindanao | PHL | 110m |
| as_phl_restored_2 | Samar and Leyte | PHL | 110m |
| as_phl_restored_3 | Cebu and Bohol | PHL | 110m |
| as_phl_restored_4 | Palawan | PHL | 110m |
| as_phl_restored_5 | Panay | PHL | 110m |
| as_phl_restored_6 | Mindoro | PHL | 110m |
| oc_aus_restored_1 | Tasmania | AUS | 110m |
| na_can_arctic_archipelago | Canadian Arctic Archipelago | CAN | 110m |
| na_usa_hawaii | Hawaii | USA | 110m |
| as_rus_wrangel | Wrangel Island | RUS | 110m |
| oc_png_detached | Papua New Guinea offshore islands | PNG | 110m |
| af_gnq_bioko | Malabo (Bioko and Annobon) | GNQ | 10m |
| as_pse_gaza | Gaza | PSE | 10m |
| eu_prt_atlantic_islands | Azores and Madeira | PRT | 10m |
| eu_esp_atlantic_islands | Canary Islands | ESP | 10m |
| eu_esp_balearic_islands | Balearic Islands | ESP | 10m |
| sa_ecu_galapagos | Galapagos | ECU | 10m |
| af_tza_zanzibar | Zanzibar | TZA | 10m |
| as_jpn_ryukyu | Okinawa and Ryukyu | JPN | 10m |
| as_idn_bali | Bali and Lombok | IDN | 10m |
| oc_nzl_stewart | Stewart Island | NZL | 10m |
| oc_nzl_chatham | Chatham Islands | NZL | 10m |
| oc_nzl_subantarctic | New Zealand Subantarctic Islands | NZL | 10m |
| na_mex_offshore | Mexican Offshore Islands | MEX | 10m |
| eu_dnk_offshore | Danish Offshore Islands | DNK | 10m |
| eu_swe_offshore | Swedish Offshore Islands | SWE | 10m |
| oc_png_offshore | Papua New Guinea Offshore Islands | PNG | 10m |
| sa_arg_offshore_islands | Argentina - Offshore Islands | ARG | 10m |
| sa_chl_offshore_islands | Chile - Offshore Islands | CHL | 10m |
| sa_ecu_offshore_islands | Equador - Offshore Islands | ECU | 10m |
| sa_col_offshore_islands | Colômbia - Offshore Islands | COL | 10m |
| sa_ven_offshore_islands | Venezuela - Offshore Islands | VEN | 10m |
| na_can_offshore_islands | Offshore Islands | CAN | 10m |
| na_usa_offshore_islands | Offshore Islands | USA | 10m |
| na_mex_offshore_islands | Offshore Islands | MEX | 10m |
| na_blz_offshore_islands | Offshore Islands | BLZ | 10m |
| na_hnd_offshore_islands | Offshore Islands | HND | 10m |
| na_slv_offshore_islands | Offshore Islands | SLV | 10m |
| na_nic_offshore_islands | Offshore Islands | NIC | 10m |
| na_cri_offshore_islands | Offshore Islands | CRI | 10m |
| na_pan_offshore_islands | Offshore Islands | PAN | 10m |
| eu_nor_offshore_islands | Noruega - Offshore Islands | NOR | 10m |
| eu_fin_offshore_islands | Finlândia - Offshore Islands | FIN | 10m |
| eu_grc_offshore_islands | Grécia - Offshore Islands | GRC | 10m |
| eu_esp_offshore_islands | Espanha - Offshore Islands | ESP | 10m |
| eu_gbr_offshore_islands | Reino Unido - Offshore Islands | GBR | 10m |
| af_mdg_offshore_islands | Madagascar - Offshore Islands | MDG | 10m |
| af_tza_offshore_islands | Tanzânia - Offshore Islands | TZA | 10m |
| as_jpn_offshore_islands | Japão - Offshore Islands | JPN | 10m |
| as_idn_offshore_islands | Indonésia - Offshore Islands | IDN | 10m |
| as_phl_offshore_islands | Filipinas - Offshore Islands | PHL | 10m |
| as_mys_offshore_islands | Malásia - Offshore Islands | MYS | 10m |
| as_rus_offshore_islands | Rússia - Offshore Islands | RUS | 10m |
| oc_nzl_offshore_islands | Nova Zelândia - Offshore Islands | NZL | 10m |

## Arquivos criados

- `docs/world-map-expansion-v1-step-3b.md`
- `src/data/map/completeness/index.ts`
- `src/data/map/completeness/definitions.ts`
- `src/data/map/completeness/geometry.ts`
- `src/data/map/completeness/topology.ts`
- `src/engine/__tests__/worldMapStep3b.test.ts`
- `tools/map/completeness.extract.json`
- `tools/map/generate_completeness.py`
- `tools/map/benchmark_world.mjs`
- `tools/map/test_world_projection.py`

## Arquivos alterados

- `docs/world-map-completeness-backlog.md`
- `src/data/map/index.ts`
- `src/data/map/regions/asia/geometry.ts`
- `src/data/map/regions/europe/geometry.ts`
- `src/data/map/types.ts`
- `src/engine/__tests__/internalPoliticsV1.test.ts`
- `src/engine/__tests__/mapTopology.test.ts`
- `src/engine/__tests__/southAmerica.test.ts`
- `src/engine/__tests__/southAmericaRendering.test.tsx`
- `src/engine/__tests__/terrainV1.test.tsx`
- `src/engine/__tests__/worldMap.test.ts`
- `src/engine/__tests__/worldMapRendering.test.tsx`
- `src/engine/__tests__/worldMapStep2.test.ts`
- `src/engine/__tests__/worldMapStep3a.test.ts`
- `src/engine/aiEngine/aiMovement.ts`
- `src/engine/diplomacy/diplomacyRelations.ts`
- `src/engine/economy/internationalTrade.ts`
- `src/engine/logistics/index.ts`
- `src/hooks/gameLoop/battleContinuousTick.ts`
- `src/hooks/gameLoop/economyTick.ts`
- `tools/map/README.md`
- `tools/map/asia.outlines.json`
- `tools/map/audit_world.py`
- `tools/map/europe.outlines.json`
- `tools/map/export_audit.mjs`
- `tools/map/generate_south_america.py`
- `tools/map/world_projection.py`
