import type { Country } from '../types';
import type { CountryTechState, RewardEffect, TechnologyEffect } from '../types/technology';
import type { AIDifficulty } from '../types/difficulty';
import { DIFFICULTY_SPEED_MULTIPLIERS } from '../types/difficulty';
import { NATIONAL_FOCUSES, TECHNOLOGIES } from '../data/technology';

export interface TechnologyBonuses {
  combatPowerBonus: { infantry:number; cavalry:number; artillery:number };
  goldIncomeMultiplier:number; buildCostMultiplier:number; buildTimeMultiplier:number; manpowerMultiplier:number;
  productionMultipliers: Record<'food'|'wood'|'iron'|'tools',number>;
  recruitmentTimeMultiplier:number; militaryMaintenanceMultiplier:number; fortificationMultiplier:number;
  populationGrowthMultiplier:number; populationCapacityMultiplier:number; researchSpeedMultiplier:number;
}
const baseBonuses = (): TechnologyBonuses => ({combatPowerBonus:{infantry:0,cavalry:0,artillery:0},goldIncomeMultiplier:1,buildCostMultiplier:1,buildTimeMultiplier:1,manpowerMultiplier:1,productionMultipliers:{food:1,wood:1,iron:1,tools:1},recruitmentTimeMultiplier:1,militaryMaintenanceMultiplier:1,fortificationMultiplier:1,populationGrowthMultiplier:1,populationCapacityMultiplier:1,researchSpeedMultiplier:1});

export function normalizeTechState(value: Partial<CountryTechState> | undefined, countryTag='UNKNOWN'): CountryTechState {
 return {countryTag:value?.countryTag ?? countryTag,activeFocusId:value?.activeFocusId ?? null,activeResearchId:value?.activeResearchId ?? null,completedFocuses:[...(value?.completedFocuses ?? [])],completedTechnologies:[...(value?.completedTechnologies ?? [])],focusProgressDays:Number.isFinite(value?.focusProgressDays) ? value!.focusProgressDays! : 0,researchProgressDays:Number.isFinite(value?.researchProgressDays) ? value!.researchProgressDays! : 0};
}
export const createInitialTechState = (countryTag:string):CountryTechState => normalizeTechState(undefined,countryTag);

export function startNationalFocus(state:CountryTechState,id:string):CountryTechState|null { const f=NATIONAL_FOCUSES.find(x=>x.id===id); if(!f||state.activeFocusId||state.completedFocuses.includes(id)||!(f.prerequisites??[]).every(p=>state.completedFocuses.includes(p))) return null; return {...state,activeFocusId:id,focusProgressDays:0}; }
export function startTechnologyResearch(state:CountryTechState,id:string,country:Country):{techState:CountryTechState|null;cost:number} { const t=TECHNOLOGIES.find(x=>x.id===id); if(!t) return {techState:null,cost:0}; if(state.activeResearchId||state.completedTechnologies.includes(id)||!t.prerequisites.every(p=>state.completedTechnologies.includes(p))||country.resources.gold<t.costGold) return {techState:null,cost:t.costGold}; return {techState:{...state,activeResearchId:id,researchProgressDays:0},cost:t.costGold}; }

export function processDailyTechProgress(state:CountryTechState,country:Country,difficulty:AIDifficulty='medium',isPlayer=false) {
 const s=normalizeTechState(state,country.tag), notifications:string[]=[]; let next={...s,completedFocuses:[...s.completedFocuses],completedTechnologies:[...s.completedTechnologies]}; const aiSpeed=isPlayer?1:DIFFICULTY_SPEED_MULTIPLIERS[difficulty];
 if(next.activeFocusId){const f=NATIONAL_FOCUSES.find(x=>x.id===next.activeFocusId);if(f){next.focusProgressDays+=aiSpeed;if(next.focusProgressDays>=f.durationDays){next.completedFocuses.push(f.id);next.activeFocusId=null;next.focusProgressDays=0;notifications.push(`✅ Foco concluído: ${f.title}`)}}}
 if(next.activeResearchId){const t=TECHNOLOGIES.find(x=>x.id===next.activeResearchId);if(t){next.researchProgressDays+=aiSpeed*calculateTechBonuses(next).researchSpeedMultiplier;if(next.researchProgressDays>=t.durationDays){next.completedTechnologies.push(t.id);next.activeResearchId=null;next.researchProgressDays=0;notifications.push(`🔬 Pesquisa concluída: ${t.title}`)}}}
 return {techState:next,notifications};
}
function applyTechnologyEffect(e:TechnologyEffect,b:TechnologyBonuses){switch(e.type){case'GOOD_PRODUCTION':b.productionMultipliers[e.good]+=e.value;break;case'PRODUCTION_EFFICIENCY':for(const g of ['food','wood','iron','tools'] as const)b.productionMultipliers[g]+=e.value;break;case'RECRUITMENT_TIME':b.recruitmentTimeMultiplier+=e.value;break;case'COMBAT_POWER':for(const u of ['infantry','cavalry','artillery'] as const)b.combatPowerBonus[u]+=e.value;break;case'MILITARY_MAINTENANCE':b.militaryMaintenanceMultiplier+=e.value;break;case'FORTIFICATION_BONUS':b.fortificationMultiplier+=e.value;break;case'POPULATION_GROWTH':b.populationGrowthMultiplier+=e.value;break;case'POPULATION_CAPACITY':b.populationCapacityMultiplier+=e.value;break;case'GOLD_INCOME':b.goldIncomeMultiplier+=e.value;break;case'RESEARCH_SPEED':b.researchSpeedMultiplier+=e.value;break;}}
function applyFocus(e:RewardEffect,b:TechnologyBonuses){switch(e.type){case'COMBAT_POWER':if(e.unitType)b.combatPowerBonus[e.unitType]+=e.value;break;case'GOLD_INCOME':b.goldIncomeMultiplier+=e.value;break;case'BUILD_COST':b.buildCostMultiplier+=e.value;break;case'BUILD_TIME':b.buildTimeMultiplier+=e.value;break;case'MANPOWER':b.manpowerMultiplier+=e.value;break;case'RESEARCH_SPEED':b.researchSpeedMultiplier+=e.value;break;default:break;}}
export function calculateTechBonuses(state:CountryTechState):TechnologyBonuses {const b=baseBonuses();for(const id of state.completedFocuses){const f=NATIONAL_FOCUSES.find(x=>x.id===id);if(f)applyFocus(f.rewardEffect,b)}for(const id of state.completedTechnologies){const t=TECHNOLOGIES.find(x=>x.id===id);t?.effects.forEach(e=>applyTechnologyEffect(e,b))}return b;}
export function getMilitaryCombatBonuses(state: CountryTechState) { const b=calculateTechBonuses(state); return {...b.combatPowerBonus,fortificationMultiplier:b.fortificationMultiplier}; }
