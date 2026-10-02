import type { Army, BuildingConstruction, Country, GameDate, Province, Recruitment } from '../types';
import { applyConquestUnrest } from './unrest';

type TransferTerritoryParams = {
  provinceId: string;
  newOwner: string;
  provinces: Province[];
  countries: Country[];
  recruitments: Recruitment[];
  constructions: BuildingConstruction[];
  date: GameDate;
  liberation?: boolean;
};

/**
 * Único caminho de mutação territorial usado por chegada e combate.
 * Mantém Province.owner, Country.provinces, unrest e filas sincronizados.
 */
export function transferProvinceControl(params: TransferTerritoryParams) {
  const province = params.provinces.find(p => p.id === params.provinceId);
  if (!province || province.owner === params.newOwner) {
    return {
      provinces: params.provinces,
      countries: params.countries,
      recruitments: params.recruitments,
      constructions: params.constructions,
      oldOwner: province?.owner ?? null,
      changed: false,
    };
  }

  const oldOwner = province.owner;
  const provinces = params.provinces.map(p => {
    if (p.id !== params.provinceId) return p;
    const transferred = params.liberation
      ? { ...p, owner: params.newOwner, unrest: 0 }
      : applyConquestUnrest({ ...p, owner: params.newOwner }, params.date);
    return { ...transferred, originalOwner: p.originalOwner || oldOwner };
  });

  const countries = params.countries.map(country => {
    if (country.tag === params.newOwner) {
      return {
        ...country,
        provinces: Array.from(new Set([...country.provinces, params.provinceId])),
      };
    }
    if (country.tag === oldOwner) {
      return {
        ...country,
        provinces: country.provinces.filter(id => id !== params.provinceId),
      };
    }
    return country;
  });

  return {
    provinces,
    countries,
    recruitments: params.recruitments.filter(r => r.provinceId !== params.provinceId),
    constructions: params.constructions.filter(c => c.provinceId !== params.provinceId),
    oldOwner,
    changed: true,
  };
}

export function getArrivalConqueror(army: Army, province: Province, atWar: boolean): {
  owner: string;
  liberation: boolean;
} | null {
  if (army.owner.startsWith('rebel_')) {
    const originalOwner = army.originalOwner;
    if (originalOwner && province.originalOwner === originalOwner && province.owner !== originalOwner) {
      return { owner: originalOwner, liberation: true };
    }
    return null;
  }

  return atWar ? { owner: army.owner, liberation: false } : null;
}
