import type { MapMetadata } from './types';

/** Shared equirectangular world space: x=(longitude+180)*14, y=(90-latitude)*14. */
export const worldMapMetadata: MapMetadata = {
  id:'world-v1',name:'World Map V1',
  bounds:{x:0,y:0,w:5040,h:2520},
  // Near-world overview; detailed labels are inspected with the existing zoom.
  initialViewBox:{x:0,y:100,w:5040,h:2300},
  defaultPlayerCountry:'BRA',
};
