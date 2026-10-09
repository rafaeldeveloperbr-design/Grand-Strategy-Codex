// @vitest-environment jsdom
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Army, Country, GameDate, Province } from '../../types';
import { DEFAULT_LAWS } from '../../constants/laws';
import { createArmy, createRegiment } from '../military';
import { ProvinceLayer } from '../../components/GameMap/ProvinceLayer';
import { transferProvince, type TerritoryTransferState } from '../territoryTransfer';
import { advanceRebellionProgress, normalizeRebellion, normalizeSavedRebellion, normalizeSavedFactions, processProvincialPressure, processRebellionObjectives, planRebelMovement, spawnRebellions, reinforceRebellions, MAX_DAILY_REBELLION_PROGRESS, REBELLION_BALANCE as B } from '../rebellion';
const date: GameDate = { day: 1, month: 1, year: 1444 };
const province = (overrides: Partial<Province> = {}): Province => ({ id: 'p', name: 'Província', owner: 'A', color: '#fff', neighbors: [],
  population: { total: 10000, growthRate: .002, employed: 5000, unemployed: 0, satisfaction: 60 }, maxPopulation: 50000,
  development: 5, buildings: [], defense: 0, center: { x: 0, y: 0 }, path: '', unrest: 0, ...overrides });
const country = (overrides: Partial<Country> = {}): Country => ({ tag: 'A', name: 'País', adjective: 'País', color: '#fff', colorLight: '#fff', provinces: ['p'],
  flag: 'A', activeLaws: { ...DEFAULT_LAWS }, resources: { gold: 5000, manpower: 5000, maxManpower: 10000, stability: 70, prestige: 0 },
  economy: { goldIncome: 10, goldExpense: 5, manpowerGain: 10, manpowerExpense: 0 }, ...overrides });
const army = (owner = 'A', location = 'p', troops = 1000): Army => ({ ...createArmy(owner, owner, location), id: `${owner}_${location}`, regiments: [{ ...createRegiment('infantry'), strength: troops }] });
const ready = (overrides: Partial<Province> = {}) => province({ unrest: 95, rebellion: { ...normalizeRebellion(), progress: 100 }, ...overrides });
const spawn = (p = ready(), c = country()) => spawnRebellions([p], [c], [], [], [], date);


