import { resolveBuildingType, normalizeBuildingLevel } from '../data/buildings';
import { migrateDiplomacy } from './diplomacy';
import { initializePolitics } from './politics';
// src/engine/saveSystem.ts - V2 Tipado e Versionado com fronteira unknown
import type { Province, Country, GameDate, Army, Recruitment, BuildingConstruction, ActiveBattle } from '../types';
import type { CountryTechState } from '../types/technology';
import type { DiplomaticRelation, War } from '../types/diplomacy';
import { normalizeSavedFactions, normalizeSavedRebellion, migrateLegacyRebels } from './rebellion';
import { isTerrainType } from './terrain';
import { normalizePopulation } from './population';
import { normalizeMarket } from './market';
import { normalizeTechState } from './technology';
import { normalizeActiveLaws } from './government';
import { normalizeNationalTrade } from './economy/tradeState';
import { mapMetadata, mapCapitals, provincesData } from '../data/map';

// ============ META ============
export type SaveMeta = {
  id: string;
  name: string;
  timestamp: number;
  date: GameDate;
  version: number;
  day?: number;
  month?: number;
  year?: number;
  ts?: number;
};
export type SaveListItem = SaveMeta;

// ============ TIPOS V1/V2 ============
export type SaveGameV1 = {
  version?: 1;
  id: string;
  name: string;
  timestamp: number;
  date: GameDate;
  provinces: Province[];
  countries: Country[];
  armies: Army[];
  wars: War[];
  relations: unknown[];
  recruitments: Recruitment[];
  constructions: BuildingConstruction[];
  playerTech: CountryTechState;
  botTechs: Map<string, CountryTechState> | Record<string, CountryTechState>;
  activeBattles: ActiveBattle[];
};

export type SaveGameV2 = {
  version: 2;
  mapId?: string;
  id: string;
  name: string;
  timestamp: number;
  date: GameDate;
  world: { provinces: Province[]; countries: Country[] };
  military: { armies: Army[]; wars: War[]; activeBattles: ActiveBattle[]; recruitments: Recruitment[] };
  diplomacy: { version?: 2; relations: DiplomaticRelation[] };
  economy: { constructions: BuildingConstruction[] };
  technology: { player: CountryTechState; bots: Map<string, CountryTechState> };
};

type SerializedSaveGameV2 = Omit<SaveGameV2, 'technology'> & {
  technology: { player: CountryTechState; bots: [string, CountryTechState][] };
};

export type AnySaveGame = SaveGameV1 | SaveGameV2;
export type LatestSaveGame = SaveGameV2;

const SAVE_PREFIX = 'imperium_save_';
const AUTO_SAVE_KEY = 'autosave';
const AUTO_SAVE_ENABLED_KEY = 'imperium_autosave_enabled';
const CURRENT_VERSION = 2 as const;

// ============ TYPE GUARDS - FRONTEIRA SEGURA ============
function isGameDate(v: unknown): v is GameDate {
  if (typeof v !== 'object' || v === null) return false;
  const d = v as Record<string, unknown>;
  return typeof d.day === 'number' && typeof d.month === 'number' && typeof d.year === 'number';
}

type SaveMetaPayload = { id?: string; name?: string; timestamp?: number; date?: GameDate; version?: number };

function isSaveMetaPayload(value: unknown): value is SaveMetaPayload {
  if (typeof value !== 'object' || value === null) return false;
  return isGameDate((value as Record<string, unknown>).date);
}

function isSaveGameV1(value: unknown): value is SaveGameV1 {
  if (typeof value !== 'object' || value === null) return false;
  const d = value as Record<string, unknown>;
  return isGameDate(d.date) && typeof d.id === 'string' && Array.isArray(d.provinces);
}

function isSerializedV2(value: unknown): value is SerializedSaveGameV2 {
  if (typeof value !== 'object' || value === null) return false;
  const d = value as Record<string, unknown>;
  return d.version === 2 && isGameDate(d.date) && typeof d.world === 'object';
}

