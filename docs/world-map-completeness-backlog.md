# World Map Completeness Backlog — Passo 3B

**Status: dívida funcional planejada e obrigatória.** O Passo 3A é CORE, não a conclusão do mundo. Cada entrada precisa de implementação ou de decisão explícita/documentada de agregação antes de encerrar o Passo 3B. Não preencher lacunas com pontes marítimas ou território atribuído silenciosamente a vizinhos.

O inventário compara os 128 tags ativos com os 248 países/áreas da referência [UN M49](https://unstats.un.org/unsd/methodology/m49/overview/) em 07/10/2026: **120 áreas ausentes**, enumeradas abaixo. Nomes e sub-regiões da referência são preservados. Taiwan e Kosovo são pendências adicionais explícitas. Classificação geográfica não decide reconhecimento, soberania ou reivindicações do jogo.

## Pendências adicionais de representação política

- Taiwan (TWN): representação própria pendente; não agregada implicitamente ao roster CHN.
- Kosovo: definir ID estável do cenário; XKX não deve ser apresentado como código ISO oficial.
- Chipre consta da Ásia na referência, mas também precisa de revisão no fechamento europeu.
- Palestina e Saara Ocidental constam das tabelas: definir gameplay explicitamente, sem inferir reivindicações.

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

| Código | País/território pendente | Sub-região M49 |
| --- | --- | --- |
| ESH | Western Sahara | Northern Africa |
| IOT | British Indian Ocean Territory | Sub-Saharan Africa |
| BDI | Burundi | Sub-Saharan Africa |
| COM | Comoros | Sub-Saharan Africa |
| DJI | Djibouti | Sub-Saharan Africa |
| ATF | French Southern Territories | Sub-Saharan Africa |
| MWI | Malawi | Sub-Saharan Africa |
| MUS | Mauritius | Sub-Saharan Africa |
| MYT | Mayotte | Sub-Saharan Africa |
| REU | Réunion | Sub-Saharan Africa |
| RWA | Rwanda | Sub-Saharan Africa |
| SYC | Seychelles | Sub-Saharan Africa |
| SSD | South Sudan | Sub-Saharan Africa |
| GNQ | Equatorial Guinea | Sub-Saharan Africa |
| GAB | Gabon | Sub-Saharan Africa |
| STP | Sao Tome and Principe | Sub-Saharan Africa |
| SWZ | Eswatini | Sub-Saharan Africa |
| LSO | Lesotho | Sub-Saharan Africa |
| BEN | Benin | Sub-Saharan Africa |
| CPV | Cabo Verde | Sub-Saharan Africa |
| GMB | Gambia | Sub-Saharan Africa |
| GNB | Guinea-Bissau | Sub-Saharan Africa |
| LBR | Liberia | Sub-Saharan Africa |
| SHN | Saint Helena | Sub-Saharan Africa |
| SLE | Sierra Leone | Sub-Saharan Africa |
| TGO | Togo | Sub-Saharan Africa |

## Europa faltante

| Código | País/território pendente | Sub-região M49 |
| --- | --- | --- |
| MDA | Republic of Moldova | Eastern Europe |
| SVK | Slovakia | Eastern Europe |
| ALA | Åland Islands | Northern Europe |
| FRO | Faroe Islands | Northern Europe |
| GGY | Guernsey | Northern Europe |
| ISL | Iceland | Northern Europe |
| IMN | Isle of Man | Northern Europe |
| JEY | Jersey | Northern Europe |
| SJM | Svalbard and Jan Mayen Islands | Northern Europe |
| ALB | Albania | Southern Europe |
| AND | Andorra | Southern Europe |
| BIH | Bosnia and Herzegovina | Southern Europe |
| GIB | Gibraltar | Southern Europe |
| VAT | Holy See | Southern Europe |
| MLT | Malta | Southern Europe |
| MNE | Montenegro | Southern Europe |
| MKD | North Macedonia | Southern Europe |
| SMR | San Marino | Southern Europe |
| SVN | Slovenia | Southern Europe |
| LIE | Liechtenstein | Western Europe |
| LUX | Luxembourg | Western Europe |
| MCO | Monaco | Western Europe |

## Caribe e Américas faltantes

| Código | País/território pendente | Sub-região M49 |
| --- | --- | --- |
| AIA | Anguilla | Latin America and the Caribbean |
| ATG | Antigua and Barbuda | Latin America and the Caribbean |
| ABW | Aruba | Latin America and the Caribbean |
| BHS | Bahamas | Latin America and the Caribbean |
| BRB | Barbados | Latin America and the Caribbean |
| BES | Bonaire, Sint Eustatius and Saba | Latin America and the Caribbean |
| VGB | British Virgin Islands | Latin America and the Caribbean |
| CYM | Cayman Islands | Latin America and the Caribbean |
| CUW | Curaçao | Latin America and the Caribbean |
| DMA | Dominica | Latin America and the Caribbean |
| GRD | Grenada | Latin America and the Caribbean |
| GLP | Guadeloupe | Latin America and the Caribbean |
| MTQ | Martinique | Latin America and the Caribbean |
| MSR | Montserrat | Latin America and the Caribbean |
| PRI | Puerto Rico | Latin America and the Caribbean |
| BLM | Saint Barthélemy | Latin America and the Caribbean |
| KNA | Saint Kitts and Nevis | Latin America and the Caribbean |
| LCA | Saint Lucia | Latin America and the Caribbean |
| MAF | Saint Martin (French Part) | Latin America and the Caribbean |
| VCT | Saint Vincent and the Grenadines | Latin America and the Caribbean |
| SXM | Sint Maarten (Dutch part) | Latin America and the Caribbean |
| TTO | Trinidad and Tobago | Latin America and the Caribbean |
| TCA | Turks and Caicos Islands | Latin America and the Caribbean |
| VIR | United States Virgin Islands | Latin America and the Caribbean |
| BVT | Bouvet Island | Latin America and the Caribbean |
| FLK | Falkland Islands (Malvinas) | Latin America and the Caribbean |
| SGS | South Georgia and the South Sandwich Islands | Latin America and the Caribbean |
| BMU | Bermuda | Northern America |
| GRL | Greenland | Northern America |
| SPM | Saint Pierre and Miquelon | Northern America |

## Ásia faltante

| Código | País/território pendente | Sub-região M49 |
| --- | --- | --- |
| HKG | China, Hong Kong Special Administrative Region | Eastern Asia |
| MAC | China, Macao Special Administrative Region | Eastern Asia |
| BRN | Brunei Darussalam | South-eastern Asia |
| SGP | Singapore | South-eastern Asia |
| TLS | Timor-Leste | South-eastern Asia |
| BTN | Bhutan | Southern Asia |
| MDV | Maldives | Southern Asia |
| BHR | Bahrain | Western Asia |
| CYP | Cyprus | Western Asia |
| KWT | Kuwait | Western Asia |
| LBN | Lebanon | Western Asia |
| QAT | Qatar | Western Asia |
| PSE | State of Palestine | Western Asia |
| ARE | United Arab Emirates | Western Asia |

## Oceania faltante

| Código | País/território pendente | Sub-região M49 |
| --- | --- | --- |
| CXR | Christmas Island | Australia and New Zealand |
| CCK | Cocos (Keeling) Islands | Australia and New Zealand |
| HMD | Heard Island and McDonald Islands | Australia and New Zealand |
| NFK | Norfolk Island | Australia and New Zealand |
| FJI | Fiji | Melanesia |
| NCL | New Caledonia | Melanesia |
| PNG | Papua New Guinea | Melanesia |
| SLB | Solomon Islands | Melanesia |
| VUT | Vanuatu | Melanesia |
| GUM | Guam | Micronesia |
| KIR | Kiribati | Micronesia |
| MHL | Marshall Islands | Micronesia |
| FSM | Micronesia (Federated States of) | Micronesia |
| NRU | Naoero | Micronesia |
| MNP | Northern Mariana Islands | Micronesia |
| PLW | Palau | Micronesia |
| UMI | United States Minor Outlying Islands | Micronesia |
| ASM | American Samoa | Polynesia |
| COK | Cook Islands | Polynesia |
| PYF | French Polynesia | Polynesia |
| NIU | Niue | Polynesia |
| PCN | Pitcairn | Polynesia |
| WSM | Samoa | Polynesia |
| TKL | Tokelau | Polynesia |
| TON | Tonga | Polynesia |
| TUV | Tuvalu | Polynesia |
| WLF | Wallis and Futuna Islands | Polynesia |

## Antártida e áreas sem região M49

| Código | País/território pendente | Sub-região M49 |
| --- | --- | --- |
| ATA | Antarctica | → |

## Inventário geométrico da fonte CORE

Partes Natural Earth 1:110m excluídas dos extratos atuais. Caixas em longitude/latitude: mínimo → máximo. Identificam polígonos mesmo sem nome de ilha na fonte. Ilhas ausentes da própria fonte exigem revisão de resolução maior.

| Tag atual | Partes omitidas | Caixas geográficas |
| --- | --- | --- |
| CAN | 29 | -83.99, 62.16 → -81.88, 62.91; -80.88, 72.74 → -76.25, 73.76; -80.36, 61.63 → -79.27, 62.39; -96.82, 74.59 → -93.61, 75.65; -96.44, 77.49 → -93.72, 77.83; -98.63, 77.85 → -95.56, 78.87; -97.12, 74.39 → -79.83, 77.16; -113.53, 77.41 → -109.85, 78.15; -112.54, 78.41 → -109.66, 78.85; -59.42, 46.62 → -52.65, 51.63; -87.22, 63.05 → -80.10, 65.74; -90.21, 61.93 → -61.85, 73.80; -96.03, 72.02 → -90.51, 74.13; -122.85, 75.90 → -116.20, 77.65; -133.24, 52.18 → -131.18, 54.17; -105.49, 77.91 → -99.67, 79.30; -128.44, 48.37 → -123.51, 50.77; -125.93, 70.90 → -115.51, 74.45; -117.71, 74.39 → -105.70, 76.79; -119.40, 68.54 → -100.98, 73.31; -102.50, 71.27 → -96.54, 73.84; -106.94, 72.76 → -104.50, 73.64; -102.57, 74.90 → -97.70, 76.72; -96.71, 78.22 → -85.81, 81.26; -91.59, 76.18 → -61.85, 83.23; -77.24, 67.10 → -75.10, 68.29; -99.80, 68.76 → -95.65, 70.14; -64.52, 49.09 → -61.81, 49.96; -64.39, 45.97 → -62.01, 47.04 |
| USA | 9 | -156.07, 18.92 → -154.81, 20.27; -156.71, 20.57 → -156.00, 21.01; -157.33, 21.07 → -156.76, 21.22; -158.29, 21.26 → -157.65, 21.72; -159.80, 21.88 → -159.35, 22.24; -167.46, 59.75 → -165.58, 60.38; -154.67, 56.73 → -152.14, 57.97; -168.11, 54.40 → -129.98, 71.36; -171.79, 62.98 → -168.69, 63.78 |
| IDN | 11 | 130.52, -9.12 → 141.03, -0.37; 123.46, -10.36 → 125.09, -8.89; 134.11, -6.90 → 134.73, -5.45; 108.95, -4.11 → 119.00, 4.31; 127.90, -3.86 → 130.83, -2.80; 125.99, -3.79 → 127.25, -3.13; 127.40, -0.90 → 128.69, 2.17; 118.77, -5.67 → 125.24, 1.64; 118.97, -10.26 → 120.78, -9.36; 119.92, -8.93 → 122.90, -8.09; 116.74, -9.04 → 119.13, -8.10 |
| ARG | 1 | -68.63, -55.25 → -65.05, -52.64 |
| CHL | 1 | -74.66, -55.61 → -66.96, -52.52 |
| RUS | 13 | 178.73, 70.78 → 180.00, 71.52; 91.18, 78.76 → 100.19, 81.25; 99.44, 77.92 → 105.37, 79.35; 136.97, 74.61 → 145.09, 76.14; 146.12, 74.69 → 150.73, 75.50; 139.86, 73.21 → 143.60, 73.86; 44.85, 80.01 → 51.52, 80.92; 19.66, 54.31 → 22.76, 55.19; 51.46, 70.63 → 68.85, 76.94; 141.59, 45.97 → 144.65, 54.37; -180.00, 64.25 → -169.90, 68.96; -180.00, 70.83 → -177.58, 71.56; 32.45, 44.36 → 36.53, 46.22 |
| NOR | 3 | 10.44, 76.77 → 21.54, 80.05; 17.37, 79.40 → 27.41, 80.66; 20.73, 77.44 → 24.72, 78.45 |
| FRA | 1 | 8.54, 41.38 → 9.56, 43.01 |
| AGO | 1 | 11.91, -5.79 → 13.00, -4.44 |
| OMN | 1 | 56.07, 25.71 → 56.49, 26.40 |
| PRK | 1 | 130.78, 42.22 → 130.78, 42.22 |
| GRC | 1 | 23.51, 34.92 → 26.29, 35.71 |
| AUS | 1 | 144.72, -43.63 → 148.36, -40.70 |
| CHN | 1 | 108.63, 18.20 → 111.01, 20.10 |
| ITA | 2 | 12.43, 36.62 → 15.52, 38.23; 8.16, 38.91 → 9.81, 41.21 |
| GBR | 1 | -7.57, 53.87 → -5.66, 55.17 |
| AZE | 1 | 44.79, 38.74 → 46.14, 39.74 |
| PHL | 6 | 120.32, 12.21 → 121.53, 13.47; 122.38, 9.02 → 124.08, 11.23; 121.92, 5.58 → 126.54, 9.76; 117.17, 8.37 → 119.69, 11.37; 121.88, 10.44 → 123.12, 11.89; 124.27, 10.13 → 125.78, 12.56 |
| MYS | 1 | 109.66, 0.77 → 119.18, 6.93 |
| JPN | 2 | 139.82, 41.57 → 145.54, 45.55; 132.36, 32.70 → 134.77, 34.36 |
