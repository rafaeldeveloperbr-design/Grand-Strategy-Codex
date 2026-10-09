import { mapMetadata, mapRegions } from '../../data/map';
import type { MapViewBox } from '../../data/map/types';
import type { Country, Province } from '../../types';
import { getCountryInitialView } from '../../engine/countrySelection';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 64;
export const DEFAULT_ZOOM = 1;
export const DRAG_THRESHOLD = 5;
export const PAN_MARGIN = .15;
export function clampView(box: MapViewBox): MapViewBox {
  const world = mapMetadata.bounds;
  const axis = (start: number, size: number, origin: number, extent: number) => size >= extent
    ? origin + (extent - size) / 2
    : Math.max(origin - size * PAN_MARGIN, Math.min(origin + extent - size + size * PAN_MARGIN, start));
  return { ...box, x: axis(box.x, box.w, world.x, world.w), y: axis(box.y, box.h, world.y, world.h) };
}
export function zoomView(box: MapViewBox, u: number, v: number, delta: number): MapViewBox {
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, mapMetadata.initialViewBox.w / box.w * Math.exp(-delta)));
  const w = mapMetadata.initialViewBox.w / zoom, h = box.h * w / box.w;
  return clampView({ x: box.x + (box.w - w) * u, y: box.y + (box.h - h) * v, w, h });
}
export function fitCameraBounds(bounds: MapViewBox, aspect: number, padding = .15): MapViewBox {
  const w = Math.max(mapMetadata.initialViewBox.w / MAX_ZOOM, Math.min(mapMetadata.initialViewBox.w / MIN_ZOOM, Math.max(bounds.w, bounds.h * aspect) * (1 + padding * 2)));
  const h = w / aspect;
  return clampView({ x: bounds.x + bounds.w / 2 - w / 2, y: bounds.y + bounds.h / 2 - h / 2, w, h });
}
export function countryFocusBounds(country: Country, provinces: Province[]) { return getCountryInitialView(country, provinces); }
export function boundsOfPoints(points: readonly { x: number; y: number }[]): MapViewBox {
  const xs = points.map(p => p.x), ys = points.map(p => p.y), x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(1, Math.max(...xs) - x), h: Math.max(1, Math.max(...ys) - y) };
}
export const regionalBounds = Object.fromEntries(['Americas', 'Europe', 'Africa', 'Asia', 'Oceania'].map(name => {
  const regions = mapRegions.filter(r => name === 'Americas' ? /america/i.test(r.id) : r.id === name.toLowerCase());
  return [name, boundsOfPoints(regions.flatMap(r => r.geometry.map(p => p.center)))];
}));
export function blocksMapKeyboard(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [role="slider"], [role="menu"]');
}
