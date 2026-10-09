# Map Navigation UX V1

## Modelo de câmera

A câmera permanece local ao `GameMap/useMapControls`: um SVG `viewBox` em coordenadas mundiais, sem atualizações do estado global ou persistência no Save V3. O mundo tem 5040 × 2520, 201 países e 494 províncias. A API reúne `zoomAt`, `panBy`, `focusWorldPoint`, `focusProvince`, `focusCountry`, `fitBounds` e `resetView`. Helpers matemáticos puros ficam em `camera.ts`.

## Zoom e pan

`MIN_ZOOM = 1`, `DEFAULT_ZOOM = 1`, `MAX_ZOOM = 64`, relativos à largura 5040 do overview existente. A largura mínima do viewBox é 78,75 unidades. O overview preserva `{x:0,y:100,w:5040,h:2300}` e o foco inicial recebido do player continua intacto. Esse overview quase mundial omite pequenas faixas polares; o renderer SVG usa seu ajuste de aspecto padrão.

Wheel aplica zoom exponencial, normalizando deltas de pixel/linha/página e limitando cada evento a ±0,5. A conversão considera o retângulo atual do SVG e as margens de `preserveAspectRatio=xMidYMid meet`. O ponto sob o cursor fica fixo, exceto quando o clamp de bordas precisa prevalecer. Não há arredondamento intermediário ou acumulação incremental do ponto âncora. Botões e teclado usam o centro da câmera.

Arrasto com botão esquerdo, central ou Shift+esquerdo. Threshold de 5 pixels distingue seleção e navegação. Pan usa pixels de tela divididos pela escala efetiva: 100 pixels de drag deslocam o conteúdo em 100 pixels, em qualquer zoom. Sem inércia. Mouseup no window, blur e saída do SVG encerram o drag; captura de click impede seleção acidental após drag. Texto não é selecionável dentro do SVG; cursores grab/grabbing.

Clamp permite margem de 15% do tamanho visível em cada eixo. Viewports maiores que o mundo são centralizados. Sem wrap ou duplicação. Resize revalida bounds e mantém o viewBox, sem reset arbitrário. Conversões e novas ações fit/focus consultam as dimensões atuais.

## Foco e fitBounds

`fitBounds(bounds, padding=0.15)` recebe bounds em world-space e resolve largura/altura para o aspecto atual, com padding por lado e limites de zoom/clamp. Não consulta getBBox nem interpreta SVG paths.

Focus Player / Home reutiliza `getCountryInitialView` da Country Selection: capital owned válida, depois primeira província owned. O helper usa centros owned até 900 unidades horizontais e 600 verticais da capital, mantendo o enquadramento centrado nela. France não incorpora Réunion/Guiana; USA não incorpora Hawaii. É uma aproximação geográfica V1, não um algoritmo de componentes territoriais. Limitação: centros não garantem conter cada extremidade da geometria e holdings próximos podem entrar.

Double click em Province foca seu centro com largura regional de detalhe de 160 unidades; single click continua selecionando. Locate selected entity / F prioriza a Province atual do selectedArmy, depois selectedProvince. A seleção via marker ou lista usa o mesmo botão, sem alterar movimento ou destino. Exércitos em trânsito focam a localização provincial atual, não a posição interpolada.

Dropdown Battle aparece somente com batalhas ativas e foca a Province conhecida, sem alterar Battle System. O helper `focusProvince` também serve para integração futura de relatórios históricos/notificações.

## Saltos regionais e atalhos

Dropdown compacto: Americas, Europe, Africa, Asia, Oceania e World. Bounds são calculados uma vez a partir dos centros das geometrias dos MapRegions; Americas combina North/South America. World equivale a Reset View. Os centros incluem os dados de completeness. Sem pixels regionais hardcoded; regiões muito dispersas podem exigir enquadramento amplo.

