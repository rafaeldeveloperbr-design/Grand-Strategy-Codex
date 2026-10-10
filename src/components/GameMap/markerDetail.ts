export const UNIT_MARKER_COMPACT_ZOOM = 4;
export const UNIT_MARKER_FULL_ZOOM = 7;

export type MarkerDetailLevel = 'HIDDEN' | 'COMPACT' | 'FULL';

export function markerDetailLevel(mapZoom: number): MarkerDetailLevel {
  if (mapZoom < UNIT_MARKER_COMPACT_ZOOM) return 'HIDDEN';
  return mapZoom < UNIT_MARKER_FULL_ZOOM ? 'COMPACT' : 'FULL';
}

export function modeMarkerDetail(detail: MarkerDetailLevel, mode: boolean): MarkerDetailLevel {
  return mode ? (detail === 'HIDDEN' ? 'COMPACT' : 'FULL') : detail;
}
