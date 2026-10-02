// src/engine/saveSystem.ts - V2 Tipado e Versionado com fronteira unknown
import type { Province, Country, GameDate, Army, Recruitment, BuildingConstruction, ActiveBattle } from '../types';
import type { CountryTechState } from '../types/technology';
import type { DiplomaticRelation, War } from '../types/diplomacy';

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
  relations: DiplomaticRelation[];
  recruitments: Recruitment[];
  constructions: BuildingConstruction[];
  playerTech: CountryTechState;
  botTechs: Map<string, CountryTechState> | Record<string, CountryTechState>;
  activeBattles: ActiveBattle[];
};

export type SaveGameV2 = {
  version: 2;
  id: string;
  name: string;
  timestamp: number;
  date: GameDate;
  world: { provinces: Province[]; countries: Country[] };
  military: { armies: Army[]; wars: War[]; activeBattles: ActiveBattle[]; recruitments: Recruitment[] };
  diplomacy: { relations: DiplomaticRelation[] };
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
  return { ...save, technology: { player: save.technology.player, bots: Array.from(save.technology.bots.entries()) } };
}
function deserializeV2(raw: SerializedSaveGameV2): SaveGameV2 {
  return { ...raw, technology: { player: raw.technology.player, bots: new Map(raw.technology.bots) } };
}
function migrateV1ToV2(v1: SaveGameV1): SaveGameV2 {
  const botTechsMap = v1.botTechs instanceof Map ? v1.botTechs : new Map(Object.entries(v1.botTechs as Record<string, CountryTechState>));
  return {
    version: 2, id: v1.id, name: v1.name, timestamp: v1.timestamp, date: v1.date,
    world: { provinces: v1.provinces, countries: v1.countries },
    military: { armies: v1.armies, wars: v1.wars, activeBattles: v1.activeBattles, recruitments: v1.recruitments },
    diplomacy: { relations: v1.relations },
    economy: { constructions: v1.constructions },
    technology: { player: v1.playerTech, bots: botTechsMap },
  };
}

// ============ LOAD COM DETECÇÃO DE VERSÃO + UNKNOWN ============
function parseRawSave(rawString: string): SaveGameV2 | null {
  try {
    const parsed: unknown = JSON.parse(rawString);

    // V1 - legado sem version ou version 1
    if (isSaveGameV1(parsed)) {
      if (!parsed.version || parsed.version === 1) {
        return migrateV1ToV2(parsed);
      }
    }
    // V2
    if (isSerializedV2(parsed)) {
      return deserializeV2(parsed);
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
  const save: SaveGameV2 = {
    version: CURRENT_VERSION, id: slotId, name: customName || (slotId === AUTO_SAVE_KEY ? 'Autosave' : `Save ${new Date(now).toLocaleString('pt-BR')}`),
    timestamp: now, date: refs.dateRef.current,
    world: { provinces: refs.provincesRef.current, countries: refs.countriesRef.current },
    military: { armies: refs.armiesRef.current, wars: refs.warsRef.current, activeBattles: refs.activeBattlesRef.current, recruitments: refs.recruitmentsRef.current },
    diplomacy: { relations: refs.diplomaticRelationsRef.current },
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