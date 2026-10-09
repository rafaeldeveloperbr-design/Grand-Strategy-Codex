import { useState, useRef, useEffect, useCallback, type RefObject } from 'react';
import { mapMetadata } from '../../data/map';
import type { MapViewBox } from '../../data/map/types';
import type { Country, Province } from '../../types';
import { clampView, zoomView, fitCameraBounds, countryFocusBounds, DRAG_THRESHOLD } from './camera';

export function useMapControls(svgRef?: RefObject<SVGSVGElement>, initialViewBox: MapViewBox = mapMetadata.initialViewBox) {
  const [viewBox, setViewBox] = useState({ ...initialViewBox });
  const [isPanning, setIsPanning] = useState(false);
  const viewRef = useRef(viewBox);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const isDragging = useCallback(() => !!drag.current?.moved, []);
  const update = useCallback((fn: (box: MapViewBox) => MapViewBox) => {
    const next = fn(viewRef.current); viewRef.current = next; setViewBox(next);
  }, []);
  const scale = useCallback(() => {
    const rect = svgRef?.current?.getBoundingClientRect(), box = viewRef.current;
    return rect?.width && rect.height ? Math.min(rect.width / box.w, rect.height / box.h) : 1;
  }, [svgRef]);
  const zoomAt = useCallback((screenX: number, screenY: number, delta: number) => {
    const rect = svgRef?.current?.getBoundingClientRect(), box = viewRef.current, s = scale();
    const u = rect?.width ? (screenX - rect.left - (rect.width - box.w * s) / 2) / (box.w * s) : .5;
    const v = rect?.height ? (screenY - rect.top - (rect.height - box.h * s) / 2) / (box.h * s) : .5;
    update(prev => zoomView(prev, u, v, delta));
  }, [svgRef, scale, update]);
  const zoomCenter = useCallback((delta: number) => update(box => zoomView(box, .5, .5, delta)), [update]);
  const panBy = useCallback((dx: number, dy: number) => {
    const s = scale(); update(box => clampView({ ...box, x: box.x + dx / s, y: box.y + dy / s }));
  }, [scale, update]);
  const fitBounds = useCallback((bounds: MapViewBox, padding = .15) => {
    const rect = svgRef?.current?.getBoundingClientRect();
    const aspect = rect?.width && rect.height ? rect.width / rect.height : viewRef.current.w / viewRef.current.h;
    update(() => fitCameraBounds(bounds, aspect, padding));
  }, [svgRef, update]);
  const focusWorldPoint = useCallback((point: { x: number; y: number }, width = 360) => fitBounds({ x: point.x - width / 2, y: point.y - width / 4, w: width, h: width / 2 }, 0), [fitBounds]);
  const focusProvince = useCallback((province: Province) => focusWorldPoint(province.center, 160), [focusWorldPoint]);
  const focusCountry = useCallback((country: Country, provinces: Province[]) => {
    const bounds = countryFocusBounds(country, provinces); if (bounds) fitBounds(bounds);
  }, [fitBounds]);
  const resetView = useCallback(() => update(() => ({ ...mapMetadata.initialViewBox })), [update]);
  const handleMouseUp = useCallback(() => { drag.current = null; setIsPanning(false); }, []);
  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp); window.addEventListener('blur', handleMouseUp);
    const svg = svgRef?.current;
    const wheel = (event: WheelEvent) => { event.preventDefault(); zoomAt(event.clientX, event.clientY, Math.max(-.5, Math.min(.5, event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 500 : 1) * .002))); };
    svg?.addEventListener('wheel', wheel, { passive: false });
    const resize = () => update(box => clampView(box));
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (svg) observer?.observe(svg);
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('mouseup', handleMouseUp); window.removeEventListener('blur', handleMouseUp); svg?.removeEventListener('wheel', wheel); observer?.disconnect(); window.removeEventListener('resize', resize); };
  }, [svgRef, handleMouseUp, zoomAt, update]);
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    suppressClick.current = false;
    drag.current = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false };
    if (e.button === 1) e.preventDefault?.();
  };
  const handleMouseMovePan = (e: React.MouseEvent) => {
    const d = drag.current; if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return;
    d.moved = true; suppressClick.current = true; setIsPanning(true);
    panBy(d.x - e.clientX, d.y - e.clientY); d.x = e.clientX; d.y = e.clientY;
  };
  const handleClickCapture = (e: React.MouseEvent) => {
    if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); suppressClick.current = false; }
  };
  return { viewBox, isPanning, isDragging, unitsPerPixel: 1 / scale(), zoomAt, panBy, fitBounds, focusWorldPoint, focusProvince, focusCountry, resetView,
    handleZoomIn: () => zoomCenter(Math.log(.8)), handleZoomOut: () => zoomCenter(Math.log(1.25)), handleResetZoom: resetView,
    handleMouseDown, handleMouseMovePan, handleMouseUp, handleClickCapture };
}