// ============ SERIALIZAÇÃO ============
function serializeV2(save: SaveGameV2): SerializedSaveGameV2 {
  return { ...save, world: { ...save.world, provinces: save.world.provinces.map(province => {
    const base = provincesData.find(item => item.id === province.id);
    if (base?.terrain !== province.terrain) return province;
    const copy = { ...province }; delete copy.terrain; return copy;
  }) }, technology: { player: save.technology.player, bots: Array.from(save.technology.bots.entries()) } };
}
function deserializeV2(raw: SerializedSaveGameV2): SaveGameV2 {
  return {
    ...raw,
    economy: { constructions: migrateBuildingConstructions(raw.economy.constructions) },
    world: { ...raw.world, provinces: raw.world.provinces.map(normalizeSavedProvince), countries: raw.world.countries.map(normalizeSavedCountry) },
    technology: { player: normalizeTechState(raw.technology.player), bots: new Map(raw.technology.bots.map(([tag, state]) => [tag, normalizeTechState(state, tag)])) },
  };
}
function normalizeSavedCountry(country: Country): Country {
  // Legacy capital inference is confined to loading, never normal AI logic.
  const knownCapital = mapCapitals[country.tag];
  const capitalId = country.capitalId ?? country.capital ??
    (country.provinces.includes(knownCapital) ? knownCapital : country.provinces[0]);
  return initializePolitics({ ...country, capitalId, trade: normalizeNationalTrade(country.trade), rebellions: normalizeSavedFactions(country.rebellions), activeLaws: normalizeActiveLaws(country.activeLaws) });
}
export function migrateLegacyBuildings(buildings: Province['buildings']): Province['buildings'] {
  const merged = new Map<string, Province['buildings'][number]>();
  for (const raw of buildings ?? []) {
    const type = resolveBuildingType(raw.type);
    if (!type) continue;
    const key = `${type}_${raw.daysRemaining > 0 ? 'pending' : 'completed'}`;
    const prior = merged.get(key);
    if (!prior || normalizeBuildingLevel(raw.level) > prior.level) merged.set(key, { ...raw, type, level: normalizeBuildingLevel(raw.level) });
  }
  return [...merged.values()];
}
/** Renames only the type: paid costs, progress, ids and order stay intact. */
export function migrateBuildingConstructions(constructions: BuildingConstruction[]): BuildingConstruction[] {
  return (constructions ?? []).flatMap(item => {
    const buildingType = resolveBuildingType(item.buildingType);
    return buildingType ? [{ ...item, buildingType }] : [];
  });
}
function normalizeSavedProvince(province: Province): Province {
  return {
    ...province,
    terrain: isTerrainType(province.terrain) ? province.terrain : provincesData.find(base => base.id === province.id)?.terrain ?? 'plains',
    rebellion: normalizeSavedRebellion(province.rebellion),
    unrestExplanation: undefined,
    buildings: migrateLegacyBuildings(province.buildings),
    population: normalizePopulation(province.population as Province['population'] | number),
    market: normalizeMarket(province.market),
  };
}
function migrateV1ToV2(v1: SaveGameV1): SaveGameV2 {
  const botTechsMap = v1.botTechs instanceof Map ? v1.botTechs : new Map(Object.entries(v1.botTechs as Record<string, CountryTechState>));
  return {
    version: 2, id: v1.id, name: v1.name, timestamp: v1.timestamp, date: v1.date,
    world: { provinces: v1.provinces.map(normalizeSavedProvince), countries: v1.countries.map(normalizeSavedCountry) },
    military: { armies: v1.armies, wars: v1.wars, activeBattles: v1.activeBattles, recruitments: v1.recruitments },
    diplomacy: { relations: migrateDiplomacy(v1.relations,v1.wars,v1.date) },
    economy: { constructions: migrateBuildingConstructions(v1.constructions) },
    technology: { player: normalizeTechState(v1.playerTech), bots: new Map([...botTechsMap].map(([tag,state]) => [tag, normalizeTechState(state, tag)])) },
  };
}

function migrateRebellionSave(save: SaveGameV2): SaveGameV2 {
  const migrated = migrateLegacyRebels(save.world.provinces, save.world.countries, save.military.armies, save.date);
  const tags = new Map<string, string>();
  save.military.armies.forEach((army, index) => {
    if (typeof army.owner === 'string' && army.owner !== migrated.armies[index].owner) tags.set(army.owner, migrated.armies[index].owner);
  });
  const rename = (tag: string): string => tags.get(tag) ?? tag;
  const normalizedRelations = migrateDiplomacy(save.diplomacy?.relations,save.military.wars,save.date);
  const snapshot = (army?: Army): Army | undefined => army ? { ...army, owner: rename(army.owner) } : undefined;
  return { ...save, world: { provinces: migrated.provinces, countries: migrated.countries },
    military: { ...save.military, armies: migrated.armies,
      wars: save.military.wars.map(war => ({ ...war, attacker: rename(war.attacker), defender: rename(war.defender) })),
      activeBattles: save.military.activeBattles.map(battle => ({ ...battle,
        attackerCountryId: rename(battle.attackerCountryId), defenderCountryId: rename(battle.defenderCountryId),
        attackerInitialSnapshot: snapshot(battle.attackerInitialSnapshot), defenderInitialSnapshot: snapshot(battle.defenderInitialSnapshot) })) },
    diplomacy: { version: 2, relations: migrateDiplomacy(normalizedRelations.map(relation => ({ ...relation, countryA: rename(relation.countryA), countryB: rename(relation.countryB) })),
      save.military.wars.map(war => ({...war,attacker: rename(war.attacker),defender: rename(war.defender)})),save.date) } };
}

