import { describe, expect, it } from 'vitest';
import type { Country, Province } from '../../types';
import { calculateProduction } from '../market';
import { getPopulationCapacity } from '../population';
import { calculateArmyBasePower } from '../combat/combatCalculations';
import { calculateTechBonuses, createInitialTechState, getMilitaryCombatBonuses, normalizeTechState, processDailyTechProgress, startTechnologyResearch } from '../technology';
import { processAIEconomicDecisions } from '../aiEngine/aiEconomy';

const country = { tag:'TST', resources:{gold:1000} } as Country;
const stateWith = (...ids:string[]) => ({...createInitialTechState('TST'),completedTechnologies:ids});
const province = {id:'p',name:'P',owner:'TST',development:5,maxPopulation:10000,population:{total:5000,growthRate:.002,employed:3000,unemployed:0,satisfaction:60},buildings:[{type:'farm',level:1,daysRemaining:0},{type:'lumber_mill',level:1,daysRemaining:0},{type:'iron_mine',level:1,daysRemaining:0},{type:'workshop',level:1,daysRemaining:0}]} as Province;

describe('Technology V2',()=>{
 it('inicia pesquisa válida',()=>expect(startTechnologyResearch(createInitialTechState('TST'),'improved_agriculture',country).techState?.activeResearchId).toBe('improved_agriculture'));
 it('bloqueia sem ouro',()=>expect(startTechnologyResearch(createInitialTechState('TST'),'improved_agriculture',{...country,resources:{...country.resources,gold:0}}).techState).toBeNull());
 it('bloqueia pré-requisito ausente',()=>expect(startTechnologyResearch(createInitialTechState('TST'),'commercial_administration',country).techState).toBeNull());
 it('não permite tecnologia concluída',()=>expect(startTechnologyResearch(stateWith('improved_agriculture'),'improved_agriculture',country).techState).toBeNull());
 it('permite somente uma pesquisa',()=>expect(startTechnologyResearch({...createInitialTechState('TST'),activeResearchId:'sanitation'},'improved_agriculture',country).techState).toBeNull());
 it('informa custo uma única vez no início',()=>expect(startTechnologyResearch(createInitialTechState('TST'),'improved_agriculture',country).cost).toBe(300));
 it('progride diariamente sem exigir ouro',()=>{const active={...createInitialTechState('TST'),activeResearchId:'improved_agriculture'};expect(processDailyTechProgress(active,{...country,resources:{...country.resources,gold:0}},'medium',true).techState.researchProgressDays).toBe(1)});
 it('termina e libera a pesquisa ativa',()=>{const active={...createInitialTechState('TST'),activeResearchId:'improved_agriculture',researchProgressDays:29};const result=processDailyTechProgress(active,country,'medium',true).techState;expect(result.activeResearchId).toBeNull();expect(result.completedTechnologies).toContain('improved_agriculture')});
 it('Educação aumenta research speed',()=>{const active={...stateWith('education'),activeResearchId:'improved_agriculture'};expect(processDailyTechProgress(active,country,'medium',true).techState.researchProgressDays).toBeCloseTo(1.1)});
 for(const [good,id] of [['food','improved_agriculture'],['wood','advanced_sawmills'],['iron','advanced_mining'],['tools','standardized_tools']] as const) it(`${good.toUpperCase()} recebe bônus tecnológico`,()=>{const base=calculateProduction(province)[good];const multiplier=calculateTechBonuses(stateWith(id)).productionMultipliers;expect(calculateProduction(province,multiplier)[good]).toBeGreaterThan(base)});
 it('tecnologia militar altera poder militar',()=>{const army={regiments:[{type:'infantry',strength:100,morale:100}]} as Parameters<typeof calculateArmyBasePower>[0];expect(calculateArmyBasePower(army,getMilitaryCombatBonuses(stateWith('improved_weapons')))).toBeGreaterThan(calculateArmyBasePower(army))});
 it('sociedade altera crescimento e capacidade',()=>{expect(calculateTechBonuses(stateWith('sanitation')).populationGrowthMultiplier).toBe(1.1);expect(getPopulationCapacity(province,calculateTechBonuses(stateWith('medicine')).populationCapacityMultiplier)).toBe(11000)});
 it('IA inicia pesquisa válida e paga uma vez',()=>{const result=processAIEconomicDecisions(country,[],createInitialTechState('TST'),[],[],'1/1/1');expect(result.techState.activeResearchId).toBeTruthy();expect(result.country.resources.gold).toBeLessThan(country.resources.gold)});
 it('IA respeita pré-requisitos',()=>{const result=processAIEconomicDecisions(country,[],createInitialTechState('TST'),[],[],'1/1/1');expect(result.techState.activeResearchId).not.toBe('professional_army')});
 it('normaliza save antigo sem progresso',()=>{const normalized=normalizeTechState({countryTag:'OLD',completedTechnologies:['sanitation']});expect(normalized.researchProgressDays).toBe(0);expect(normalized.completedTechnologies).toEqual(['sanitation'])});
 it('preserva pesquisa e progresso do save',()=>{const normalized=normalizeTechState({...createInitialTechState('TST'),activeResearchId:'education',researchProgressDays:12.5});expect(normalized.activeResearchId).toBe('education');expect(normalized.researchProgressDays).toBe(12.5)});
});
