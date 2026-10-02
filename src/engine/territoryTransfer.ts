import type { BuildingConstruction, Country, GameDate, Province, Recruitment } from '../types';
import { applyConquestUnrest } from './unrest';

export type TerritoryTransferState = {
  provinces: Province[];
  countries: Country[];
  recruitments: Recruitment[];
  constructions: BuildingConstruction[];
};

/**
 * The single state transition used whenever control of a province changes.
 * Keeping this operation pure makes it impossible to update the map without
 * also updating country indexes and cancelling the former owner's activities.
 */
export function transferProvince(
  state: TerritoryTransferState,
  provinceId: string,
  newOwner: string,
  options: { date?: GameDate; liberation?: boolean } = {}
): TerritoryTransferState {
  const province = state.provinces.find(item => item.id === provinceId);
  if (!province || province.owner === newOwner) return state;

  const oldOwner = province.owner;
  const transferred = options.liberation
    ? { ...province, owner: newOwner, unrest: 0 }
    : applyConquestUnrest({ ...province, owner: newOwner }, options.date ?? { day: 1, month: 1, year: 1 });

  const updatedProvince: Province = {
    ...transferred,
    originalOwner: province.originalOwner || oldOwner,
  };

  return {
    provinces: state.provinces.map(item => item.id === provinceId ? updatedProvince : item),
    countries: state.countries.map(country => ({
      ...country,
      provinces: country.tag === newOwner
        ? Array.from(new Set([...country.provinces, provinceId]))
        : country.provinces.filter(id => id !== provinceId),
    })),
    recruitments: state.recruitments.filter(item => item.provinceId !== provinceId),
    constructions: state.constructions.filter(item => item.provinceId !== provinceId),
  };
}
