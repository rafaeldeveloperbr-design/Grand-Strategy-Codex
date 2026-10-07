import type { GovernmentType, PoliticalGroupId } from '../../types/politics';
export const GROUP_IDS: PoliticalGroupId[] = ['landowners','merchants','workers','military','reformists'];
export const GROUP_LABELS: Record<PoliticalGroupId,string> = {landowners:'Proprietários',merchants:'Comerciantes',workers:'Trabalhadores',military:'Militares',reformists:'Reformistas'};
export interface GovernmentDefinition {
  label: string;
  legitimacyModifier: number;
  stabilityModifier: number;
  taxEfficiencyModifier: number;
  militaryModifier: number;
  unrestModifier: number;
  reformCostModifier: number;
  groupApproval: Record<PoliticalGroupId,number>;
}
export const GOVERNMENT_DEFINITIONS: Record<GovernmentType,GovernmentDefinition> = {
  absolute_monarchy:{label:'Monarquia Absoluta',legitimacyModifier:5,stabilityModifier:2,taxEfficiencyModifier:1,militaryModifier:1,unrestModifier:-1,reformCostModifier:1.1,groupApproval:{landowners:15,merchants:0,workers:-5,military:5,reformists:-15}},
  constitutional_monarchy:{label:'Monarquia Constitucional',legitimacyModifier:2,stabilityModifier:4,taxEfficiencyModifier:1,militaryModifier:1,unrestModifier:0,reformCostModifier:1,groupApproval:{landowners:5,merchants:5,workers:0,military:0,reformists:5}},
  republic:{label:'República',legitimacyModifier:0,stabilityModifier:0,taxEfficiencyModifier:1,militaryModifier:1,unrestModifier:0,reformCostModifier:.9,groupApproval:{landowners:-5,merchants:5,workers:5,military:0,reformists:15}},
  oligarchy:{label:'Oligarquia',legitimacyModifier:-2,stabilityModifier:0,taxEfficiencyModifier:1.03,militaryModifier:1,unrestModifier:1,reformCostModifier:1.05,groupApproval:{landowners:10,merchants:15,workers:-10,military:0,reformists:-10}},
  military_government:{label:'Governo Militar',legitimacyModifier:-5,stabilityModifier:2,taxEfficiencyModifier:1,militaryModifier:1.02,unrestModifier:-2,reformCostModifier:1.1,groupApproval:{landowners:5,merchants:-5,workers:-10,military:20,reformists:-20}},
};
export const POLITICS_BALANCE = {
  tickDays:30,policyChangeCooldown:365,policyCost:20,policyLegitimacyCost:2,policyStabilityCost:1,
  defaultLegitimacy:65,defaultPoliticalCapital:40,defaultStability:60,
  approvalBaseline:60,defeatScore:-25,
  legitimacyDrift:1.5,stabilityDrift:1,approvalDrift:6,politicalCapitalGain:3,
  legitimacyWeights:{satisfaction:.4,stability:.2,support:.4},
  stabilityWeights:{satisfaction:.25,legitimacy:.25,support:.5},
  warLegitimacyPenalty:3,defeatPenalty:8,economicSuccessBonus:3,unemploymentLegitimacyPenalty:10,
  legitimacyPressureBaseline:50,legitimacyPressure:.12,groupDisapprovalThreshold:-30,groupPressure:.08,
  rebelliousGroupInfluence:15,rebelliousGroupApproval:-40,
  socialExpense:{restrictive:0,balanced:.000005,supportive:.00002}, // gold / person / day, relative to existing tax scale
  recovery:{low:.95,normal:1,high:1.05},
  concessionsLegitimacy:1,repressionLegitimacy:-2,forcedLegitimacy:45,forcedStability:30,
  victoryApproval:25,
  relevantBattleCasualties:500,battleLossLegitimacy:2,battleWinLegitimacy:1,battleMilitaryApproval:3,
  influence:{base:10,farm:4,market:5,workshop:4,barracks:4,ruralDevelopment:.6,development:.3,employed:1/20000,armySize:1/2000,militaryExpense:2,tradeValue:.01,wealth:.0001,openGovernment:8},
  approval:{satisfaction:.5,stability:.15,unemployment:60,economicBalance:4,warMilitary:5,defeatMilitary:12},
  policyApproval:{
    trade_integrated:{landowners:0,merchants:8,workers:3,military:0,reformists:3},
    trade_controlled:{landowners:3,merchants:-5,workers:0,military:2,reformists:-3},
    agrarian_incentives:{landowners:8,merchants:0,workers:3,military:0,reformists:0},
    conscription_limited:{landowners:0,merchants:0,workers:-2,military:5,reformists:0},
    conscription_total:{landowners:0,merchants:-3,workers:-8,military:10,reformists:-5},
    economy_war_total:{landowners:0,merchants:-3,workers:-8,military:8,reformists:-3},
    taxation_low:{landowners:10,merchants:10,workers:15,military:-3,reformists:5},
    taxation_high:{landowners:-10,merchants:-15,workers:-20,military:3,reformists:-5},
    military_spending_low:{landowners:0,merchants:3,workers:3,military:-20,reformists:3},
    military_spending_high:{landowners:0,merchants:-3,workers:-3,military:20,reformists:-5},
    social_restrictive:{landowners:5,merchants:3,workers:-15,military:0,reformists:-10},
    social_supportive:{landowners:-3,merchants:-3,workers:15,military:0,reformists:10},
    governance_centralized:{landowners:5,merchants:0,workers:-3,military:5,reformists:-15},
    governance_decentralized:{landowners:0,merchants:3,workers:5,military:-5,reformists:10},
  } as Record<string,Record<PoliticalGroupId,number>>,
  ai:{highUnrest:30,lowSatisfaction:45,poorTreasury:500,safeLegitimacy:45,safeStability:40,warTreasury:1500,workerApprovalThreshold:-30,safeSatisfaction:50},
} as const;
/** Gameplay scenario, not a historical reconstruction. */
export const SCENARIO_GOVERNMENTS: Record<string,GovernmentType> = {BRA:'constitutional_monarchy',ARG:'republic',CHL:'republic',URY:'republic',PRY:'absolute_monarchy',BOL:'oligarchy',PER:'republic',ECU:'constitutional_monarchy',COL:'republic',VEN:'military_government',GUY:'oligarchy',SUR:'oligarchy',GUF:'constitutional_monarchy'};
