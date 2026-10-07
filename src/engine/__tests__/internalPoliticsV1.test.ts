import { describe, expect, it } from 'vitest';
import { countries, provincesData } from '../../data/map';
import type { Country, Province } from '../../types';
import { DEFAULT_LAWS, LAWS } from '../../constants/laws';
import { calculateLawModifiers, normalizeActiveLaws } from '../government';
import { initializePolitics, normalizePolitics, GOVERNMENT_DEFINITIONS, GROUP_IDS, calculatePoliticalGroups, governmentSupport, legitimacyFactors, processPoliticalTick, POLITICS_BALANCE as B, politicsDay, validatePolicyChange, changeGovernmentPolicy, politicalRebellionPressure, forcedGovernmentChange, choosePoliticalPolicy, politicalConsequence, politicalBattleOutcome, politicsModifiers } from '../politics';
import { processDailyTick } from '../economy';
import { calculateUnrest } from '../rebellion/unrestEngine';
import { selectRebelType } from '../rebellion/rebellionSpawner';
import { recoverArmy } from '../military';
import { army, war } from './helpers/southAmericaAudit';

const date=(n=0) => ({year:1444+Math.floor(n/360),month:Math.floor(n%360/30)+1,day:n%30+1});
function setup() {
  const country=initializePolitics({...structuredClone(countries[0]),activeLaws:{...DEFAULT_LAWS},provinces:['p']});
  country.resources={...country.resources,gold:10000,stability:60};country.economy={...country.economy,goldIncome:10,goldExpense:5};
  const province:Province={...structuredClone(provincesData[0]),id:'p',owner:country.tag,originalOwner:country.tag,development:5,buildings:[],neighbors:[],unrest:0};
  province.population={...province.population,total:20000,satisfaction:70,employed:8000,unemployed:0};
  const ctx={provinces:[province],armies:[],wars:[],date:date()};
  return {country,province,ctx};
}
const initialized=(country:Country) => ({...country,politics:{...country.politics!,lastTickDay:politicsDay(date())}});

describe('Internal Politics V1 government and migration',() => {
  it('defines exactly five types with modest finite modifiers and PT labels',() => {
    expect(Object.keys(GOVERNMENT_DEFINITIONS)).toEqual(['absolute_monarchy','constitutional_monarchy','republic','oligarchy','military_government']);
    for(const g of Object.values(GOVERNMENT_DEFINITIONS)) {
      expect(g.taxEfficiencyModifier).toBeGreaterThanOrEqual(1);expect(g.taxEfficiencyModifier).toBeLessThanOrEqual(1.05);
      expect(Number.isFinite(g.legitimacyModifier)).toBe(true);expect(g.label.length).toBeGreaterThan(3);
    }
  });
  it('initializes all 13 countries without replacing existing laws/stability',() => {
    expect(countries).toHaveLength(13);
    for(const country of countries) {
      const next=initializePolitics(country);expect(GOVERNMENT_DEFINITIONS[next.politics!.governmentType]).toBeDefined();
      expect(next.activeLaws).toEqual(country.activeLaws);expect(next.resources.stability).toBe(country.resources.stability);
    }
  });
  it('normalizes unknown government and corrupt state to bounded finite defaults',() => {
    const p=normalizePolitics({governmentType:'invalid',legitimacy:200,politicalCapital:-10,approval:{workers:NaN}} as never,'BRA');
    expect(p.governmentType).toBe('constitutional_monarchy');expect(p.legitimacy).toBe(100);expect(p.politicalCapital).toBe(0);
    for(const id of GROUP_IDS) expect(Number.isFinite(p.approval[id])).toBe(true);
    expect(normalizeActiveLaws(undefined).militarySpending).toBe('military_spending_normal');
    expect(normalizeActiveLaws(undefined).social).toBe('social_balanced');
  });
});

