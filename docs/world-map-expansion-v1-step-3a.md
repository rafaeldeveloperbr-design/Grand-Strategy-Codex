# World Map Expansion V1 — Passo 3A: Asia + Oceania Core

## Entrega e escopo

O mapa passa de **89 países / 196 províncias** para **128 países / 274 províncias**, em seis regiões. Ásia acrescenta 37 países / 70 províncias; Oceania acrescenta 2 países / 8 províncias. As quatro regiões anteriores preservam gameplay, IDs, capitais e geometria. Apenas suas declarações de landmass continental são reunidas após as ligações reais através da Rússia e do Sinai.

Não há Naval Warfare, sea zones, transporte, Air Warfare, Battle System V3 ou Peace Conference. O roster continua deliberadamente incompleto; o Passo 3B é dívida funcional obrigatória.

## Países e escala

| Região/grupo | Países | Províncias por país |
| --- | --- | --- |
| Eurásia | Rússia, Turquia | RUS 10; TUR 3 |
| Cáucaso | Geórgia, Armênia, Azerbaijão | GEO/ARM/AZE 1 cada |
| Oriente Médio | Irã, Iraque, Síria, Israel, Jordânia, Arábia Saudita, Iêmen, Omã | IRN 3; SAU 2; demais 1 |
| Ásia Central | Cazaquistão, Uzbequistão, Turcomenistão, Quirguistão, Tajiquistão | KAZ 2; demais 1 |
| Sul da Ásia | Afeganistão, Paquistão, Índia, Nepal, Bangladesh, Sri Lanka | IND 6; PAK 2; demais 1 |
| Leste Asiático | China, Mongólia, Coreia do Norte, Coreia do Sul, Japão | CHN 8; JPN 2; demais 1 |
| Sudeste Asiático | Myanmar, Tailândia, Laos, Camboja, Vietnã, Malásia, Indonésia, Filipinas | MMR/THA/VNM/IDN 2 cada; demais 1 |
| Oceania | Austrália, Nova Zelândia | AUS 6; NZL 2 |

IDs seguem `as_<tag>_<ascii_snake_province>` e `oc_<tag>_<ascii_snake_province>`. Capital sempre referencia uma província válida/controlada pelo país; nomes amigáveis aparecem na UI. Exemplos: `as_rus_moscow`, `as_ind_delhi`, `as_chn_beijing`, `oc_aus_new_south_wales` (Canberra) e `oc_nzl_north_island` (Wellington).

Countries usam DEFAULT_LAWS e o mesmo formato dos demais continentes. Gameplay usa createProvinceGameplay, sem duplicar inicialização de market/buildings/unrest. Valores são de balanceamento, não censos históricos: capitais têm população inicial 30.000/desenvolvimento 7 e demais províncias 22.000/5; tesouro deriva moderadamente do desenvolvimento. China/Rússia/Índia têm escala maior sem tesouros desproporcionais. Terrain utiliza somente tipos existentes.

## Arquitetura e arquivos

Criados `src/data/map/regions/{asia,oceania}/{countries,definitions,provinces,topology,geometry,terrain,index}.ts`; `src/engine/__tests__/worldMapStep3a.test.ts`; geradores `tools/map/generate_{asia,oceania}.py`; extratos `tools/map/{asia,oceania}.{outlines,provinces}.json`; `tools/map/export_audit.mjs`; este documento e o backlog dedicado.

Alterados map/index, worldMetadata, crossRegionConnections e declarações continentais de Europe/Africa; audit_world.py e README do tooling. Testes de roster/renderização/terrain/política dos mapas anteriores foram adaptados ao mundo expandido. Pequenas otimizações equivalentes em diplomacyRelations, internationalTrade, logistics, aiMovement e movementTick são descritas abaixo. Sem novo sistema de mapa, alteração de save ou fórmula de guerra.

## Geometria e projeção

