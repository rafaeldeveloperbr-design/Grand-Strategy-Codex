// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { CURRENT_VERSION, loadGame, saveGame } from '../saveSystem';
import { createInitialTechState, normalizeTechState } from '../technology';

beforeEach(() => localStorage.clear());
const legacy = (tag = 'TST', activeResearchId: string | null = 'education', researchProgressDays = 15) => ({countryTag:tag,activeFocusId:null,focusProgressDays:0,completedFocuses:[],completedTechnologies:['sanitation'],activeResearchId,researchProgressDays});
const metadata = {id:'slots',name:'Slots',timestamp:1,date:{day:1,month:1,year:1836}};
const structured = (version: number, player: unknown, bot: unknown) => ({...metadata,version,world:{provinces:[],countries:[]},military:{armies:[],wars:[],activeBattles:[],recruitments:[]},diplomacy:{relations:[]},economy:{constructions:[]},technology:{player,bots:[['BOT',bot]]}});
const store = (save: unknown) => localStorage.setItem('imperium_save_slots',JSON.stringify(save));

describe('Research Slots save migration', () => {
  it.each([1,2])('migrates V%i player and bots into slot 0 preserving progress and completed technologies', version => {
    const player = legacy(); const bot = legacy('BOT','improved_agriculture',7);
    store(version === 1 ? {...metadata,version,provinces:[],countries:[],armies:[],wars:[],activeBattles:[],recruitments:[],relations:[],constructions:[],playerTech:player,botTechs:{BOT:bot}} : structured(version,player,bot));
    const loaded = loadGame('slots')!;
    expect(loaded.version).toBe(3);
    expect(loaded.technology.player.researchSlots).toEqual([{id:0,technologyId:'education',progressDays:15}]);
    expect(loaded.technology.player.completedTechnologies).toEqual(['sanitation']);
    expect(loaded.technology.bots.get('BOT')?.researchSlots).toEqual([{id:0,technologyId:'improved_agriculture',progressDays:7}]);
    expect(loaded.technology.player).not.toHaveProperty('activeResearchId');
  });
  it.each([1,2])('migrates V%i empty research and completed academies to effective capacity', version => {
    const player = {...legacy('TST',null,15),completedFocuses:['focus_national_academies']};
    store(version === 1 ? {...metadata,version,provinces:[],countries:[],armies:[],wars:[],activeBattles:[],recruitments:[],relations:[],constructions:[],playerTech:player,botTechs:{BOT:player}} : structured(version,player,player));
    const loaded = loadGame('slots')!;
    expect(loaded.technology.player.researchSlots).toEqual([{id:0,technologyId:null,progressDays:0},{id:1,technologyId:null,progressDays:0}]);
    expect(loaded.technology.bots.get('BOT')?.researchSlots).toHaveLength(2);
  });
  it('round-trips independent V3 player and bot slots using the public save API', () => {
    const player = normalizeTechState({...createInitialTechState('TST'),completedFocuses:['focus_national_academies'],researchSlots:[{id:0,technologyId:'education',progressDays:12.5},{id:1,technologyId:'sanitation',progressDays:7}]});
    const bot = normalizeTechState({...player,countryTag:'BOT',researchSlots:[{id:0,technologyId:null,progressDays:0},{id:1,technologyId:'improved_agriculture',progressDays:4}]});
    const refs: Parameters<typeof saveGame>[0] = {dateRef:{current:metadata.date},provincesRef:{current:[]},countriesRef:{current:[]},armiesRef:{current:[]},warsRef:{current:[]},activeBattlesRef:{current:[]},recruitmentsRef:{current:[]},buildingConstructionsRef:{current:[]},diplomaticRelationsRef:{current:[]},playerTechStateRef:{current:player},botTechStatesRef:{current:new Map([['BOT',bot]])}};
    expect(CURRENT_VERSION).toBe(3); expect(saveGame(refs,'slots')).toBe(true);
    const raw = JSON.parse(localStorage.getItem('imperium_save_slots')!);
    expect(raw.version).toBe(3); expect(raw.technology.player).toEqual(player);
    expect(raw.technology.player).not.toHaveProperty('researchProgressDays');
    const loaded = loadGame('slots')!;
    expect(loaded.technology.player).toEqual(player); expect(loaded.technology.bots.get('BOT')).toEqual(bot);
    expect(normalizeTechState(loaded.technology.player)).toEqual(player);
  });
  it('normalizes invalid V3 slots without losing completed technologies', () => {
    const invalid = {...legacy(),completedFocuses:['focus_national_academies'],completedTechnologies:['sanitation','missing','sanitation'],researchSlots:[{id:1,technologyId:'education',progressDays:-4},{id:0,technologyId:'sanitation',progressDays:8},{id:0,technologyId:'education',progressDays:9},{id:9,technologyId:'medicine',progressDays:10}]};
    store(structured(3,invalid,invalid));
    const loaded = loadGame('slots')!;
    expect(loaded.technology.player.completedTechnologies).toEqual(['sanitation']);
    expect(loaded.technology.player.researchSlots).toEqual([{id:0,technologyId:null,progressDays:0},{id:1,technologyId:'education',progressDays:0}]);
    expect(loaded.technology.bots.get('BOT')).toEqual(loaded.technology.player);
  });
});