describe('Internal Politics V1 national tick',() => {
  it('runs once per 30 days, initializes its clock and is idempotent within a tick',() => {
    const {country,ctx}=setup();const first=processPoliticalTick([country],ctx).countries[0];
    expect(first.politics!.lastTickDay).toBe(politicsDay(date()));
    const early=processPoliticalTick([first],{...ctx,date:date(29)}).countries[0];expect(early.politics).toEqual(first.politics);
    const monthly=processPoliticalTick([first],{...ctx,date:date(30)}).countries[0];expect(monthly.politics!.politicalCapital).toBeGreaterThan(first.politics!.politicalCapital);
    expect(processPoliticalTick([monthly],{...ctx,date:date(30)}).countries[0]).toEqual(monthly);
  });
  it('drifts legitimacy and stability towards separate targets with bounded monthly deltas',() => {
    const {country,ctx}=setup();country.politics!.legitimacy=10;country.resources.stability=90;
    const next=processPoliticalTick([initialized(country)],{...ctx,date:date(30)}).countries[0];
    expect(next.politics!.legitimacy).toBe(10+B.legitimacyDrift);
    expect(next.resources.stability).toBe(90-B.stabilityDrift);
    expect(next.politics!.legitimacy).not.toBe(next.resources.stability);
  });
  it('satisfaction, stability, support, war defeats and economic success affect legitimacy targets',() => {
    const {country,province,ctx}=setup(),target=(c=country) => legitimacyFactors(c,ctx).reduce((s,f) => s+f.value,0);
    const baseline=target();province.population.satisfaction=20;expect(target()).toBeLessThan(baseline);province.population.satisfaction=70;
    const unstable={...country,resources:{...country.resources,stability:10}};expect(target(unstable)).toBeLessThan(baseline);
    const w={...war(country.tag,'ARG'),warScore:-50};expect(legitimacyFactors(country,{...ctx,wars:[w]}).reduce((s,f) => s+f.value,0)).toBeLessThan(baseline);
  });
  it('clamps legitimacy, stability and political capital and never runs for annexed/rebel/landless countries',() => {
    const {country,ctx}=setup();country.politics!.politicalCapital=100;country.politics!.legitimacy=500;country.resources.stability=-200;
    const next=processPoliticalTick([initialized(country)],{...ctx,date:date(30)}).countries[0];
    expect(next.politics!.politicalCapital).toBe(100);expect(next.politics!.legitimacy).toBeLessThanOrEqual(100);expect(next.resources.stability).toBeGreaterThanOrEqual(0);
    for(const c of [{...country,isAnnexed:true},{...country,tag:'rebel_test'}]) expect(processPoliticalTick([c],ctx).countries[0]).toBe(c);
    expect(processPoliticalTick([country],{...ctx,provinces:[]}).countries[0]).toBe(country);
  });
  it('is deterministic and remains finite over two years of daily ticks',() => {
    const {country,ctx}=setup();let a=[country],b=structuredClone(a);
    for(let n=0;n<720;n++) {
      a=processPoliticalTick(a,{...ctx,date:date(n)}).countries;b=processPoliticalTick(b,{...ctx,date:date(n)}).countries;
      expect(a).toEqual(b);
      expect(a[0].politics!.legitimacy).toBeGreaterThanOrEqual(0);expect(a[0].politics!.politicalCapital).toBeLessThanOrEqual(100);
    }
  });
});

