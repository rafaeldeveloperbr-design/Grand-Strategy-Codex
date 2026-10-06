# Arquitetura do mapa

`index.ts` agrega as regiões e expõe `provincesData`, `countries`,
`getCountryByTag`, `mapCapitals`, `assembleMap` e `validateMapTopology`.
Os antigos `src/data/provinces.ts` e `src/data/countries.ts` continuam como
reexports. Os tipos de runtime `Province` e `Country` não foram alterados.

Cada região declara gameplay em `provinces.ts`, países em `countries.ts`,
arestas explícitas em `topology.ts` e SVG/centros em `geometry.ts`.
Novas regiões entram em `mapRegions`; IDs devem ser globalmente únicos.
Conexões entre regiões usam os mesmos IDs, sem depender da geometria.
`assembleMap` recompõe o formato de runtime e rejeita definições ausentes,
duplicadas ou sem gameplay. A validação completa de países e arestas é feita
separadamente pelo validador, sem impedir o carregamento do mapa legado.

## Validação

`validateMapTopology(provinces, countries)` é puro e aceita apenas os campos
necessários à auditoria. Retorna `valid`, `issues` e `components`.
O diagnóstico usa Sets/Maps e busca iterativa, proporcional ao número de
províncias, países, arestas e entradas de território.
Componentes são calculados ignorando a direção das arestas válidas;
reciprocidade é verificada separadamente. Arestas inexistentes ou para a
própria província não conectam componentes.

Todas as inconsistências tornam `valid` falso, incluindo múltiplas massas
terrestres. Ilhas futuras devem ser avaliadas explicitamente pelo consumidor;
não se deve adicionar arestas fictícias para eliminar o diagnóstico.
Capitais explícitas `capital`/`capitalId` são verificadas quanto à existência,
owner e pertencimento à lista do país. Não há inferência de capital pela ordem.
`mapCapitals` contém os marcadores visuais iniciais, auditados pelo teste real.
O validador se destina aos dados iniciais, não à ocupação rebelde em saves.

## Auditoria desta migração

Os 21 registros de província e os 6 de país foram comparados campo a campo
com os arquivos originais de HEAD, incluindo ordem das listas, vizinhos,
geometria e leis iniciais: sem diferenças de valores. Campos opcionais
ausentes continuam ausentes.

O mapa possui uma única componente e quatro arestas unilaterais:
`p12 -> p10`, `p19 -> p16`, `p20 -> p19`, `p21 -> p19`.
Foram preservadas porque corrigir reciprocidade alteraria as rotas disponíveis.
O teste real exige exatamente esses quatro diagnósticos e detecta regressões.
Não foram encontrados owners, holdings ou capitais iniciais inválidos.
O salto de IDs de `p12` para `p14` é válido; IDs não precisam ser consecutivos.

Arquivos alterados: os dois reexports antigos, `GameMap.tsx`, este diretório
(`index.ts`, `types.ts`, `validation.ts`, `regions/current/*`) e
`src/engine/__tests__/mapTopology.test.ts`.
Corrigido: marcadores de capital hardcoded em `GameMap.tsx` passaram para
metadados regionais, mantendo os mesmos seis marcadores e coordenadas.

## Limitações para o futuro mapa-múndi

- `GameMap.tsx`: fundo/grid com limites fixos; fallback de clique usa distância
  de 60 unidades ao centro, não teste de contenção do SVG.
- `useMapControls.ts`: viewport inicial e escala de pan fixos; precisarão de
  limites configuráveis e dimensões reais do elemento.
- `ProvinceLayer.tsx` e `ArmyMovementLayer.tsx`: offsets visuais constantes e
  buscas/filtros repetidos por província/exército. Sem quantidade fixa ou IDs
  específicos, mas precisarão de índices e possivelmente culling para milhares
  de províncias. Nenhuma alteração visual foi feita.
- `movementEngine.ts`: BFS segue arestas direcionadas existentes e permissões
  diplomáticas. Não infere fronteiras nem usa distância visual para rotas ou
  duração. Centros são usados apenas para preencher posição de animação.
  `queue.shift()` e buscas lineares por vizinho são pontos futuros de desempenho;
  não houve reescrita do pathfinding.
- `supplyEngine.ts`: suprimento local por desenvolvimento/edifícios/owner;
  não assume uma massa continental nem calcula conexão à capital.
- `aiMovement.ts`: usa topologia explícita, mas ainda infere capital pela
  primeira província quando faltam `capital`/`capitalId`. Remover isso exige
  política de capital durante conquista/anexação e compatibilidade de saves;
  a decisão foi adiada para preservar o comportamento da IA.
- `movement.test.ts`: IDs `p1`/`p2` e `BRA` pertencem a fixtures sintéticas,
  não dependem da quantidade ou organização do mapa real. O novo teste também
  verifica que mudanças de geometria não alteram o caminho calculado.

## Verificação

`npm run lint`, `npm run typecheck`, `npm run build` e `npm run test:run`
passaram. A suíte completa executou 274 testes em 22 arquivos, incluindo
21 casos novos de mapa/topologia. `git diff --check` passou.
Sem commit ou push; sem mapa novo, rotas marítimas ou mudanças de balanceamento.
