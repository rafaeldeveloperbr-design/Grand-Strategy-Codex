import type { Country, Province } from '../../types';
import type { AirState, AircraftType } from '../../types/air';
import { AIR_PRODUCTION_CONFIG } from '../../data/aircraft';
import { airBaseByProvinceId, airBaseOccupancy, airProductionBlockReason } from '../../engine/air';

const labels: Record<AircraftType, string> = { FIGHTER: 'Fighter', CAS: 'CAS', BOMBER: 'Bomber', TRANSPORT_PLANE: 'Transport' };
export function ProvinceAirProduction({ state, province, country, actor, onBuild, onCancel }: { state: AirState; province: Province; country: Country; actor: string; onBuild?: (provinceId: string, type: AircraftType) => void; onCancel?: (id: string) => void }) {
  const base = airBaseByProvinceId.get(province.id);
  if (!base) return null;
  const queue = state.production?.queues[province.id] ?? [];
  const used = airBaseOccupancy(state, province.id);
  return <section className="air-production" aria-label="Aircraft Production">
    <strong>AIRCRAFT PRODUCTION</strong>
    <p>Base nível {base.level} · Slots {used}/{base.capacity} (inclui rebase)</p>
    <p>Ouro {country.resources.gold.toFixed(0)} · IRON {province.market?.goods.iron.stock.toFixed(0) ?? 0} · TOOLS {province.market?.goods.tools.stock.toFixed(0) ?? 0}</p>
    {(Object.keys(AIR_PRODUCTION_CONFIG) as AircraftType[]).map(type => {
      const cost = AIR_PRODUCTION_CONFIG[type], reason = airProductionBlockReason(state, province, country, actor, type);
      return <div key={type} className="air-production__option" title={reason ?? '24 aeronaves; conclusão aguarda capacidade livre.'}>
        <button disabled={!!reason || !onBuild} onClick={() => onBuild?.(province.id, type)}>Build {labels[type]} Wing</button>
        <small>{cost.gold} ouro · {cost.iron} IRON · {cost.tools} TOOLS · {cost.days} dias{reason && ` · ${reason}`}</small>
      </div>;
    })}
    <p>Fila {queue.length}/5 · Cancelar não reembolsa recursos.</p>
    {queue.map((order, index) => <div key={order.id} className="air-production__order">
      <span>{index + 1}. {labels[order.type]} · {index === 0 ? order.progress === order.requiredProgress ? 'Aguardando capacidade' : `${order.requiredProgress - order.progress} dias restantes` : 'Na fila'}</span>
      <progress aria-label={`Production ${order.id}`} value={order.progress} max={order.requiredProgress}/>
      {order.countryTag === actor && <button aria-label={`Cancel ${order.id}`} onClick={() => onCancel?.(order.id)}>Cancelar</button>}
    </div>)}
  </section>;
}
