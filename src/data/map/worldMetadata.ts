import type { MapMetadata } from './types';

/** Shared equirectangular world space: x=(longitude+180)*14, y=(90-latitude)*14. */
export const worldMapMetadata: MapMetadata = {
  id:'world-v1',name:'World Map V1',
  bounds:{x:0,y:0,w:5040,h:2520},
  // Overview of the four active regions; zoom remains available for dense Europe.
  initialViewBox:{x:500,y:100,w:2900,h:2050},
  defaultPlayerCountry:'BRA',
};
