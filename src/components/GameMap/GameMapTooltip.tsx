import { getTerrainDefinition, terrainSummary } from '../../engine/terrain';
import { getProvinceLogistics, type LogisticsSnapshot } from '../../engine/logistics';
import type { Province, Country } from '../../types';
import { calculateLocalSupplyCapacity } from '../../engine/military';
import { type ArmyPresentation, type WarPresentation } from './mapPresentation';

interface GameMapTooltipProps {
  tooltip: { x: number; y: number; province: Province } | null;
  countries: Map<string, Country>;
  presentation: ArmyPresentation;
  war: WarPresentation;
  logistics?: LogisticsSnapshot;
}

export function GameMapTooltip({ tooltip, countries, presentation, war, logistics }: GameMapTooltipProps) {
  if (!tooltip) return null;
  // Read current state, rather than a province object captured before a simulation tick.
  const province = presentation.provinceById.get(tooltip.province.id) ?? tooltip.province;
  const country = countries.get(province.owner);
  const total = presentation.localTotals.get(province.id);
  const capital = war.capitals.has(province.id);
  const connection = getProvinceLogistics(logistics,province.owner,province.id);
  return <div className="map__tooltip map__tooltip--operational" role="tooltip" style={{ left: `clamp(12px, ${tooltip.x + 16}px, max(12px, calc(100% - 272px)))`, top: `clamp(64px, ${tooltip.y + 48}px, max(64px, calc(100% - ${connection ? 420 : 290}px)))` }}>
    <div className="map__tooltip-name">{province.name} {capital && <span className="map__tooltip-capital">★ Capital</span>}</div>
    <div className="map__tooltip-country"><span className="map__tooltip-color" style={{ backgroundColor: country?.color ?? province.color }} />{country?.flag} {country?.name ?? province.owner}</div>
    <p title={getTerrainDefinition(province).description}>Terreno: {getTerrainDefinition(province).label}</p>
    <small>{terrainSummary(province)}</small>
    <dl className="map__tooltip-grid">
      <dt>População</dt><dd>{province.population.total.toLocaleString('pt-BR')}</dd>
      <dt>Desenvolvimento</dt><dd>{province.development}</dd>
      <dt>Exércitos / tropas</dt><dd>{total?.count ?? 0} / {(total?.troops ?? 0).toLocaleString('pt-BR')}</dd>
      <dt>Agitação / rebelião</dt><dd>{Math.round(province.unrest ?? 0)}% / {Math.round(province.rebellion?.progress ?? 0)}%</dd>
      <dt>Supply · capacidade base</dt><dd>{calculateLocalSupplyCapacity(province).toFixed(1)}</dd>
    </dl>
    {connection && <dl className="map__tooltip-grid">
      <dt>Logística</dt><dd>{connection.connected ? 'Conectada' : 'Desconectada'}</dd>
      <dt>Origem</dt><dd>{connection.originId ? presentation.provinceById.get(connection.originId)?.name ?? connection.originId : 'Sem origem'}</dd>
      <dt>Distância</dt><dd>{connection.distance ?? '—'}</dd>
      <dt>Eficiência logística</dt><dd>{Math.round(connection.efficiency*100)}%</dd>
    </dl>}
    {(war.frontlines.has(province.id) || war.occupied.has(province.id) || war.battleProvinces.has(province.id) || war.capitalsAtRisk.has(province.id)) && <p className="map__tooltip-alert">{[war.frontlines.has(province.id) && 'Fronteira em guerra', war.occupied.has(province.id) && 'Ocupação ativa', war.battleProvinces.has(province.id) && 'Batalha em curso', war.capitalsAtRisk.has(province.id) && 'Capital em risco'].filter(Boolean).join(' · ')}</p>}
    {province.originalOwner && province.originalOwner !== province.owner && <p>Controle anterior: {countries.get(province.originalOwner)?.name ?? province.originalOwner}</p>}
  </div>;
}