describe('Internal Politics V1 groups',() => {
  it('normalizes influence to 100 and derives it from buildings, employment, wealth and armies',() => {
    const {country,province,ctx}=setup(),base=calculatePoliticalGroups(country,ctx);
    expect(base.reduce((s,g) => s+g.influence,0)).toBeCloseTo(100);
    for(const [type,id] of [['farm','landowners'],['market','merchants'],['workshop','workers'],['barracks','military']] as const) {
      province.buildings=[{type,level:5,daysRemaining:0}];
      expect(calculatePoliticalGroups(country,ctx).find(g => g.id===id)!.influence).toBeGreaterThan(base.find(g => g.id===id)!.influence);
    }
    province.buildings=[];const forces=[army(country.tag,'p',50)];
    expect(calculatePoliticalGroups(country,{...ctx,armies:forces}).find(g => g.id==='military')!.influence).toBeGreaterThan(base.find(g => g.id==='military')!.influence);
  });
  it('calculates weighted government support with clamps, excluding invalid weights',() => {
    expect(governmentSupport([{influence:75,approval:100},{influence:25,approval:-100}])).toBe(75);
    expect(governmentSupport([])).toBe(50);expect(governmentSupport([{influence:NaN,approval:Infinity}])).toBe(50);
  });
  it('approval reflects taxes, unemployment and government, and drifts gradually',() => {
    const {country,province,ctx}=setup();const base=calculatePoliticalGroups(country,ctx).find(g => g.id==='workers')!.target;
    country.activeLaws.taxation='taxation_high';province.population.unemployed=5000;
    expect(calculatePoliticalGroups(country,ctx).find(g => g.id==='workers')!.target).toBeLessThan(base);
    const next=processPoliticalTick([initialized(country)],{...ctx,date:date(30)}).countries[0];
    expect(Math.abs(next.politics!.approval.workers-country.politics!.approval.workers)).toBeLessThanOrEqual(B.approvalDrift);
  });
  it('all groups remain finite despite corrupt income, wealth and development',() => {
    const {country,province,ctx}=setup();country.resources.gold=NaN;country.economy.goldIncome=Infinity;province.development=NaN;
    for(const g of calculatePoliticalGroups(country,ctx)) {expect(Number.isFinite(g.influence)).toBe(true);expect(Number.isFinite(g.target)).toBe(true);}
  });
});

describe('Internal Politics V1 policies and capital',() => {
  it('pays gold and capital exactly once, applies reaction/shock and preserves all other laws',() => {
    const {country}=setup(),before=structuredClone(country),result=changeGovernmentPolicy(country,'taxation_low',date());
    expect(result.allowed).toBe(true);expect(country).toEqual(before);
    expect(result.country.resources.gold).toBe(country.resources.gold-LAWS.taxation_low.costGold);
    expect(result.country.politics!.politicalCapital).toBe(country.politics!.politicalCapital-result.cost);
    expect(result.country.politics!.approval.workers).toBe(country.politics!.approval.workers+15);
    expect(result.country.activeLaws.governance).toBe(country.activeLaws.governance);
    expect(result.country.politics!.legitimacy).toBe(country.politics!.legitimacy-B.policyLegitimacyCost);
  });
  it('blocks any second policy until 365 days and allows it exactly after expiry',() => {
    const {country}=setup(),first=changeGovernmentPolicy(country,'taxation_low',date()).country;
    expect(validatePolicyChange(first,'social_supportive',date(364)).remaining).toBe(1);
    expect(changeGovernmentPolicy(first,'taxation_normal',date(364)).allowed).toBe(false);
    expect(changeGovernmentPolicy(first,'taxation_normal',date(365)).allowed).toBe(true);
  });
  it('blocks insufficient capital/gold, invalid laws, active policies and war requirements without mutation',() => {
    const {country}=setup();country.politics!.politicalCapital=0;
    expect(changeGovernmentPolicy(country,'taxation_low',date()).reason).toContain('Capital');
    country.politics!.politicalCapital=100;country.resources.gold=0;
    expect(changeGovernmentPolicy(country,'taxation_low',date()).reason).toContain('Ouro');
    expect(changeGovernmentPolicy(country,'invalid',date()).allowed).toBe(false);
    expect(changeGovernmentPolicy(country,'taxation_normal',date()).allowed).toBe(false);
    expect(changeGovernmentPolicy(country,'economy_war_total',date()).reason).toContain('guerra');
  });
  it('republic reforms cost less capital than absolute monarchy',() => {
    const {country}=setup();country.politics!.governmentType='republic';const republic=validatePolicyChange(country,'taxation_low',date()).cost;
    country.politics!.governmentType='absolute_monarchy';expect(validatePolicyChange(country,'taxation_low',date()).cost).toBeGreaterThan(republic);
  });
});

