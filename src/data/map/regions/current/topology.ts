import type { ProvinceTopology } from '../../types';

// Explicit movement edges; never inferred from SVG geometry.
export const provinceTopology: ProvinceTopology[] = [
  { id: 'p1', neighbors: ['p2', 'p6', 'p10'] },
  { id: 'p2', neighbors: ['p1', 'p3', 'p11'] },
  { id: 'p3', neighbors: ['p2', 'p4', 'p14'] },
  { id: 'p4', neighbors: ['p3', 'p5', 'p15'] },
  { id: 'p5', neighbors: ['p4', 'p9', 'p16'] },
  { id: 'p6', neighbors: ['p1', 'p7', 'p10', 'p12'] },
  { id: 'p7', neighbors: ['p6', 'p8', 'p12'] },
  { id: 'p8', neighbors: ['p7', 'p9', 'p17'] },
  { id: 'p9', neighbors: ['p5', 'p8', 'p16', 'p18'] },
  { id: 'p10', neighbors: ['p1', 'p6', 'p11'] },
  { id: 'p11', neighbors: ['p2', 'p10', 'p12', 'p14'] },
  { id: 'p12', neighbors: ['p6', 'p7', 'p10', 'p11'] },
  { id: 'p14', neighbors: ['p3', 'p11', 'p15'] },
  { id: 'p15', neighbors: ['p4', 'p14', 'p16'] },
  { id: 'p16', neighbors: ['p5', 'p9', 'p15', 'p18', 'p20'] },
  { id: 'p17', neighbors: ['p8', 'p18'] },
  { id: 'p18', neighbors: ['p9', 'p16', 'p17', 'p19'] },
  { id: 'p19', neighbors: ['p16', 'p18', 'p22'] },
  { id: 'p20', neighbors: ['p16', 'p19', 'p21'] },
  { id: 'p21', neighbors: ['p20', 'p22', 'p19'] },
  { id: 'p22', neighbors: ['p19', 'p21'] },
];
