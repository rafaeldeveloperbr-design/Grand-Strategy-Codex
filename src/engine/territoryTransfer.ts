import type { BuildingConstruction, Country, GameDate, Province, Recruitment } from '../types';
import { applyConquestUnrest } from './unrest';
import { normalizeRebellion } from './rebellion/rebellionUtils';

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
  const recapture = oldOwner.startsWith('rebel_') && !newOwner.startsWith('rebel_');
  const transferred = recapture
    ? { ...province, owner: newOwner, rebellion: { ...normalizeRebellion(province.rebellion), progress: 0, factionId: undefined } }
    : options.liberation
    ? { ...province, owner: newOwner, unrest: 0 }
    : applyConquestUnrest({ ...province, owner: newOwner }, options.date ?? { day: 1, month: 1, year: 1 });

  const updatedProvince: Province = {
    ...transferred,
    ...(newOwner.startsWith('rebel_v2_') ? { rebellion: { ...normalizeRebellion(transferred.rebellion), factionId: newOwner } } : {}),
    originalOwner: province.originalOwner || oldOwner,
  };

  const provinces = state.provinces.map(item => item.id === provinceId ? updatedProvince : item);
  const territories = new Map<string, string[]>();
  if (oldOwner.startsWith('rebel_') || newOwner.startsWith('rebel_')) for (const p of provinces) if (p.owner === oldOwner || p.owner === newOwner) {
    const ids = territories.get(p.owner) ?? []; ids.push(p.id); territories.set(p.owner, ids);
  }
  return {
    provinces,
    countries: state.countries.map(country => ({
      ...country,
      rebellions: country.rebellions?.map(f => {
        if (f.status !== 'active' || (f.id !== oldOwner && f.id !== newOwner)) return f;
        const ids = (territories.get(f.id) ?? []).sort();
        return { ...f, territoryEstablished: true, cleanupPending: ids.length === 0,
          baseProvince: ids.includes(f.baseProvince ?? f.originProvince) ? (f.baseProvince ?? f.originProvince) : ids[0],
          involvedProvinces: f.id === oldOwner ? f.involvedProvinces.filter(id => id !== provinceId) : Array.from(new Set([...f.involvedProvinces, provinceId])) };
      }),
      provinces: country.tag === newOwner
        ? Array.from(new Set([...country.provinces, provinceId]))
        : country.provinces.filter(id => id !== provinceId),
    })),
    recruitments: state.recruitments.filter(item => item.provinceId !== provinceId),
    constructions: state.constructions.filter(item => item.provinceId !== provinceId),
  };
}