describe('Internal Politics V1 economic and military integration',() => {
  it('tax laws retain canonical revenue effects and social policy charges real recurring expense',() => {
    const {country,province}=setup();country.activeLaws.social='social_restrictive';
    const low=processDailyTick({...country,activeLaws:{...country.activeLaws,taxation:'taxation_low'}},[province]);
    const high=processDailyTick({...country,activeLaws:{...country.activeLaws,taxation:'taxation_high'}},[province]);
    expect(high.country.economy.goldIncome).toBeGreaterThan(low.country.economy.goldIncome);
    const supportive=processDailyTick({...country,activeLaws:{...country.activeLaws,social:'social_supportive'}},[province]);
    const restrictive=processDailyTick(country,[province]);
    expect(supportive.country.economy.goldExpense).toBeGreaterThan(restrictive.country.economy.goldExpense);
    expect(supportive.provinces[0].population.satisfaction).toBeGreaterThan(restrictive.provinces[0].population.satisfaction);
    expect(supportive.country.resources.gold).toBeLessThan(restrictive.country.resources.gold);
  });
  it('military spending composes existing maintenance and gives only small positive recovery differences',() => {
    const {country,province}=setup();province.stationedMilitaryMaintenance=20;
    const low={...country,activeLaws:{...country.activeLaws,militarySpending:'military_spending_low'}},high={...country,activeLaws:{...country.activeLaws,militarySpending:'military_spending_high'}};
    expect(processDailyTick(high,[province]).country.economy.goldExpense).toBeGreaterThan(processDailyTick(low,[province]).country.economy.goldExpense);
    const force=army(country.tag,'p',1);force.regiments[0].organization=20;force.regiments[0].morale=20;
    expect(recoverArmy(force,high,province).army.regiments[0].organization).toBeGreaterThan(recoverArmy(force,low,province).army.regiments[0].organization!);
    expect(recoverArmy(force,low,province).army.regiments[0].morale).toBeGreaterThanOrEqual(20);
  });
  it('reuses national stability and stops legacy daily recovery for migrated countries',() => {
    const {country,province}=setup();country.resources.stability=40;
    expect(processDailyTick(country,[province]).country.resources.stability).toBe(40);
    const legacy={...country,politics:undefined};expect(processDailyTick(legacy,[province]).country.resources.stability).toBeGreaterThan(40);
    expect(calculateLawModifiers(country.activeLaws).militaryMaintenanceMultiplier).toBeGreaterThan(0);
    country.politics!.governmentType='oligarchy';expect(politicsModifiers(country).tax).toBe(1.03);
  });
  it('the existing stability scale still affects income and provincial satisfaction',() => {
    const {country,province}=setup();
    const low=processDailyTick({...country,resources:{...country.resources,stability:20}},[province]);
    const high=processDailyTick({...country,resources:{...country.resources,stability:80}},[province]);
    expect(high.country.economy.goldIncome).toBeGreaterThan(low.country.economy.goldIncome);
    expect(high.provinces[0].population.satisfaction).toBeGreaterThan(low.provinces[0].population.satisfaction);
  });
});

