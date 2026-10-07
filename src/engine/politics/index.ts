import type { Army, Country, GameDate, Province, War } from '../../types';
import type { PoliticsState, PoliticalGroupId, GovernmentType } from '../../types/politics';
import { DEFAULT_LAWS, LAWS, LAW_CATEGORIES } from '../../constants/laws';
import { getBuildingPoliticalInfluence } from '../../data/buildings';
import { normalizePopulation, calculateWorkforce } from '../population';
import { calculateArmySize, calculateArmyMaintenance } from '../military/armyStats';
import { chooseAILaw } from '../government';
import { GOVERNMENT_DEFINITIONS, GROUP_IDS, GROUP_LABELS, POLITICS_BALANCE as B, SCENARIO_GOVERNMENTS } from './balance';
export { GOVERNMENT_DEFINITIONS, GROUP_IDS, GROUP_LABELS, POLITICS_BALANCE } from './balance';
export type { PoliticsState, GovernmentType, PoliticalGroupId } from '../../types/politics';
export const finite = (n: unknown, fallback=0): number => typeof n==='number' && Number.isFinite(n) ? n : fallback;
export const clampPolitics = (n: unknown,min=0,max=100): number => Math.max(min,Math.min(max,finite(n)));
export const politicsDay = (d: GameDate) => d.year*360+(d.month-1)*30+d.day-1;
export function normalizePolitics(value: Partial<PoliticsState> | undefined,tag=''): PoliticsState {
  const governmentType=value?.governmentType;
  const valid=governmentType && Object.prototype.hasOwnProperty.call(GOVERNMENT_DEFINITIONS,governmentType);
  const type=valid ? governmentType! : SCENARIO_GOVERNMENTS[tag] ?? 'constitutional_monarchy';
  const approval=Object.fromEntries(GROUP_IDS.map(id => [id,clampPolitics(value?.approval?.[id] ?? GOVERNMENT_DEFINITIONS[type].groupApproval[id],-100,100)])) as Record<PoliticalGroupId,number>;
  return {governmentType:type,legitimacy:clampPolitics(value?.legitimacy ?? B.defaultLegitimacy+GOVERNMENT_DEFINITIONS[type].legitimacyModifier),politicalCapital:clampPolitics(value?.politicalCapital ?? B.defaultPoliticalCapital),approval,
    ...(Number.isFinite(value?.lastTickDay) ? {lastTickDay:value!.lastTickDay} : {}),...(Number.isFinite(value?.lastPolicyChangeDay) ? {lastPolicyChangeDay:value!.lastPolicyChangeDay} : {})};
}
export function initializePolitics(country: Country): Country {
  return {...country,politics:normalizePolitics(country.politics,country.tag),resources:{...country.resources,stability:clampPolitics(finite(country.resources.stability,B.defaultStability))}};
}
export interface PoliticsContext {provinces:Province[];armies:Army[];wars:War[];date:GameDate}
export function politicalIndicators(country: Country,ctx: Pick<PoliticsContext,'provinces'|'armies'|'wars'>) {
  const owned=ctx.provinces.filter(p => p.owner===country.tag),pop=owned.map(p => normalizePopulation(p.population));
  const total=pop.reduce((s,p) => s+p.total,0),workforce=pop.reduce((s,p) => s+calculateWorkforce(p),0);
  const satisfaction=total ? pop.reduce((s,p) => s+p.satisfaction*p.total,0)/total : B.approvalBaseline;
  const unemployment=workforce ? pop.reduce((s,p) => s+p.unemployed,0)/workforce : 0;
  const unrest=owned.length ? owned.reduce((s,p) => s+finite(p.unrest),0)/owned.length : 0;
  const activeWars=ctx.wars.filter(w => w.attacker===country.tag || w.defender===country.tag);
  return {owned,total,satisfaction,unemployment:clampPolitics(unemployment,0,1),unrest,atWar:activeWars.length>0,defeated:activeWars.some(w => (w.attacker===country.tag ? w.warScore : -w.warScore)<B.defeatScore)};
}
export function calculatePoliticalGroups(country: Country,ctx: Pick<PoliticsContext,'provinces'|'armies'|'wars'>) {
  const politics=normalizePolitics(country.politics,country.tag),definition=GOVERNMENT_DEFINITIONS[politics.governmentType],indicators=politicalIndicators(country,ctx),I=B.influence;
  const buildingInfluence=(group: PoliticalGroupId) => indicators.owned.reduce((sum,p) => sum+getBuildingPoliticalInfluence(p,group),0);
  const development=indicators.owned.reduce((s,p) => s+finite(p.development),0);
  const military=ctx.armies.filter(a => a.owner===country.tag);
  const trade=Object.values(country.trade?.goods ?? {}).reduce((s,g) => s+finite(g.importValue)+finite(g.exportValue),0);
  const weights:Record<PoliticalGroupId,number>={
    landowners:I.base+buildingInfluence('landowners')+development*I.ruralDevelopment,
    merchants:I.base+buildingInfluence('merchants')+trade*I.tradeValue+Math.max(0,finite(country.resources.gold))*I.wealth,
    workers:I.base+buildingInfluence('workers')+indicators.owned.reduce((s,p) => s+normalizePopulation(p.population).employed,0)*I.employed,
    military:I.base+buildingInfluence('military')+military.reduce((s,a) => s+calculateArmySize(a)*I.armySize+calculateArmyMaintenance(a)*I.militaryExpense,0),
    reformists:I.base+buildingInfluence('reformists')+development*I.development+(['republic','constitutional_monarchy'].includes(politics.governmentType) ? I.openGovernment : 0),
  };
  const safe=GROUP_IDS.map(id => Math.max(I.base,finite(weights[id],I.base))),sum=safe.reduce((s,n) => s+n,0);
  return GROUP_IDS.map((id,i) => {
    const effects:Array<{label:string;value:number}>=[{label:definition.label,value:definition.groupApproval[id]},
      {label:'Satisfação',value:(indicators.satisfaction-B.approvalBaseline)*B.approval.satisfaction},
      {label:'Estabilidade',value:(finite(country.resources.stability,B.defaultStability)-B.approvalBaseline)*B.approval.stability}];
    if (id==='workers') effects.push({label:'Desemprego',value:-indicators.unemployment*B.approval.unemployment});
    if (id==='merchants') effects.push({label:'Saldo econômico',value:Math.sign(finite(country.economy.goldIncome)-finite(country.economy.goldExpense))*B.approval.economicBalance});
    if (id==='military' && indicators.atWar) effects.push({label:'Guerra',value:indicators.defeated ? -B.approval.defeatMilitary : B.approval.warMilitary});
    for(const category of LAW_CATEGORIES) {
      const lawId=country.activeLaws[category] ?? DEFAULT_LAWS[category]!;
      const value=B.policyApproval[lawId]?.[id];if(value) effects.push({label:LAWS[lawId]?.name ?? lawId,value});
    }
    return {id,name:GROUP_LABELS[id],influence:safe[i]/sum*100,approval:politics.approval[id],target:clampPolitics(effects.reduce((s,e) => s+e.value,0),-100,100),effects};
  });
}
export function governmentSupport(groups: Array<{influence:number;approval:number}>): number {
  const weight=groups.reduce((s,g) => s+Math.max(0,finite(g.influence)),0);
  return weight ? clampPolitics(50+groups.reduce((s,g) => s+clampPolitics(g.approval,-100,100)*Math.max(0,finite(g.influence)),0)/weight/2) : 50;
}
export function legitimacyDescription(value:number): string {return value<20 ? 'Crise de legitimidade' : value<40 ? 'Fraca' : value<60 ? 'Contestada' : value<80 ? 'Estável' : 'Forte';}
export function legitimacyFactors(country:Country,ctx:Pick<PoliticsContext,'provinces'|'armies'|'wars'>) {
  const p=normalizePolitics(country.politics,country.tag),g=GOVERNMENT_DEFINITIONS[p.governmentType],i=politicalIndicators(country,ctx),support=governmentSupport(calculatePoliticalGroups(country,ctx)),w=B.legitimacyWeights;
  return [{label:'Satisfação',value:i.satisfaction*w.satisfaction},{label:'Estabilidade',value:finite(country.resources.stability,B.defaultStability)*w.stability},{label:'Apoio dos grupos',value:support*w.support},
    {label:'Forma de governo',value:g.legitimacyModifier},{label:'Guerra',value:i.atWar ? -B.warLegitimacyPenalty : 0},{label:'Derrotas relevantes',value:i.defeated ? -B.defeatPenalty : 0},
    {label:'Saldo econômico positivo',value:country.economy.goldIncome>country.economy.goldExpense ? B.economicSuccessBonus : 0},{label:'Desemprego',value:-i.unemployment*B.unemploymentLegitimacyPenalty}];
}
const drift=(current:number,target:number,rate:number) => clampPolitics(current+Math.max(-rate,Math.min(rate,target-current)));
export function politicsModifiers(country:Country) {
  if(!country.politics) return {tax:1,maintenance:1,socialCostPerPerson:0,recovery:1,unrest:0};
  const g=GOVERNMENT_DEFINITIONS[normalizePolitics(country.politics,country.tag).governmentType];
  const social=country.activeLaws.social==='social_supportive' ? 'supportive' : country.activeLaws.social==='social_restrictive' ? 'restrictive' : 'balanced';
  const spending=country.activeLaws.militarySpending==='military_spending_high' ? 'high' : country.activeLaws.militarySpending==='military_spending_low' ? 'low' : 'normal';
  return {tax:g.taxEfficiencyModifier,maintenance:g.militaryModifier,socialCostPerPerson:B.socialExpense[social],recovery:B.recovery[spending],unrest:g.unrestModifier};
}
export function politicalRebellionPressure(country:Country,ctx:Pick<PoliticsContext,'provinces'|'armies'|'wars'>): number {
  if(!country.politics) return 0;
  const p=normalizePolitics(country.politics,country.tag),groups=calculatePoliticalGroups(country,ctx);
  const hostile=groups.reduce((s,g) => s+Math.max(0,B.groupDisapprovalThreshold-g.approval)*g.influence/100,0)*B.groupPressure;
  return Math.max(0,B.legitimacyPressureBaseline-p.legitimacy)*B.legitimacyPressure+hostile+politicsModifiers(country).unrest;
}
export function politicalRebelPreference(country:Country,ctx:Pick<PoliticsContext,'provinces'|'armies'|'wars'>): 'pretenders'|'revolutionaries'|undefined {
  if(!country.politics) return;
  const p=normalizePolitics(country.politics,country.tag);
  const groups=calculatePoliticalGroups(country,ctx),pressure=(id:PoliticalGroupId) => {
    const group=groups.find(g => g.id===id)!;
    return group.influence>=B.rebelliousGroupInfluence && p.approval[id]<B.rebelliousGroupApproval ? group.influence*(B.rebelliousGroupApproval-p.approval[id]) : 0;
  };
  const revolutionary=pressure('workers')+pressure('reformists'),pretender=pressure('military')+pressure('landowners');
  if(revolutionary>0 || pretender>0) return revolutionary>=pretender ? 'revolutionaries' : 'pretenders';
}
export function validatePolicyChange(country:Country,lawId:string,date:GameDate,atWar=false) {
  const law=LAWS[lawId],politics=normalizePolitics(country.politics,country.tag),cost=Math.ceil(B.policyCost*GOVERNMENT_DEFINITIONS[politics.governmentType].reformCostModifier);
  const remaining=politics.lastPolicyChangeDay===undefined ? 0 : Math.max(0,B.policyChangeCooldown-(politicsDay(date)-politics.lastPolicyChangeDay));
  let reason:string|null=null;
  if(!law) reason='Lei inexistente';
  else if((country.activeLaws[law.category] ?? DEFAULT_LAWS[law.category])===lawId) reason='Esta política já está ativa';
  else if(law.requirements?.atWar && !atWar) reason='Disponível somente durante uma guerra';
  else if(remaining) reason=`Cooldown: ${remaining} dias`;
  else if(politics.politicalCapital<cost) reason='Capital político insuficiente';
  else if(!Number.isFinite(country.resources.gold)) reason='Tesouro inválido';
  else if(country.resources.gold<law.costGold) reason='Ouro insuficiente';
  else if(country.isAnnexed || country.tag.startsWith('rebel_') || !country.provinces.length) reason='País sem governo territorial válido';
  return {allowed:reason===null,reason,cost,goldCost:law?.costGold ?? 0,remaining};
}
export function changeGovernmentPolicy(country:Country,lawId:string,date:GameDate,atWar=false) {
  const validation=validatePolicyChange(country,lawId,date,atWar);if(!validation.allowed) return {...validation,country,message:validation.reason!};
  const law=LAWS[lawId],politics=normalizePolitics(country.politics,country.tag),old=country.activeLaws[law.category] ?? DEFAULT_LAWS[law.category]!;
  const approval={...politics.approval};
  for(const id of GROUP_IDS) approval[id]=clampPolitics(approval[id]+(B.policyApproval[lawId]?.[id] ?? 0)-(B.policyApproval[old]?.[id] ?? 0),-100,100);
  const negative=GROUP_IDS.map(id => ({id,delta:(B.policyApproval[lawId]?.[id] ?? 0)-(B.policyApproval[old]?.[id] ?? 0)})).filter(g => g.delta<0).sort((a,b) => a.delta-b.delta)[0];
  return {...validation,country:{...country,activeLaws:{...country.activeLaws,[law.category]:lawId},resources:{...country.resources,gold:country.resources.gold-law.costGold,stability:clampPolitics(country.resources.stability-B.policyStabilityCost)},politics:{...politics,approval,politicalCapital:politics.politicalCapital-validation.cost,legitimacy:clampPolitics(politics.legitimacy-B.policyLegitimacyCost),lastPolicyChangeDay:politicsDay(date)}},message:`${country.name} adotou ${law.name}.${negative ? ` ${GROUP_LABELS[negative.id]} desaprovam a mudança.` : ''}`};
}
export function choosePoliticalPolicy(country:Country,ctx:PoliticsContext): string|null {
  const i=politicalIndicators(country,ctx),p=normalizePolitics(country.politics,country.tag),A=B.ai;
  const candidates = i.unrest>A.highUnrest || i.satisfaction<A.lowSatisfaction || p.legitimacy<A.safeLegitimacy || p.approval.workers<A.workerApprovalThreshold
    ? ['taxation_low',...(country.resources.gold>A.poorTreasury ? ['social_supportive'] : [])]
    : country.resources.gold<A.poorTreasury || country.economy.goldExpense>country.economy.goldIncome
      ? (p.legitimacy>=A.safeLegitimacy && country.resources.stability>=A.safeStability && i.satisfaction>A.safeSatisfaction ? ['social_restrictive',...(ctx.armies.some(a => a.owner===country.tag) ? [i.atWar ? 'military_spending_normal' : 'military_spending_low'] : []),'taxation_high'] : [])
      : i.atWar && country.resources.gold>A.warTreasury ? ['military_spending_high']
      : !i.atWar && country.activeLaws.militarySpending==='military_spending_high' ? ['military_spending_normal'] : [];
  const chosen=candidates.find(id => validatePolicyChange(country,id,ctx.date,i.atWar).allowed);
  if(chosen) return chosen;
  // Keep useful older agrarian/trade/mobilization choices, but route them
  // through the same political costs/cooldown and only after urgent policies.
  if(candidates.some(id => (country.activeLaws[LAWS[id].category] ?? DEFAULT_LAWS[LAWS[id].category])!==id)) return null;
  const legacy=chooseAILaw(country,ctx.provinces,{atWar:i.atWar});
  return legacy && validatePolicyChange(country,legacy,ctx.date,i.atWar).allowed ? legacy : null;
}
export function processPoliticalTick(countries:Country[],ctx:PoliticsContext,playerTag?:string) {
  const messages:string[]=[],day=politicsDay(ctx.date);
  const result=countries.map(original => {
    if(original.isAnnexed || original.tag.startsWith('rebel_') || !ctx.provinces.some(p => p.owner===original.tag)) return original;
    let country=initializePolitics(original),p=country.politics!;
    if(p.lastTickDay===undefined) return {...country,politics:{...p,lastTickDay:day}};
    if(day-p.lastTickDay<B.tickDays) return country;
    const groups=calculatePoliticalGroups(country,ctx),approval={...p.approval};
    for(const group of groups) approval[group.id]=Math.max(-100,Math.min(100,p.approval[group.id]+Math.max(-B.approvalDrift,Math.min(B.approvalDrift,group.target-p.approval[group.id]))));
    country={...country,politics:{...p,approval}};
    const support=governmentSupport(calculatePoliticalGroups(country,ctx)),i=politicalIndicators(country,ctx),g=GOVERNMENT_DEFINITIONS[p.governmentType];
    const legitimacyTarget=clampPolitics(legitimacyFactors(country,ctx).reduce((s,f) => s+f.value,0));
    const stabilityTarget=clampPolitics(i.satisfaction*B.stabilityWeights.satisfaction+p.legitimacy*B.stabilityWeights.legitimacy+support*B.stabilityWeights.support+g.stabilityModifier);
    p={...country.politics!,legitimacy:drift(p.legitimacy,legitimacyTarget,B.legitimacyDrift),politicalCapital:clampPolitics(p.politicalCapital+B.politicalCapitalGain*(p.legitimacy+country.resources.stability+support)/300),lastTickDay:day};
    country={...country,politics:p,resources:{...country.resources,stability:drift(country.resources.stability,stabilityTarget,B.stabilityDrift)}};
    if(playerTag && country.tag!==playerTag) {
      const law=choosePoliticalPolicy(country,ctx);if(law) {const changed=changeGovernmentPolicy(country,law,ctx.date,i.atWar);country=changed.country;messages.push(changed.message);}
    }
    return country;
  });return {countries:result,messages};
}
export function forcedGovernmentChange(country:Country,kind:'replace_government'|'reform'):Country {
  const p=normalizePolitics(country.politics,country.tag),governmentType:GovernmentType=kind==='reform' ? 'republic' : p.governmentType==='military_government' ? 'absolute_monarchy' : 'military_government';
  return {...country,resources:{...country.resources,stability:B.forcedStability},politics:{...p,governmentType,legitimacy:B.forcedLegitimacy,approval:{...p.approval,...(kind==='reform' ? {workers:B.victoryApproval,reformists:B.victoryApproval} : {military:B.victoryApproval,landowners:B.victoryApproval})}}};
}
export function politicalConsequence(country:Country,repression:boolean):Country {
  if(!country.politics) return country;const p=normalizePolitics(country.politics,country.tag);
  return {...country,politics:{...p,legitimacy:clampPolitics(p.legitimacy+(repression ? B.repressionLegitimacy : B.concessionsLegitimacy))}};
}
export function politicalBattleOutcome(country:Country,won:boolean,casualties:number):Country {
  if(!country.politics || casualties<B.relevantBattleCasualties) return country;
  const p=normalizePolitics(country.politics,country.tag);
  return {...country,politics:{...p,legitimacy:clampPolitics(p.legitimacy+(won ? B.battleWinLegitimacy : -B.battleLossLegitimacy)),approval:{...p.approval,military:clampPolitics(p.approval.military+(won ? B.battleMilitaryApproval : -B.battleMilitaryApproval),-100,100)}}};
}