afterEach(cleanup);
const ignore = () => {};
describe('Rebellion V2.1', () => {
  it.each([0,49,50,75])('map visibility at %s', progress => {
    const view = render(<svg><ProvinceLayer provinces={[province({unrest:95, rebellion:{...normalizeRebellion(),progress}})]} countries={[country()]} buildingConstructions={[]} recruitments={[]} selectedProvince={null} hoveredProvince={null} onProvinceClick={ignore} onMouseEnter={ignore} onMouseMove={ignore} onMouseLeave={ignore}/></svg>);
    expect(view.queryByText('95') !== null).toBe(progress >= 50);
  });
  it('removes the marker when organization falls below threshold', () => {
    const props = {countries:[country()], buildingConstructions:[], recruitments:[], selectedProvince:null, hoveredProvince:null, onProvinceClick:ignore,onMouseEnter:ignore,onMouseMove:ignore,onMouseLeave:ignore};
    const view = render(<svg><ProvinceLayer {...props} provinces={[ready()]} /></svg>);
    expect(view.queryByText('95')).not.toBeNull();
    view.rerender(<svg><ProvinceLayer {...props} provinces={[ready({rebellion:{...normalizeRebellion(),progress:49}})]}/></svg>);
    expect(view.queryByText('95')).toBeNull();
  });
  it.each([25,50,75,90])('announces crossing %s once, remembers falls and save/load', threshold => {
    const c = country({resources:{...country().resources,stability:0,prestige:-100},activeLaws:{...DEFAULT_LAWS,taxation:'taxation_high'}});
    const p = ready({rebellion:{...normalizeRebellion(),progress:threshold-.1}});
    const first = processProvincialPressure([p],date,[],[c]);
    expect(first.logs).toHaveLength(1);
    expect(first.logs[0]).toContain(({25:'Tensão crescente',50:'Agitação severa',75:'Rebelião iminente',90:'Situação crítica'} as Record<number,string>)[threshold]);
    const saved = normalizeSavedRebellion(JSON.parse(JSON.stringify(first.updatedProvinces[0].rebellion)));
    expect(saved.notifiedMilestone).toBe(threshold);
    expect(processProvincialPressure(first.updatedProvinces,date,[],[c]).logs).toHaveLength(0);
    expect(processProvincialPressure([{...p,rebellion:{...saved,progress:threshold-.1}}],date,[],[c]).logs).toHaveLength(0);
    expect(processProvincialPressure([{...p,rebellion:{...saved,progress:threshold-.1}}],{...date,day:date.day+B.logDays},[],[c]).logs).toHaveLength(1);
  });
  it('measures 30 days and eventual rebellion against V2 baseline', () => {
    let progress = 0;
    for(let d=0;d<30;d++) progress = advanceRebellionProgress(progress,95);
    expect(progress).toBeCloseTo(29.25);
    expect(progress).toBeLessThan(45);
    expect(advanceRebellionProgress(0,100)).toBeLessThanOrEqual(MAX_DAILY_REBELLION_PROGRESS);
    for(let d=30;d<103;d++) progress = advanceRebellionProgress(progress,95);
    expect(progress).toBe(100);
  });
  it('keeps active occupation progress frozen and reinforcement finite', () => {
    const born=spawn(); const f=born.countries[0].rebellions![0];
    const owned=born.provinces.map(p=>({...p,owner:f.id}));
    expect(processProvincialPressure(owned,date,born.armies,born.countries).updatedProvinces[0].rebellion.progress).toBe(100);
    const next=reinforceRebellions(owned,born.countries,born.armies,date);
    expect(next.countries[0].rebellions![0].reinforcementRate).toBeLessThanOrEqual(B.reinforcements.perProvinceCap);
    expect(reinforceRebellions(next.provinces,next.countries,next.armies,date).armies).toEqual(next.armies);
    expect(reinforceRebellions(born.provinces,born.countries,born.armies,date).countries[0].rebellions![0].reinforcementRate).toBe(0);
  });
  it('recaptures A then B, migrates base and cleans all orphans exactly once', () => {
    const born=spawnRebellions([ready({id:'a',neighbors:['b']}),ready({id:'b',neighbors:['a']})],[country({provinces:['a','b']})],[],[],[],date);
    const id=born.createdFactionIds[0];
    let territory: TerritoryTransferState={provinces:born.provinces,countries:born.countries,recruitments:[],constructions:[]};
    territory=transferProvince(territory,'a',id,{date});
    territory=transferProvince(territory,'b',id,{date});
    territory=transferProvince(territory,'a','A',{date});
    expect(territory.countries[0].rebellions![0].baseProvince).toBe('b');
    expect(territory.provinces[0].rebellion?.factionId).toBeUndefined();
    expect(territory.provinces[0].unrest).toBe(95);
    territory=transferProvince(territory,'b','A',{date});
    expect(territory.countries[0].rebellions![0].cleanupPending).toBe(true);
    expect(planRebelMovement(born.armies,territory.provinces,territory.countries,born.relations,date)).toEqual([]);
    const ended=processRebellionObjectives(territory.provinces,territory.countries,born.armies,born.wars,born.relations,date);
    expect(ended.countries[0].rebellions![0].status).toBe('defeated');
    expect(ended.armies).toEqual([]); expect(ended.wars).toEqual([]);expect(ended.relations).toEqual([]);
    expect(ended.provinces.every(p=>p.owner==='A' && !p.rebellion?.factionId && (p.rebellion?.progress??0)<50)).toBe(true);
    expect(processRebellionObjectives(ended.provinces,ended.countries,ended.armies,ended.wars,ended.relations,date).logs).toEqual([]);
    expect(normalizeSavedFactions(JSON.parse(JSON.stringify(ended.countries[0].rebellions)))[0].cleanupPending).toBe(true);
  });
  it('cleans stale territoryless save with a surviving army away from origin', () => {
    const born=spawn();
    const result=processRebellionObjectives(born.provinces,born.countries,[{...born.armies[0],location:'missing'}],born.wars,born.relations,date);
    expect(result.armies).toEqual([]);expect(result.countries[0].rebellions![0].status).toBe('defeated');
    expect(normalizeSavedRebellion({progress:49}).notifiedMilestone).toBe(0);
  });
  it('cleans an old territoryless save at origin before it can reconquer or march', () => {
    const born=spawn();const tomorrow={...date,day:2};
    expect(planRebelMovement([{...born.armies[0],destination:'q',path:['q']}],born.provinces,born.countries,born.relations,tomorrow)).toEqual([]);
    const ended=processRebellionObjectives(born.provinces,born.countries,born.armies,born.wars,born.relations,tomorrow);
    expect(ended.provinces[0].owner).toBe('A');expect(ended.armies).toEqual([]);
    expect(ended.countries[0].rebellions![0].status).toBe('defeated');
  });
  it('repairs missing faction references and removes unknown faction armies', () => {
    const stale=ready({rebellion:{...normalizeRebellion(),progress:100,factionId:'rebel_v2_missing'}});
    const result=processRebellionObjectives([stale],[country()],[army('rebel_v2_missing')],[],[],date);
    expect(result.armies).toEqual([]);expect(result.provinces[0].rebellion?.factionId).toBeUndefined();
    expect(result.provinces[0].rebellion?.progress).toBeLessThan(50);
  });
  it('repairs a stale base deterministically after load while keeping historical origin', () => {
    const born=spawn();const id=born.createdFactionIds[0];
    const f={...born.countries[0].rebellions![0],baseProvince:'missing',territoryEstablished:true};
    const countries=born.countries.map(c=>({...c,rebellions:[f]}));
    const territory=[ready({id:'z',owner:id}),ready({id:'b',owner:id})];
    const first=processRebellionObjectives(territory,countries,[],born.wars,born.relations,date);
    const second=processRebellionObjectives([...territory].reverse(),countries,[],born.wars,born.relations,date);
    expect(first.countries[0].rebellions![0].baseProvince).toBe('b');
    expect(second.countries[0].rebellions![0]).toEqual(first.countries[0].rebellions![0]);
    expect(first.countries[0].rebellions![0].originProvince).toBe('p');
  });
  it('exhausts finite territorial recruitment instead of growing forever', () => {
    const born=spawn();const id=born.createdFactionIds[0];
    let state={provinces:born.provinces.map(p=>({...p,owner:id})),countries:born.countries,armies:born.armies};
    for(let d=1;d<=1000;d++) state=reinforceRebellions(state.provinces,state.countries,state.armies,{...date,day:d});
    expect(state.countries[0].rebellions![0].reinforcementRate).toBe(0);
    expect(state.countries[0].rebellions![0].recruitedTroops).toBeLessThan(3000);
    expect(state.armies).toHaveLength(1);
    expect(reinforceRebellions(state.provinces,state.countries,state.armies,{...date,day:1001}).armies).toEqual(state.armies);
  });
  it('restores a stale rebel owner through territory transfer and cancels local queues', () => {
    const p=ready({owner:'rebel_v2_missing',originalOwner:'A'});
    const result=processRebellionObjectives([p],[country()],[],[],[],date);
    expect(result.provinces[0].owner).toBe('A');
    expect(result.provinces[0].unrest).toBe(95);
    expect(result.countries[0].provinces).toContain('p');
    expect(result.provinces[0].rebellion?.progress).toBe(0);
  });
  it('retains an existing move order without reissuing it', () => {
    const born=spawn();const ordered={...army(born.createdFactionIds[0]),destination:'q',targetDestination:'q',path:['q']};
    expect(planRebelMovement([ordered],born.provinces,born.countries,born.relations,date)[0]).toBe(ordered);
  });
});