Extratos offline de [Natural Earth Admin 0 1:110m](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson), [domínio público](https://www.naturalearthdata.com/about/terms-of-use/). Os wrappers reutilizam generate_region.py e world_projection.py; Voronoi/half-planes recortam as sementes ao outline. Nenhum SVG foi desenhado manualmente. Os extratos versionados tornam a geração independente de rede.

Projeção mantida: `x = (longitude + 180) × 14`, `y = (90 − latitude) × 14`. Bounds **5040 × 2520**. Reset/viewBox **x=0, y=100, w=5040, h=2300** mostra quase todo o mundo; zoom permite inspecionar labels menores. Nenhuma deformação de geometria para caber no reset.

Escolhas CORE: Rússia usa o polígono continental principal até longitude 180; exclui Kaliningrado, ilhas e fragmento além do antimeridiano. Turquia conserva Trácia e Anatólia em partes separadas, sem ponte do Bósforo. Malásia usa a península. Indonésia inclui Java/Sumatra, separadamente; Filipinas conserva Luzon. Austrália conserva mainland, sem Tasmânia. Nova Zelândia conserva as duas ilhas principais, sem conexão pelo estreito. Japão é coarse sobre a parte principal da fonte 1:110m; outras partes insulares ficam no backlog.

## Landmasses e topologia

Há **17 componentes intencionais**: american-mainland (87), cuba (1), hispaniola (2), jamaica (1), eurasian-mainland (162), great-britain (4), ireland (1), zealand (1), madagascar (1), sri-lanka (1), japan (2), java (1), sumatra (1), philippines (1), australia (6), new-zealand-north (1) e new-zealand-south (1).

O nome `eurasian-mainland` representa o componente terrestre **afro-eurasiano**: Europa continental, Escandinávia, Ásia continental e África agora se conectam por fronteiras reais. Declarações regionais com esse mesmo ID são reunidas pelo assembleMap existente. Os neighbors continuam explícitos, não inferidos dos paths.

### Cross-region edges

São 11 edges: a ligação Panamá–Colômbia preservada e estas **10 novas**:

- Helsinque–Carélia e Lapônia–Carélia.
- Tallinn–Rússia Ocidental; Riga–Rússia Ocidental; Minsk–Rússia Ocidental.
- Kyiv–Rússia Ocidental; Ucrânia Oriental–Sul da Rússia.
- Sófia–Trácia e Macedônia grega–Trácia.
- Cairo–Jerusalém, pelo Sinai.

Não há Lituânia–Rússia sem Kaliningrado, Egito–Jordânia direto, Bósforo, Canal da Mancha ou ligação pelo Mediterrâneo. CrossRegionConnections é a única declaração dessas arestas, sem duplicação regional.

Rússia forma corredor oeste–Urais–Sibéria–Extremo Oriente e conecta Cáucaso, Cazaquistão, Mongólia e China. Oriente Médio conecta Turquia/Irã, Síria/Iraque/Jordânia/Israel e Arábia/Iêmen/Omã. Ásia Central conecta países existentes e Afeganistão; Índia/Paquistão conectam China, Nepal/Bangladesh/Myanmar. Sudeste continental chega à Malásia. Fronteiras atuais/coarse são representação de gameplay, sem pretensão de simular a história de 1444.

## Routing e UI

Rotas terrestres testadas: Portugal–China, França–Índia, Finlândia–China, Turquia–Índia, Egito–Índia, Rússia–China/Europa e China–Vietnã. Europa–África agora possui rota real via Rússia/Cáucaso/Oriente Médio/Sinai; isso não cria ponte mediterrânea. Testes do Passo 2 foram atualizados para essa mudança deliberada, preservando seu número de casos.

Sem rota continental para Japão, Sri Lanka, Filipinas, Java/Sumatra, Austrália ou Nova Zelândia; tampouco entre as duas ilhas neozelandesas. Rotas de gameplay continuam exigindo acesso diplomático: testes de conectividade concedem acesso explicitamente, sem alterar regras normais.

GameMap/ProvinceLayer existentes renderizam as seis regiões, sem redesign. Testes cobrem shapes, labels amigáveis, clique, tooltip, context menu, pan/zoom/reset e army markers. Não foi realizada inspeção manual em navegador real nesta entrega; a validação visual automatizada usa os componentes reais e a auditoria dos paths.

## Integração e performance

Diplomacy V2 inicializa **8.128 pares** para 128 países. Cada capital CORE inicializa mercado, população, defesa e recrutamento; todos os países têm exército inicial. Logística global e comércio doméstico mantêm recursos finitos e sem estoques negativos, incluindo ilhas desconectadas. A suíte mantém os 30 ticks econômicos globais e 100 dias de movimento de IA com timeouts originais.

O crescimento evidenciou consultas repetidas de relações em logística/comércio. Um índice temporário por par preserva o **primeiro registro canônico**, inclusive duplicatas legadas e acesso direcional; não cria cache persistente. AI fallback e movimento calculam redes somente dos owners de exércitos consultados; todos esses owners, inclusive inimigos/aliados, permanecem incluídos. O tick econômico conserva redes nacionais globais. Nenhuma regra de acesso, scoring, produção ou logística foi alterada; não houve aumento de timeout.

Integrações reais RUS–UKR, CHN–MNG e IND–PAK exercitam declareWar, movimento, Combat V2, casualties, transferProvince, surrender e cleanup da campanha. Fórmulas do War Resolution V1 e lifecycle de Rebellion V2 permanecem inalterados.

## Save

Mantidos **world-v1 e Save V3**, sem migration. Compatibilidade continua dependendo de roster exato: saves das quatro regiões anteriores são rejeitados. Teste específico cobre essa incompatibilidade, sem alterar save/load.

## Testes e auditoria

Novo arquivo possui **162 testes**; renderização ganhou **8 casos**. Total final: **1.415 testes em 63 arquivos**, preservando os anteriores. Cobertura inclui montagem/IDs/capitais, 39 países CORE, gameplay/recruitment, fronteiras, cross-region edges, componentes, rotas positivas/negativas, diplomacia, logística e três guerras asiáticas. Teste adicional confirma equivalência do índice de relações e acesso direcional.

audit_world.py verifica as seis regiões, **274 shapes**, centers internos, bounds, IDs únicos, overlap estrutural, contato geométrico das fronteiras autoradas e cross-region edges. O bridge Node consulta o assembleMap/validator reais para validar 128 tags e 17 landmasses, sem manter manifesto paralelo. Tolerância existente de overlap: 0,05 unidades SVG²; maior resíduo observado 0,008236 unidades SVG² na fronteira Quênia–Tanzânia já existente.

Comandos obrigatórios: npm run lint, npm run typecheck, npm run test:run, npm run build, python tools/map/audit_world.py e git diff --check. Todos passaram: lint/typecheck sem erros, 1.415 testes verdes (63 arquivos), build concluído, auditoria 274/128/17 válida e diff-check limpo. Build informa o aviso de chunk JS acima de 500 kB; sem aumento de limite para ocultá-lo.

## World Map Completeness Backlog

O [backlog obrigatório do Passo 3B](world-map-completeness-backlog.md) enumera **120 áreas M49 ausentes**, Taiwan/Kosovo adicionais e partes geométricas omitidas da fonte. Inclui Europa faltante, África faltante, Caribe/Américas faltantes, Ásia faltante, Oceania faltante, microestados, ilhas secundárias e territórios ultramarinos.

Exemplos de pendências: Albânia/Bósnia/Eslováquia/Eslovênia/Moldova, Benin/Malawi/Ruanda/Sudão do Sul, Bahamas/Trinidad e Tobago, Bahrain/Qatar/Emirados/Líbano/Singapura/Timor-Leste, Papua-Nova Guiné/Fiji/Samoa/Tonga/Vanuatu/Salomão/Micronésia/Palau/Kiribati/Nauru/Tuvalu/Marshall. A lista dedicada é exaustiva em relação à referência utilizada, não uma nota opcional.

## Limitações e próximos passos

O CORE omite microestados, partes insulares/territórios e países listados no backlog. Natural Earth 1:110m não resolve ilhas pequenas nem disputas com precisão; o Passo 3B deverá avaliar fonte mais detalhada dentro da mesma arquitetura. Antimeridiano exige tratamento futuro antes de incluir o fragmento oriental russo. Sem Naval Warfare, países insulares e partes domésticas separadas têm limitações reais de movimento/supply, não conexões artificiais.

Próximo: **Passo 3B — World Map Completeness**; depois Naval Warfare V1. Battle System V3 continua dívida futura e não foi iniciado.
