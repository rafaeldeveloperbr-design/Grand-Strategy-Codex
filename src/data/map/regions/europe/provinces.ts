import type { ProvinceGameplay } from '../../types';
import { createProvinceGameplay } from '../../provinceGameplay';
import { countries } from './countries';
import { definitions } from './definitions';
import { EUROPE_TERRAIN } from './terrain';

const colors = new Map(countries.map(c => [c.tag,c.color]));
export const provinceGameplay: ProvinceGameplay[] = definitions.map(([id,name,owner,population,development]) =>
  createProvinceGameplay([id,name,owner,population,development],EUROPE_TERRAIN[id],colors.get(owner)!),
);
