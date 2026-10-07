import { describe, expect, it } from 'vitest';
import { DEFAULT_LAWS, LAWS, LAWS_BY_CATEGORY, LAW_CATEGORIES } from '../../constants/laws';
import type { Country, Province } from '../../types';
import { normalizeMarket, calculateProduction } from '../market';
import { normalizePopulation } from '../population';
import { calculateLawModifiers, canEnactLaw, chooseAILaw, enactLaw, normalizeActiveLaws } from '../government';
import { calculateTechBonuses, createInitialTechState, processDailyTechProgress } from '../technology';
import { processDailyTick } from '../economy';
import { processConstructions } from '../buildings';

const province = (shortage=0): Province => {
  const market=normalizeMarket(undefined); market.goods.food={...market.goods.food,demand:10,shortage};
  return {id:'p',name:'P',owner:'TST',color:'#000',neighbors:[],population:normalizePopulation(5000),market,maxPopulation:10000,development:3,buildings:[{type:'farm',level:1,daysRemaining:0},{type:'workshop',level:1,daysRemaining:10}],defense:1,center:{x:0,y:0},path:''};
};
const country = (laws=DEFAULT_LAWS,gold=10000): Country => ({tag:'TST',name:'Teste',adjective:'',color:'#000',colorLight:'#111',provinces:['p'],resources:{gold,manpower:100,maxManpower:1000,stability:50,prestige:0},economy:{goldIncome:0,goldExpense:0,manpowerGain:0,manpowerExpense:0},flag:'',activeLaws:{...laws}});

describe('Governo e Leis integrados',()=>{
  it('possui três leis válidas em todas as categorias',()=>{
    expect(LAW_CATEGORIES).toEqual(['conscription','taxation','governance','economy','intelligence','agrarian','trade','militarySpending','social']);
    for(const category of LAW_CATEGORIES){expect(LAWS_BY_CATEGORY[category]).toHaveLength(3);expect(LAWS_BY_CATEGORY[category].every(id=>LAWS[id]?.category===category)).toBe(true)}
  });
  it('normaliza leis ausentes e inválidas de saves antigos',()=>{
    expect(normalizeActiveLaws({conscription:'invalid',taxation:'taxation_high'})).toEqual({...DEFAULT_LAWS,taxation:'taxation_high'});
  });
  it('deriva modificadores uma vez e compõe categorias multiplicativamente',()=>{
    const active={...DEFAULT_LAWS,taxation:'taxation_high',agrarian:'agrarian_incentives'};
    const modifiers=calculateLawModifiers(active);
    expect(modifiers.goldIncomeMultiplier).toBeCloseTo(1.2*.97);
    expect(modifiers.productionMultipliers.food).toBeCloseTo(1.05*1.1);
    expect(calculateLawModifiers(normalizeActiveLaws(active))).toEqual(modifiers);
  });
  it('restringe economia e mobilização totais à guerra e impede repetir a lei',()=>{
    expect(canEnactLaw(DEFAULT_LAWS,'economy_war_total',10000,{atWar:false}).reason).toContain('guerra');
    expect(canEnactLaw(DEFAULT_LAWS,'economy_war_total',10000,{atWar:true}).allowed).toBe(true);
    expect(canEnactLaw(DEFAULT_LAWS,'taxation_normal',10000,{atWar:false}).allowed).toBe(false);
  });
  it('cobra exatamente uma vez e preserva categorias ao promulgar',()=>{
    const result=enactLaw(DEFAULT_LAWS,'taxation_high',1000,{atWar:false});
    expect(result.gold).toBe(100); expect(result.activeLaws.taxation).toBe('taxation_high');
    const repeated=enactLaw(result.activeLaws,'taxation_high',result.gold,{atWar:false});
    expect(repeated.allowed).toBe(false); expect(repeated.gold).toBe(100);
  });
  it('compõe lei, tecnologia e foco na produção provincial',()=>{
    const tech=calculateTechBonuses({...createInitialTechState('TST'),completedTechnologies:['improved_agriculture'],completedFocuses:['focus_agrarian_reform']});
    const law=calculateLawModifiers({...DEFAULT_LAWS,agrarian:'agrarian_incentives'});
    const multipliers={...tech.productionMultipliers,food:tech.productionMultipliers.food*law.productionMultipliers.food};
    expect(calculateProduction(province(),multipliers).food).toBeGreaterThan(calculateProduction(province(),tech.productionMultipliers).food);
  });
  it('aplica tributação, agricultura, população, satisfação, manpower, construção e comércio no tick canônico',()=>{
    const active={...DEFAULT_LAWS,taxation:'taxation_low',governance:'governance_decentralized',agrarian:'agrarian_incentives',trade:'trade_integrated',conscription:'conscription_limited'};
    const result=processDailyTick(country(active),[province()]);
    expect(result.provinces[0].market!.goods.food.production).toBeGreaterThan(processDailyTick(country(),[province()]).provinces[0].market!.goods.food.production);
    expect(result.provinces[0].population.satisfaction).toBeGreaterThan(processDailyTick(country(),[province()]).provinces[0].population.satisfaction);
    expect(result.country.resources.maxManpower).toBeGreaterThan(processDailyTick(country(),[province()]).country.resources.maxManpower);
    expect(result.provinces[0].buildings[1].daysRemaining).toBeLessThan(9);
    const queue=[{id:'c',provinceId:'p',owner:'TST',buildingType:'farm' as const,daysRemaining:10,totalDays:10,cost:10}];
    expect(processConstructions(queue,[province()],new Map([['TST',1.1]])).updatedConstructions[0].daysRemaining).toBeCloseTo(8.9);
  });
  it('inteligência acelera pesquisa e focos pela progressão canônica',()=>{
    const informed=country({...DEFAULT_LAWS,intelligence:'intel_agency'});
    const focusState={...createInitialTechState('TST'),activeFocusId:'focus_national_unity'};
    expect(processDailyTechProgress(focusState,informed,'medium',true).techState.focusProgressDays).toBeCloseTo(1.05);
    const researchState={...createInitialTechState('TST'),researchSlots: [{id:0,technologyId:'improved_agriculture',progressDays:0}]};
    expect(processDailyTechProgress(researchState,informed,'medium',true).techState.researchSlots[0].progressDays).toBeCloseTo(1.05);
  });
  it('IA reage a guerra, fome e paz sem ignorar requisitos',()=>{
    expect(chooseAILaw(country(DEFAULT_LAWS),[province()],{atWar:false})).toBe('intel_agency');
    expect(chooseAILaw(country(DEFAULT_LAWS),[province(5)],{atWar:false})).toBe('agrarian_incentives');
    expect(chooseAILaw(country(DEFAULT_LAWS),[province()],{atWar:true})).toBe('conscription_total');
  });
});
