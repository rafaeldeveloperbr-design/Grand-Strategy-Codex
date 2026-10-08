# World Map Completeness Backlog — Passo 3B

**Current delivery: all original entries have an explicit decision. Historical planning text is retained below.**

**Original planning status:  dívida funcional planejada e obrigatória.** O Passo 3A é CORE, não a conclusão do mundo. Cada entrada precisa de implementação ou de decisão explícita/documentada de agregação antes de encerrar o Passo 3B. Não preencher lacunas com pontes marítimas ou território atribuído silenciosamente a vizinhos.

O inventário compara os 128 tags ativos com os 248 países/áreas da referência [UN M49](https://unstats.un.org/unsd/methodology/m49/overview/) em 07/10/2026: **120 áreas ausentes**, enumeradas abaixo. Nomes e sub-regiões da referência são preservados. Taiwan e Kosovo são pendências adicionais explícitas. Classificação geográfica não decide reconhecimento, soberania ou reivindicações do jogo.

## Pendências adicionais de representação política

- IMPLEMENTED - Taiwan (TWN): representação própria pendente; não agregada implicitamente ao roster CHN.
- IMPLEMENTED - Kosovo: definir ID estável do cenário; XKX não deve ser apresentado como código ISO oficial.
- IMPLEMENTED - Chipre consta da Ásia na referência, mas também precisa de revisão no fechamento europeu.
- IMPLEMENTED - Palestina e Saara Ocidental constam das tabelas: definir gameplay explicitamente, sem inferir reivindicações.

## Microestados

Andorra, Liechtenstein, Mônaco, San Marino e Vaticano/Santa Sé continuam pendentes. Luxemburgo e Malta também precisam de inclusão. Países sem geometria adequada em Natural Earth 1:110m exigirão fonte vetorial de resolução maior, preservando a projeção; não desenhar SVG manualmente.

## Ilhas secundárias

Mesmo países já presentes possuem lacunas geométricas:

- América do Norte: Alasca, Havaí, arquipélago ártico canadense, Terra Nova e ilhas costeiras mexicanas/centro-americanas.
- América do Sul: Terra do Fogo chilena/argentina, demais ilhas austrais, Galápagos e ilhas costeiras.
- Europa: Açores/Madeira, Canárias/Baleares, Córsega, Sicília/Sardenha, Creta/Egeu, Irlanda do Norte e ilhas dinamarquesas/escandinavas.
- Rússia: Kaliningrado, fragmento de Chukotka além do antimeridiano, Sacalina, Curilas e arquipélagos árticos. Sem Kaliningrado real, não criar ligação Lituânia–Rússia.
- África: Cabinda, Zanzibar, ilhas secundárias de Madagascar e ilhas costeiras; Bioko após incluir Guiné Equatorial.
- Leste Asiático: Hainan, Hokkaido, Shikoku e Okinawa/Ryukyu; revisar fusões coarse de ilhas na fonte 1:110m.
- Sudeste Asiático: Sabah/Sarawak; Bornéu, Sulawesi, Papua, Bali, Nusa Tenggara/Molucas; Mindanao, Visayas, Palawan e demais Filipinas. Java/Sumatra e Luzon são somente CORE.
- Oceania: Tasmânia, Stewart/Chatham, ilhas subantárticas neozelandesas e demais estados/áreas insulares da tabela.

## Territórios ultramarinos

As tabelas enumeram todas as dependências ISO/M49 ausentes, incluindo áreas britânicas, francesas, neerlandesas, americanas, australianas e neozelandesas. Guiana Francesa já possui GUF. Revisar também áreas sem tag ISO separado, como Akrotiri/Dhekelia e ilhas dispersas francesas. Distinguir dependência territorial de instalação/base militar.

## Critérios de entrega

1. Resolver todas as entradas e partes geométricas omitidas; documentar agregações aprovadas.
2. Manter IDs, assembleMap e projeção; usar fonte adequada para microestados/ilhas.
3. Validar capitais, terrain, gameplay, markets, logística, diplomacia e roster de save.
4. Revisar fronteiras reais e componentes intencionais; sem pontes falsas ou neighbors inexistentes.
5. Auditar bounds, centers, cobertura, overlap e contatos cross-region.
6. Documentar antimeridiano, disputas e ilhas desconectadas.
7. Rodar lint, typecheck, testes, build, audit e diff-check.

Naval Warfare V1 vem depois; ilhas continuam sem acesso terrestre. Battle System V3, Air Warfare e Peace Conference permanecem fora deste passo.


## África faltante

| Código | País/território pendente | Sub-região M49 | Status | Decision |
| --- | --- | --- | --- | --- |
| ESH | Western Sahara | Northern Africa | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| IOT | British Indian Ocean Territory | Sub-Saharan Africa | AGGREGATED | Province owned by GBR; no independent national army/diplomacy. |
| BDI | Burundi | Sub-Saharan Africa | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| COM | Comoros | Sub-Saharan Africa | IMPLEMENTED | Scenario gameplay entity; source vector shape, strategic province. |
| DJI | Djibouti | Sub-Saharan Africa | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| ATF | French Southern Territories | Sub-Saharan Africa | AGGREGATED | Province owned by FRA; no independent national army/diplomacy. |
| MWI | Malawi | Sub-Saharan Africa | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| MUS | Mauritius | Sub-Saharan Africa | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| MYT | Mayotte | Sub-Saharan Africa | AGGREGATED | Province owned by FRA; no independent national army/diplomacy. |
| REU | Réunion | Sub-Saharan Africa | AGGREGATED | Province owned by FRA; no independent national army/diplomacy. |
| RWA | Rwanda | Sub-Saharan Africa | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| SYC | Seychelles | Sub-Saharan Africa | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| SSD | South Sudan | Sub-Saharan Africa | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| GNQ | Equatorial Guinea | Sub-Saharan Africa | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| GAB | Gabon | Sub-Saharan Africa | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| STP | Sao Tome and Principe | Sub-Saharan Africa | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| SWZ | Eswatini | Sub-Saharan Africa | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| LSO | Lesotho | Sub-Saharan Africa | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| BEN | Benin | Sub-Saharan Africa | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| CPV | Cabo Verde | Sub-Saharan Africa | IMPLEMENTED | Scenario gameplay entity; source vector shape, strategic province. |
| GMB | Gambia | Sub-Saharan Africa | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| GNB | Guinea-Bissau | Sub-Saharan Africa | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| LBR | Liberia | Sub-Saharan Africa | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| SHN | Saint Helena | Sub-Saharan Africa | AGGREGATED | Province owned by GBR; no independent national army/diplomacy. |
| SLE | Sierra Leone | Sub-Saharan Africa | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| TGO | Togo | Sub-Saharan Africa | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |

## Europa faltante

| Código | País/território pendente | Sub-região M49 | Status | Decision |
| --- | --- | --- | --- | --- |
| MDA | Republic of Moldova | Eastern Europe | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| SVK | Slovakia | Eastern Europe | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| ALA | Åland Islands | Northern Europe | AGGREGATED | Province owned by FIN; no independent national army/diplomacy. |
| FRO | Faroe Islands | Northern Europe | AGGREGATED | Province owned by DNK; no independent national army/diplomacy. |
| GGY | Guernsey | Northern Europe | AGGREGATED | Province owned by GBR; no independent national army/diplomacy. |
| ISL | Iceland | Northern Europe | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| IMN | Isle of Man | Northern Europe | AGGREGATED | Province owned by GBR; no independent national army/diplomacy. |
| JEY | Jersey | Northern Europe | AGGREGATED | Province owned by GBR; no independent national army/diplomacy. |
| SJM | Svalbard and Jan Mayen Islands | Northern Europe | AGGREGATED | Province owned by NOR; no independent national army/diplomacy. |
| ALB | Albania | Southern Europe | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| AND | Andorra | Southern Europe | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| BIH | Bosnia and Herzegovina | Southern Europe | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| GIB | Gibraltar | Southern Europe | AGGREGATED | Province owned by GBR; no independent national army/diplomacy. |
| VAT | Holy See | Southern Europe | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| MLT | Malta | Southern Europe | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| MNE | Montenegro | Southern Europe | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| MKD | North Macedonia | Southern Europe | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| SMR | San Marino | Southern Europe | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| SVN | Slovenia | Southern Europe | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| LIE | Liechtenstein | Western Europe | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| LUX | Luxembourg | Western Europe | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| MCO | Monaco | Western Europe | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |

## Caribe e Américas faltantes

| Código | País/território pendente | Sub-região M49 | Status | Decision |
| --- | --- | --- | --- | --- |
| AIA | Anguilla | Latin America and the Caribbean | AGGREGATED | Province owned by GBR; no independent national army/diplomacy. |
| ATG | Antigua and Barbuda | Latin America and the Caribbean | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| ABW | Aruba | Latin America and the Caribbean | AGGREGATED | Province owned by NLD; no independent national army/diplomacy. |
| BHS | Bahamas | Latin America and the Caribbean | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| BRB | Barbados | Latin America and the Caribbean | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| BES | Bonaire, Sint Eustatius and Saba | Latin America and the Caribbean | AGGREGATED | Province owned by NLD; no independent national army/diplomacy. |
| VGB | British Virgin Islands | Latin America and the Caribbean | AGGREGATED | Province owned by GBR; no independent national army/diplomacy. |
| CYM | Cayman Islands | Latin America and the Caribbean | AGGREGATED | Province owned by GBR; no independent national army/diplomacy. |
| CUW | Curaçao | Latin America and the Caribbean | AGGREGATED | Province owned by NLD; no independent national army/diplomacy. |
| DMA | Dominica | Latin America and the Caribbean | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| GRD | Grenada | Latin America and the Caribbean | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| GLP | Guadeloupe | Latin America and the Caribbean | AGGREGATED | Province owned by FRA; no independent national army/diplomacy. |
| MTQ | Martinique | Latin America and the Caribbean | AGGREGATED | Province owned by FRA; no independent national army/diplomacy. |
| MSR | Montserrat | Latin America and the Caribbean | AGGREGATED | Province owned by GBR; no independent national army/diplomacy. |
| PRI | Puerto Rico | Latin America and the Caribbean | AGGREGATED | Province owned by USA; no independent national army/diplomacy. |
| BLM | Saint Barthélemy | Latin America and the Caribbean | AGGREGATED | Province owned by FRA; no independent national army/diplomacy. |
| KNA | Saint Kitts and Nevis | Latin America and the Caribbean | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| LCA | Saint Lucia | Latin America and the Caribbean | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| MAF | Saint Martin (French Part) | Latin America and the Caribbean | AGGREGATED | Province owned by FRA; no independent national army/diplomacy. |
| VCT | Saint Vincent and the Grenadines | Latin America and the Caribbean | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| SXM | Sint Maarten (Dutch part) | Latin America and the Caribbean | AGGREGATED | Province owned by NLD; no independent national army/diplomacy. |
| TTO | Trinidad and Tobago | Latin America and the Caribbean | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| TCA | Turks and Caicos Islands | Latin America and the Caribbean | AGGREGATED | Province owned by GBR; no independent national army/diplomacy. |
| VIR | United States Virgin Islands | Latin America and the Caribbean | AGGREGATED | Province owned by USA; no independent national army/diplomacy. |
| BVT | Bouvet Island | Latin America and the Caribbean | AGGREGATED | Province owned by NOR; no independent national army/diplomacy. |
| FLK | Falkland Islands (Malvinas) | Latin America and the Caribbean | AGGREGATED | Province owned by GBR; no independent national army/diplomacy. |
| SGS | South Georgia and the South Sandwich Islands | Latin America and the Caribbean | AGGREGATED | Province owned by GBR; no independent national army/diplomacy. |
| BMU | Bermuda | Northern America | AGGREGATED | Province owned by GBR; no independent national army/diplomacy. |
| GRL | Greenland | Northern America | AGGREGATED | Province owned by DNK; no independent national army/diplomacy. |
| SPM | Saint Pierre and Miquelon | Northern America | AGGREGATED | Province owned by FRA; no independent national army/diplomacy. |

## Ásia faltante

| Código | País/território pendente | Sub-região M49 | Status | Decision |
| --- | --- | --- | --- | --- |
| HKG | China, Hong Kong Special Administrative Region | Eastern Asia | AGGREGATED | Province owned by CHN; no independent national army/diplomacy. |
| MAC | China, Macao Special Administrative Region | Eastern Asia | AGGREGATED | Province owned by CHN; no independent national army/diplomacy. |
| BRN | Brunei Darussalam | South-eastern Asia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| SGP | Singapore | South-eastern Asia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| TLS | Timor-Leste | South-eastern Asia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| BTN | Bhutan | Southern Asia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| MDV | Maldives | Southern Asia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| BHR | Bahrain | Western Asia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| CYP | Cyprus | Western Asia | IMPLEMENTED | Scenario gameplay entity; source vector shape, strategic province. |
| KWT | Kuwait | Western Asia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| LBN | Lebanon | Western Asia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| QAT | Qatar | Western Asia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| PSE | State of Palestine | Western Asia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| ARE | United Arab Emirates | Western Asia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |

## Oceania faltante

| Código | País/território pendente | Sub-região M49 | Status | Decision |
| --- | --- | --- | --- | --- |
| CXR | Christmas Island | Australia and New Zealand | AGGREGATED | Province owned by AUS; no independent national army/diplomacy. |
| CCK | Cocos (Keeling) Islands | Australia and New Zealand | AGGREGATED | Province owned by AUS; no independent national army/diplomacy. |
| HMD | Heard Island and McDonald Islands | Australia and New Zealand | AGGREGATED | Province owned by AUS; no independent national army/diplomacy. |
| NFK | Norfolk Island | Australia and New Zealand | AGGREGATED | Province owned by AUS; no independent national army/diplomacy. |
| FJI | Fiji | Melanesia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| NCL | New Caledonia | Melanesia | AGGREGATED | Province owned by FRA; no independent national army/diplomacy. |
| PNG | Papua New Guinea | Melanesia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| SLB | Solomon Islands | Melanesia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| VUT | Vanuatu | Melanesia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| GUM | Guam | Micronesia | AGGREGATED | Province owned by USA; no independent national army/diplomacy. |
| KIR | Kiribati | Micronesia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| MHL | Marshall Islands | Micronesia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| FSM | Micronesia (Federated States of) | Micronesia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| NRU | Naoero | Micronesia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| MNP | Northern Mariana Islands | Micronesia | AGGREGATED | Province owned by USA; no independent national army/diplomacy. |
| PLW | Palau | Micronesia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| UMI | United States Minor Outlying Islands | Micronesia | AGGREGATED | Province owned by USA; no independent national army/diplomacy. |
| ASM | American Samoa | Polynesia | AGGREGATED | Province owned by USA; no independent national army/diplomacy. |
| COK | Cook Islands | Polynesia | IMPLEMENTED | Scenario gameplay entity; source vector shape, strategic province. |
| PYF | French Polynesia | Polynesia | AGGREGATED | Province owned by FRA; no independent national army/diplomacy. |
| NIU | Niue | Polynesia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| PCN | Pitcairn | Polynesia | AGGREGATED | Province owned by GBR; no independent national army/diplomacy. |
| WSM | Samoa | Polynesia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| TKL | Tokelau | Polynesia | AGGREGATED | Province owned by NZL; no independent national army/diplomacy. |
| TON | Tonga | Polynesia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| TUV | Tuvalu | Polynesia | IMPLEMENTED | Scenario gameplay entity; source vector shape, one strategic province. |
| WLF | Wallis and Futuna Islands | Polynesia | AGGREGATED | Province owned by FRA; no independent national army/diplomacy. |

## Antártida e áreas sem região M49

| Código | País/território pendente | Sub-região M49 | Status | Decision |
| --- | --- | --- | --- | --- |
| ATA | Antarctica | → | DEFERRED_WITH_REASON | Antarctica: no inhabited national gameplay/capital; outside terrestrial national scenario. |

## Inventário geométrico da fonte CORE

Partes Natural Earth 1:110m excluídas dos extratos atuais. Caixas em longitude/latitude: mínimo → máximo. Identificam polígonos mesmo sem nome de ilha na fonte. Ilhas ausentes da própria fonte exigem revisão de resolução maior.

| Tag atual | Partes omitidas | Caixas geográficas | Status | Decision |
| --- | --- | --- | --- | --- |
| CAN | 29 | -83.99, 62.16 → -81.88, 62.91; -80.88, 72.74 → -76.25, 73.76; -80.36, 61.63 → -79.27, 62.39; -96.82, 74.59 → -93.61, 75.65; -96.44, 77.49 → -93.72, 77.83; -98.63, 77.85 → -95.56, 78.87; -97.12, 74.39 → -79.83, 77.16; -113.53, 77.41 → -109.85, 78.15; -112.54, 78.41 → -109.66, 78.85; -59.42, 46.62 → -52.65, 51.63; -87.22, 63.05 → -80.10, 65.74; -90.21, 61.93 → -61.85, 73.80; -96.03, 72.02 → -90.51, 74.13; -122.85, 75.90 → -116.20, 77.65; -133.24, 52.18 → -131.18, 54.17; -105.49, 77.91 → -99.67, 79.30; -128.44, 48.37 → -123.51, 50.77; -125.93, 70.90 → -115.51, 74.45; -117.71, 74.39 → -105.70, 76.79; -119.40, 68.54 → -100.98, 73.31; -102.50, 71.27 → -96.54, 73.84; -106.94, 72.76 → -104.50, 73.64; -102.57, 74.90 → -97.70, 76.72; -96.71, 78.22 → -85.81, 81.26; -91.59, 76.18 → -61.85, 83.23; -77.24, 67.10 → -75.10, 68.29; -99.80, 68.76 → -95.65, 70.14; -64.52, 49.09 → -61.81, 49.96; -64.39, 45.97 → -62.01, 47.04 | IMPLEMENTED | Restored vector parts; compound offshore extracts preserve strategic scale. See Step 3B. |
| USA | 9 | -156.07, 18.92 → -154.81, 20.27; -156.71, 20.57 → -156.00, 21.01; -157.33, 21.07 → -156.76, 21.22; -158.29, 21.26 → -157.65, 21.72; -159.80, 21.88 → -159.35, 22.24; -167.46, 59.75 → -165.58, 60.38; -154.67, 56.73 → -152.14, 57.97; -168.11, 54.40 → -129.98, 71.36; -171.79, 62.98 → -168.69, 63.78 | IMPLEMENTED | Restored vector parts; compound offshore extracts preserve strategic scale. See Step 3B. |
| IDN | 11 | 130.52, -9.12 → 141.03, -0.37; 123.46, -10.36 → 125.09, -8.89; 134.11, -6.90 → 134.73, -5.45; 108.95, -4.11 → 119.00, 4.31; 127.90, -3.86 → 130.83, -2.80; 125.99, -3.79 → 127.25, -3.13; 127.40, -0.90 → 128.69, 2.17; 118.77, -5.67 → 125.24, 1.64; 118.97, -10.26 → 120.78, -9.36; 119.92, -8.93 → 122.90, -8.09; 116.74, -9.04 → 119.13, -8.10 | IMPLEMENTED | Restored vector parts; compound offshore extracts preserve strategic scale. See Step 3B. |
| ARG | 1 | -68.63, -55.25 → -65.05, -52.64 | IMPLEMENTED | Restored vector parts; compound offshore extracts preserve strategic scale. See Step 3B. |
| CHL | 1 | -74.66, -55.61 → -66.96, -52.52 | IMPLEMENTED | Restored vector parts; compound offshore extracts preserve strategic scale. See Step 3B. |
| RUS | 13 | 178.73, 70.78 → 180.00, 71.52; 91.18, 78.76 → 100.19, 81.25; 99.44, 77.92 → 105.37, 79.35; 136.97, 74.61 → 145.09, 76.14; 146.12, 74.69 → 150.73, 75.50; 139.86, 73.21 → 143.60, 73.86; 44.85, 80.01 → 51.52, 80.92; 19.66, 54.31 → 22.76, 55.19; 51.46, 70.63 → 68.85, 76.94; 141.59, 45.97 → 144.65, 54.37; -180.00, 64.25 → -169.90, 68.96; -180.00, 70.83 → -177.58, 71.56; 32.45, 44.36 → 36.53, 46.22 | IMPLEMENTED | Restored vector parts; compound offshore extracts preserve strategic scale. See Step 3B. |
| NOR | 3 | 10.44, 76.77 → 21.54, 80.05; 17.37, 79.40 → 27.41, 80.66; 20.73, 77.44 → 24.72, 78.45 | AGGREGATED | Svalbard assigned to NOR through SJM; source-resolution deduplication. |
| FRA | 1 | 8.54, 41.38 → 9.56, 43.01 | IMPLEMENTED | Restored vector parts; compound offshore extracts preserve strategic scale. See Step 3B. |
| AGO | 1 | 11.91, -5.79 → 13.00, -4.44 | IMPLEMENTED | Restored vector parts; compound offshore extracts preserve strategic scale. See Step 3B. |
| OMN | 1 | 56.07, 25.71 → 56.49, 26.40 | IMPLEMENTED | Restored vector parts; compound offshore extracts preserve strategic scale. See Step 3B. |
| PRK | 1 | 130.78, 42.22 → 130.78, 42.22 | DEFERRED_WITH_REASON | Degenerate zero-area 110m boundary artifact, not a renderable province. |
| GRC | 1 | 23.51, 34.92 → 26.29, 35.71 | IMPLEMENTED | Restored vector parts; compound offshore extracts preserve strategic scale. See Step 3B. |
| AUS | 1 | 144.72, -43.63 → 148.36, -40.70 | IMPLEMENTED | Restored vector parts; compound offshore extracts preserve strategic scale. See Step 3B. |
| CHN | 1 | 108.63, 18.20 → 111.01, 20.10 | IMPLEMENTED | Restored vector parts; compound offshore extracts preserve strategic scale. See Step 3B. |
| ITA | 2 | 12.43, 36.62 → 15.52, 38.23; 8.16, 38.91 → 9.81, 41.21 | IMPLEMENTED | Restored vector parts; compound offshore extracts preserve strategic scale. See Step 3B. |
| GBR | 1 | -7.57, 53.87 → -5.66, 55.17 | IMPLEMENTED | Restored vector parts; compound offshore extracts preserve strategic scale. See Step 3B. |
| AZE | 1 | 44.79, 38.74 → 46.14, 39.74 | IMPLEMENTED | Restored vector parts; compound offshore extracts preserve strategic scale. See Step 3B. |
| PHL | 6 | 120.32, 12.21 → 121.53, 13.47; 122.38, 9.02 → 124.08, 11.23; 121.92, 5.58 → 126.54, 9.76; 117.17, 8.37 → 119.69, 11.37; 121.88, 10.44 → 123.12, 11.89; 124.27, 10.13 → 125.78, 12.56 | IMPLEMENTED | Restored vector parts; compound offshore extracts preserve strategic scale. See Step 3B. |
| MYS | 1 | 109.66, 0.77 → 119.18, 6.93 | IMPLEMENTED | Restored vector parts; compound offshore extracts preserve strategic scale. See Step 3B. |
| JPN | 2 | 139.82, 41.57 → 145.54, 45.55; 132.36, 32.70 → 134.77, 34.36 | IMPLEMENTED | Restored vector parts; compound offshore extracts preserve strategic scale. See Step 3B. |

## Step 3B final decisions (08/10/2026)

The original debt inventory above is retained. All 120 M49 rows have a final status.
M49 is not the playable-country roster: **71 IMPLEMENTED, 48 AGGREGATED, 1 DEFERRED_WITH_REASON**.
Additional scenario entities: **TWN and XKX IMPLEMENTED** (2). Total political inventory: **122 = 73 implemented + 48 aggregated + 1 deferred**.
Antarctica remains deferred because this scenario has no inhabited national capital/gameplay for it; no fabricated country or Antarctic army.

- Microstates: IMPLEMENTED AND, LIE, MCO, SMR, VAT, LUX, MLT. Actual vector dimensions, no enlarged/manual SVG; 10m extracts where 110m omits the polygon.
- Special entities: IMPLEMENTED TWN, internal scenario tag XKX (not official ISO), PSE (West Bank and separate Gaza), ESH. These are gameplay representations, not recognition or sovereignty statements. CYP uses the source polygon; the separately mapped Northern Cyprus unit is DEFERRED_WITH_REASON: absent from the original M49 roster and requires an explicit scenario representation decision. No automatic allocation to a claimant. Crimea is an explicitly restored UKR holding in this scenario, not silently assigned from the RUS source extract.
- Overseas holdings: AGGREGATED to explicit existing owners in every territory row, including GRL to DNK without a Canadian land edge. GUF retains its pre-existing playable-country representation. COK and NIU are separately playable scenario entities, without asserting a political classification outside the game.
- Americas omitted parts: IMPLEMENTED Alaska, Hawaiian compound archipelago, Newfoundland, Canadian Arctic archipelago and major offshore parts, Tierra del Fuego, Galapagos, and sourced coastal/island extracts in both Americas. AGGREGATED tiny detached islands into strategic offshore compound holdings; those holdings have no maritime neighbors.
- Europe omitted parts: IMPLEMENTED Azores/Madeira, Canaries/Balearics, Corsica, Sicily/Sardinia, Crete/Aegean, Northern Ireland, Scandinavian/Danish offshore extracts. Northern Ireland connects only to Ireland. Gibraltar uses a small local 10m border patch in Spain, not a global geometry replacement.
- Russia omitted parts: IMPLEMENTED Kaliningrad, Sakhalin, Chukotka beyond the antimeridian, Arctic islands and offshore 10m extracts (including source Kuril polygons). Wrangel edge fragments are AGGREGATED into one compound province. Kaliningrad has real Polish/Lithuanian edges; no Lithuania-to-mainland-Russia shortcut.
- Africa omitted parts: IMPLEMENTED Cabinda, Zanzibar, Bioko/Annobon and Madagascar/coastal source extracts. Bioko is separate from continental Rio Muni; its valid capital is Malabo. AGGREGATED smaller offshore fragments into isolated compound holdings.
- East/Southeast Asia: IMPLEMENTED Hainan, Hokkaido, Shikoku, Okinawa/Ryukyu, Kalimantan, Sulawesi, Papua, Nusa Tenggara/Moluccas/Bali, Mindanao/Visayas/Palawan and Sabah/Sarawak. AGGREGATED remaining detached source islands into strategic compound holdings. Oecusse detail is AGGREGATED in the existing coarse TLS strategic polygon; finer enclaves remain a geometry limitation, no maritime routes added.
- Oceania omitted parts: IMPLEMENTED Tasmania, Stewart, Chatham and NZ subantarctic source extracts; PNG mainland and offshore islands have separate provinces, with only the mainland touching Indonesian Papua.
- Non-ISO overseas areas: DEFERRED_WITH_REASON Akrotiri/Dhekelia: separate military-base/sovereign-base representation requires a scenario decision outside the M49 list. AGGREGATED French scattered-island source parts into ATF/FRA; no independent country/army. Unmapped individual military installations are DEFERRED_WITH_REASON: not countries and no base system exists.
- CORE coarse island fusions: DEFERRED_WITH_REASON separation of Kyushu/Honshu and similar pre-existing 110m coastal fusions: requires replacing/repartitioning the affected CORE polygon and assigning distinct routing holdings. Hokkaido, Shikoku and Ryukyu are restored now; this remaining source simplification is explicit, not a newly authored maritime neighbor.
- Finest geometry fragments: DEFERRED_WITH_REASON sub-threshold offshore polygons (<0.00001 square degrees) and detailed coastal slivers within 0.03 degrees of CORE. They are below this strategic source filter and may require a future local high-resolution extract; no fake clicks or enlarged shapes. The PRK zero-area source artifact is explicitly deferred in the geometric inventory.
- Macao's province is AGGREGATED to CHN. Its detailed source polygon and the neighboring mainland retain a small cartographic separation; a terrestrial contact is DEFERRED_WITH_REASON until the two vector boundaries can be reconciled without invented geometry. Gaza connects through ISR; a direct Egypt edge is DEFERRED_WITH_REASON for the same local source contact mismatch. Neither introduces an ocean shortcut.

These geometric aggregations are intentional strategic compound provinces, not independent countries or sea travel. Every compound has an audited shape/center and explicit routing component. A single isolated compound does not connect to a mainland through ownership.

World Map Horizontal Wrap V1: future evaluation with Naval Warfare, logical antimeridian and Pacific navigation, possible continuous horizontal camera. Not implemented in Step 3B.

War Resolution overseas limitation: DEFERRED_WITH_REASON special settlement of inaccessible overseas holdings. Canonical transfers of France's five continental provinces plus complete military destruction produce 67.647% surrender (17 original holdings), with no resolution at the unchanged threshold. Future naval access/settlement design must address this; no colonial exception or Peace Conference is introduced here.

Implementation, provenance, validation, performance and complete added roster: [Step 3B](world-map-expansion-v1-step-3b.md).
