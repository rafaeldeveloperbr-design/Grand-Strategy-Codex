import { MAP_MODES, numericMapColor, type MapMode } from './mapPresentation';

export function MapModeBar({ mode, onChange, max }: { mode: MapMode; onChange: (mode: MapMode) => void; max: number }) {
  const definition = MAP_MODES.find(item => item.id === mode)!;
  const format = (value: number) => mode === 'population' ? value.toLocaleString('pt-BR') : `${Number(value.toFixed(1))}${mode === 'unrest' ? '%' : ''}`;
  return <div className="map-modes">
    <div className="map-modes__buttons" role="group" aria-label="Modos do mapa">
      {MAP_MODES.map(item => <button key={item.id} type="button" aria-pressed={mode === item.id} aria-label={`Modo ${item.label}`} title={item.description} onClick={() => onChange(item.id)}>{item.label}</button>)}
    </div>
    {mode !== 'political' && <div className="map-modes__legend" aria-label={`Legenda ${definition.label}`}>
      <span>{format(0)}</span><span className="map-modes__scale" style={{ background: `linear-gradient(90deg, ${numericMapColor(0, max, mode)}, ${numericMapColor(max / 2, max, mode)}, ${numericMapColor(max, max, mode)})` }} /><span>{format(max)}</span>
      <small>{mode === 'supply' ? 'Capacidade base · sem demanda/acesso' : mode === 'unrest' ? 'Agitação / organização rebelde' : definition.label}</small>
    </div>}
  </div>;
}