// ============ LOAD COM DETECÇÃO DE VERSÃO + UNKNOWN ============
function parseRawSave(rawString: string): SaveGameV2 | null {
  try {
    const parsed: unknown = JSON.parse(rawString);

    // V1 - legado sem version ou version 1
    if (isSaveGameV1(parsed)) {
      if (!parsed.version || parsed.version === 1) {
        return migrateRebellionSave(migrateV1ToV2(parsed));
      }
    }
    // V2
    if (isSerializedV2(parsed)) {
      return migrateRebellionSave(deserializeV2(parsed));
    }

    console.warn(`Save com formato desconhecido ou corrompido`);
    return null;
  } catch (e) {
    console.error('Erro ao parsear save', e);
    return null;
  }
}

// ============ API PÚBLICA ============
type SaveGameRefs = {
  provincesRef: { current: Province[] }; countriesRef: { current: Country[] }; armiesRef: { current: Army[] };
  warsRef: { current: War[] }; diplomaticRelationsRef: { current: DiplomaticRelation[] };
  recruitmentsRef: { current: Recruitment[] }; buildingConstructionsRef: { current: BuildingConstruction[] };
  playerTechStateRef: { current: CountryTechState }; botTechStatesRef: { current: Map<string, CountryTechState> };
  activeBattlesRef: { current: ActiveBattle[] }; dateRef: { current: GameDate };
};

export function saveGame(refs: SaveGameRefs, slotId: string = AUTO_SAVE_KEY, customName?: string) {
  const now = Date.now();
  const activeIds = new Set(provincesData.map(province => province.id));
  const isActiveMap = refs.provincesRef.current.length === activeIds.size &&
    refs.provincesRef.current.every(province => activeIds.has(province.id));
  const save: SaveGameV2 = {
    mapId: isActiveMap ? mapMetadata.id : undefined,
    version: CURRENT_VERSION, id: slotId, name: customName || (slotId === AUTO_SAVE_KEY ? 'Autosave' : `Save ${new Date(now).toLocaleString('pt-BR')}`),
    timestamp: now, date: refs.dateRef.current,
    world: { provinces: refs.provincesRef.current, countries: refs.countriesRef.current },
    military: { armies: refs.armiesRef.current, wars: refs.warsRef.current, activeBattles: refs.activeBattlesRef.current, recruitments: refs.recruitmentsRef.current },
    diplomacy: { version: 2, relations: refs.diplomaticRelationsRef.current },
    economy: { constructions: refs.buildingConstructionsRef.current },
    technology: { player: refs.playerTechStateRef.current, bots: refs.botTechStatesRef.current },
  };
  localStorage.setItem(SAVE_PREFIX + slotId, JSON.stringify(serializeV2(save)));
}

export function loadGame(slotId: string): SaveGameV2 | null {
  const rawString = localStorage.getItem(SAVE_PREFIX + slotId);
  if (!rawString) return null;
  return parseRawSave(rawString);
}

export function listSaves(): SaveMeta[] {
  const saves: SaveMeta[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(SAVE_PREFIX)) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      if (!isSaveMetaPayload(parsed)) {
        console.warn(`Save corrompido ignorado: ${key}`);
        continue;
      }
      saves.push({
        id: parsed.id || key.replace(SAVE_PREFIX, ''),
        name: parsed.name || key,
        timestamp: parsed.timestamp || 0,
        date: parsed.date!,
        version: parsed.version || 1,
        day: parsed.date!.day, month: parsed.date!.month, year: parsed.date!.year,
        ts: parsed.timestamp,
      });
    } catch { continue; }
  }
  return saves.sort((a,b) => b.timestamp - a.timestamp);
}

export function deleteSave(slotId: string) { localStorage.removeItem(SAVE_PREFIX + slotId); }
export function clearAllSaves() { listSaves().forEach(s => deleteSave(s.id)); }
export function isAutoSaveEnabled(): boolean { const v = localStorage.getItem(AUTO_SAVE_ENABLED_KEY); return v === null ? true : v === 'true'; }
export function setAutoSaveEnabled(v: boolean) { localStorage.setItem(AUTO_SAVE_ENABLED_KEY, String(v)); }