describe('Internal Politics V1 Rebellion V2 integration',() => {
  it('low legitimacy, existing low stability and influential hostile groups raise the existing unrest',() => {
    const {country,province,ctx}=setup(),base=politicalRebellionPressure(country,ctx);
    country.politics!.legitimacy=10;expect(politicalRebellionPressure(country,ctx)).toBeGreaterThan(base);
    const pressure=politicalRebellionPressure(country,ctx);country.politics!.approval.workers=-100;
    expect(politicalRebellionPressure(country,ctx)).toBeGreaterThan(pressure);
    const old=calculateUnrest(province,date(),[],country).total;country.resources.stability=10;
    expect(calculateUnrest(province,date(),[],country).total).toBeGreaterThan(old);
  });
  it('hostile military favors existing pretenders, workers/reformists favor revolutionaries',() => {
    const {country,province,ctx}=setup();country.politics!.approval.military=-100;
    expect(selectRebelType(province,country,ctx.provinces,[army(country.tag,'p',100)])).toBe('pretenders');
    country.politics!.approval.military=0;country.politics!.approval.workers=-100;province.buildings=[{type:'workshop',level:50,daysRemaining:0}];
    expect(selectRebelType(province,country,ctx.provinces)).toBe('revolutionaries');
  });
  it.each(['replace_government','reform'] as const)('forced %s changes government coherently with a shock and group support',kind => {
    const {country}=setup(),next=forcedGovernmentChange(country,kind);
    expect(next.politics!.governmentType).toBe(kind==='reform' ? 'republic' : 'military_government');
    expect(next.politics!.legitimacy).toBe(B.forcedLegitimacy);expect(next.resources.stability).toBe(B.forcedStability);
    expect(next.politics!.approval[kind==='reform'?'workers':'military']).toBe(B.victoryApproval);
  });
  it('concessions/repression and relevant military outcomes affect legitimacy without new rebel types',() => {
    const {country}=setup();expect(politicalConsequence(country,true).politics!.legitimacy).toBeLessThan(country.politics!.legitimacy);
    expect(politicalConsequence(country,false).politics!.legitimacy).toBeGreaterThan(country.politics!.legitimacy);
    expect(politicalBattleOutcome(country,false,100)).toBe(country);
    expect(politicalBattleOutcome(country,false,500).politics!.legitimacy).toBeLessThan(country.politics!.legitimacy);
  });
});

describe('Internal Politics V1 deterministic AI',() => {
  it('responds to unrest with tax relief, respects cooldown and insufficient capital',() => {
    const {country,province,ctx}=setup();province.unrest=60;
    expect(choosePoliticalPolicy(country,ctx)).toBe('taxation_low');
    const changed=changeGovernmentPolicy(country,'taxation_low',ctx.date).country;
    expect(choosePoliticalPolicy(changed,ctx)).toBeNull();country.politics!.politicalCapital=0;expect(choosePoliticalPolicy(country,ctx)).toBeNull();
  });
  it('responds to deficits with safe spending cuts/taxation and war with military investment',() => {
    const {country,ctx}=setup();country.economy.goldExpense=20;country.activeLaws.social='social_restrictive';
    expect(choosePoliticalPolicy(country,ctx)).toBe('taxation_high');
    country.economy.goldExpense=5;expect(choosePoliticalPolicy(country,{...ctx,wars:[war(country.tag,'ARG')]})).toBe('military_spending_high');
  });
  it('changes bot policies through the same costs/cooldown and never changes the player or government type',() => {
    const {country,province,ctx}=setup();province.unrest=60;const input=initialized(country);
    const player=processPoliticalTick([input],{...ctx,date:date(30)},country.tag);expect(player.messages).toEqual([]);
    const bot=processPoliticalTick([input],{...ctx,date:date(30)},'OBSERVER');expect(bot.messages).toHaveLength(1);
    expect(bot.countries[0].activeLaws.taxation).toBe('taxation_low');expect(bot.countries[0].politics!.governmentType).toBe(input.politics!.governmentType);
    expect(bot.countries[0].resources.gold).toBe(input.resources.gold-LAWS.taxation_low.costGold);
  });
  it('retains useful legacy agrarian/trade/intelligence decisions under political costs',() => {
    const {country,ctx}=setup();const selected=choosePoliticalPolicy(country,ctx);
    expect(selected).toBe('intel_agency');
    const changed=changeGovernmentPolicy(country,selected!,ctx.date).country;
    expect(changed.activeLaws.intelligence).toBe('intel_agency');
    expect(changed.politics!.politicalCapital).toBeLessThan(country.politics!.politicalCapital);
    expect(choosePoliticalPolicy(changed,ctx)).toBeNull();
  });
});