- Arrow Keys: pan de 80 pixels por evento (repetição do sistema operacional).
- Home: Focus Player.
- 0: Reset View.
- + / = / -: zoom central.
- F: localizar entidade selecionada.

Auditoria: Escape já limpa seleção/fecha painéis; Ctrl+Shift+C abre cheats e 1–7 executam cheats. Esses comandos ficam preservados. Nenhum atalho novo de velocidade. Modificadores Ctrl/Alt/Meta, eventos já tratados, inputs, textarea, select, contenteditable, sliders, menus, diálogos e cheat panel bloqueiam navegação. WASD não foi adicionado.

## Markers, microstates e Country Selection

ArmyMarker e ArmyStackMarker recebem escala inversa em torno de sua posição mundial: dimensão visual e alvo de clique permanecem constantes em pixels em vez de crescerem com zoom. Labels provinciais limitadas a 12 pixels no zoom alto; demais ícones decorativos preservados. Não há LOD nem aumento artificial da geometria. Max zoom permite inspeção de microstates; províncias extremamente pequenas podem continuar exigindo precisão do mouse.

Country Selection recebe wheel no cursor, drag, clamp, limites, reset e double click de foco pelo GameMap compartilhado. Não recebe controles militares, player, battle ou regionais. Busca, seleção de países e confirmação continuam como antes. O helper de foco inicial não foi modificado.

## Performance e escopo

Camera state não sobe ao App. Wheel/mousemove usam apenas matemática O(1), refs de interação e atualização local. Índices e apresentações existentes permanecem memoizados; ProvinceLayer, ArmyMovementLayer, OperationalOverlay e BattleMarkersOverlay são memoizados, com callbacks estáveis. Bounds regionais são cacheados no módulo; foco country faz scan apenas na ação explícita. Pan não recalcula geometry, summaries, logistics ou Simulation Activation. Zoom atualiza tamanhos visuais; o renderer SVG continua sujeito ao custo de pintura do navegador. Não foi necessário adicionar profiler; suavidade sob x3 exige validação visual no ambiente do usuário.

Save schema, topology, movement/pathfinding, activation e fórmulas de gameplay não foram alterados. Sem Naval Warfare, horizontal wrap, minimap, inércia, gestos móveis complexos ou novo renderer.

## Validação manual pendente

- [ ] Abrir partida como BRA; confirmar foco inicial preservado.
- [ ] Focus Player / Home enquadra capital e região principal.
- [ ] Repetir zoom sobre um ponto no cursor com mouse e trackpad.
- [ ] Arrastar até Europe; testar todos os regional jumps.
- [ ] Zoom máximo em Monaco/Vatican/Andorra; selecionar Province e double click para focar.
- [ ] Arrastar e soltar fora do mapa; retornar e verificar cursor/seleção.
- [ ] Reset View e 0 restauram overview.
- [ ] Selecionar Army por marker e lista; Locate / F enquadra sua Province.
- [ ] Localizar batalha ativa pelo dropdown.
- [ ] Testar atalhos com input de busca, cheats, menus e diálogo aberto.
- [ ] Redimensionar janela em overview e em detalhe.
- [ ] Iniciar x3 enquanto navega; confirmar pan/zoom suaves e ordens militares preservadas.

Checklist não executado em navegador interativo nesta sessão. Testes automatizados cobrem matemática, limites, seleção/drag, mouseup externo, atalhos, resize, região, player/microstate e integração real da Country Selection/mundo completo.

Próximo passo: **Naval Warfare V1**. **World Horizontal Wrap V1** permanece no backlog distante; não é o próximo passo.

Validação automatizada: lint/typecheck/build e git diff --check passaram. A primeira suíte completa teve dois timeouts; repetição com --maxWorkers=2 passou (1.813 testes em 74 arquivos, incluindo 38 testes novos de navegação). Build mantém aviso de chunk grande. Os comandos exigiram subprocessos fora do sandbox após spawn EPERM; nenhuma operação de commit/push.
