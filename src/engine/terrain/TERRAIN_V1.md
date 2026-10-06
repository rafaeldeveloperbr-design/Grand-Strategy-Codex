# Terrain V1

Terreno dominante e simplificado para gameplay na South America V1. Mant?m 56 prov?ncias, 13 pa?ses, IDs, nomes, owners, geometria e topologia.

| Tipo | R?tulo | Custo de movimento | Supply | Defesa |
|---|---|---:|---:|---:|
| plains | Plan?cies | 1.00 | 1.00 | 1.00 |
| forest | Floresta | 1.15 | 0.90 | 1.10 |
| jungle | Selva | 1.35 | 0.70 | 1.15 |
| hills | Colinas | 1.20 | 0.90 | 1.15 |
| mountains | Montanhas | 1.60 | 0.60 | 1.35 |
| desert | Deserto | 1.25 | 0.65 | 1.00 |

Configura??o ?nica: `index.ts`. Classifica??o: `../../data/map/regions/southAmerica/terrain.ts`.

## Integra??o

- Movimento: progresso por tick = velocidade ? multiplicador de supply da origem ? custo de terreno do destino. Cada aresta mant?m sua chegada, acesso diplom?tico e valida??o. Dura??o em dias ? discretizada pelos ticks; arredondamento pode fazer custos pr?ximos produzirem o mesmo n?mero de dias. BFS continua escolhendo menor n?mero de arestas.
- Supply: capacidade de desenvolvimento + edif?cios conclu?dos multiplicada pelo terreno, antes da penalidade territorial e da divis?o por demanda dos ex?rcitos do mesmo owner. Ratio fica entre 0 e 1. N?o consome estoque nem aplica dano passivo de organiza??o/moral; recupera??o continua no sistema existente.
- Combate cont?nuo: press?o defensora existente ? (1 + b?nus de fortifica??o existente) ? defesa do terreno. Cerco e tecnologia de fortifica??o continuam funcionando. Resolu??o direta tamb?m multiplica o poder defensor uma ?nica vez. O atacante n?o recebe b?nus de terreno.
- IA: execu??o usa os sistemas comuns. Scores existentes de poder defensor nacional e rebelde incluem terreno. Nenhum planner novo e nenhuma altera??o de rota estrat?gica.
- UI: modo TERRENO usa cores categ?ricas e legenda dos seis tipos; tooltip e painel mostram r?tulo e tr?s percentuais. O modo supply reflete capacidade com terreno. Pol?tica, sele??o e stacks mant?m a l?gica existente.
- Saves: campo opcional apenas para compatibilidade com mapas legados/sint?ticos. Ao carregar terreno ausente ou desconhecido, recuperar pelo ID do mapa base; prov?ncia sem defini??o usa plains. Serializa??o omite terreno igual ao mapa base, preservando overrides v?lidos.

## Limita??es e evolu??o

Uma categoria por prov?ncia extensa: costas e Andes podem coexistir dentro do mesmo pol?gono. Selva nas Guianas representa o interior dominante; Santiago usa colinas para o vale central e sop?s; Patag?nia ?rida usa deserto por n?o existir steppe nesta V1. N?o h? clima, rios, naval, infraestrutura nova, attrition espec?fica ou b?nus por unidade. Rotas estrat?gicas ponderadas por terreno podem ser uma evolu??o futura, mantendo os acessos diplom?ticos.

## Classifica??o das 56 prov?ncias

| ID | Prov?ncia | Terreno |
|---|---|---|
| sa_bra_roraima | Roraima | jungle |
| sa_bra_amazonas | Amazonas | jungle |
| sa_bra_acre | Acre | jungle |
| sa_bra_rondonia | Rondônia | jungle |
| sa_bra_para | Pará | jungle |
| sa_bra_amapa | Amapá | jungle |
| sa_bra_maranhao | Maranhão | forest |
| sa_bra_ceara | Ceará | plains |
| sa_bra_pernambuco | Pernambuco | plains |
| sa_bra_bahia | Bahia | hills |
| sa_bra_tocantins | Tocantins | plains |
| sa_bra_mato_grosso | Mato Grosso | plains |
| sa_bra_brasilia | Brasília | plains |
| sa_bra_minas_gerais | Minas Gerais | hills |
| sa_bra_sao_paulo | São Paulo | hills |
| sa_bra_parana | Paraná | forest |
| sa_bra_rio_grande_do_sul | Rio Grande do Sul | plains |
| sa_arg_salta | Salta | mountains |
| sa_arg_chaco | Chaco | forest |
| sa_arg_cordoba | Córdoba | plains |
| sa_arg_mendoza | Mendoza | mountains |
| sa_arg_buenos_aires | Buenos Aires | plains |
| sa_arg_patagonia | Patagônia | desert |
| sa_arg_santa_cruz | Santa Cruz | desert |
| sa_chl_atacama | Atacama | desert |
| sa_chl_coquimbo | Coquimbo | hills |
| sa_chl_santiago | Santiago | hills |
| sa_chl_araucania | Araucanía | forest |
| sa_chl_aysen | Aysén | mountains |
| sa_chl_magallanes | Magalhães | hills |
| sa_per_piura | Piura | desert |
| sa_per_iquitos | Iquitos | jungle |
| sa_per_lima | Lima | hills |
| sa_per_cusco | Cusco | mountains |
| sa_per_arequipa | Arequipa | mountains |
| sa_bol_la_paz | La Paz | mountains |
| sa_bol_beni | Beni | jungle |
| sa_bol_santa_cruz | Santa Cruz | hills |
| sa_bol_tarija | Tarija | hills |
| sa_col_caribe | Caribe | plains |
| sa_col_bogota | Bogotá | mountains |
| sa_col_cali | Cali | hills |
| sa_col_amazonia | Amazônia | jungle |
| sa_ven_caracas | Caracas | hills |
| sa_ven_maracaibo | Maracaibo | hills |
| sa_ven_llanos | Llanos | plains |
| sa_ven_guayana | Guayana | jungle |
| sa_ecu_quito | Quito | mountains |
| sa_ecu_guayaquil | Guayaquil | plains |
| sa_ecu_oriente | Oriente | jungle |
| sa_pry_chaco | Chaco | plains |
| sa_pry_assuncao | Assunção | forest |
| sa_ury_montevideu | Montevidéu | plains |
| sa_guy_georgetown | Georgetown | jungle |
| sa_sur_paramaribo | Paramaribo | jungle |
| sa_guf_caiena | Caiena | jungle |

## Verifica??o

Testes espec?ficos em `../__tests__/terrainV1.test.tsx`: dados, travessia real por ticks, supply, recupera??o sem drenagem passiva, composi??o com fortes nas duas resolu??es, cores/legenda/sele??o, tooltip/painel e saves.

Inspe??o visual em navegador n?o executada: a ferramenta retornou `Browser is not available: iab` e invent?rio de navegadores vazio. Verifica??o de console e intera??o visual de campanhas permanece pendente; renderiza??o e sele??o s?o cobertas por testes DOM.
