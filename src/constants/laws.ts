import type { ActiveLaws, Law, LawCategory } from '../types/government';

const laws = [
  {id:'military_spending_low',category:'militarySpending',name:'Gasto Militar Baixo',description:'Reduz manutenção em 15% e recuperação em 5%; desagrada militares.',costGold:200,modifiers:{militaryMaintenanceMultiplier:.85}},
  {id:'military_spending_normal',category:'militarySpending',name:'Gasto Militar Normal',description:'Mantém manutenção e recuperação normais.',costGold:200,modifiers:{}},
  {id:'military_spending_high',category:'militarySpending',name:'Gasto Militar Alto',description:'Aumenta manutenção em 15% e recuperação em 5%; agrada militares.',costGold:500,modifiers:{militaryMaintenanceMultiplier:1.15}},
  {id:'social_restrictive',category:'social',name:'Política Social Restritiva',description:'Sem despesa social; reduz satisfação em 2 e apoio popular.',costGold:200,modifiers:{satisfactionModifier:-2}},
  {id:'social_balanced',category:'social',name:'Política Social Equilibrada',description:'Despesa diária de 0,005 ouro por mil habitantes.',costGold:200,modifiers:{}},
  {id:'social_supportive',category:'social',name:'Política Social de Apoio',description:'Despesa diária de 0,02 ouro por mil habitantes; satisfação +3 e apoio popular.',costGold:500,modifiers:{satisfactionModifier:3}},
  {id:'conscription_peacetime',category:'conscription',name:'Recrutamento em Tempo de Paz',description:'Forças voluntárias preservam trabalhadores e bem-estar.',costGold:0,modifiers:{manpowerMultiplier:1,recruitmentTimeMultiplier:1.1,militaryMaintenanceMultiplier:.95,satisfactionModifier:1}},
  {id:'conscription_limited',category:'conscription',name:'Recrutamento Limitado',description:'Mobilização moderada amplia as reservas com impacto controlado.',costGold:800,modifiers:{manpowerMultiplier:1.15,recruitmentTimeMultiplier:.95,recruitmentCostMultiplier:.95,populationGrowthMultiplier:.98,satisfactionModifier:-1}},
  {id:'conscription_total',category:'conscription',name:'Mobilização Total',description:'Mobilização de emergência amplia o exército, retirando mão de obra da economia.',costGold:2200,requirements:{atWar:true},modifiers:{manpowerMultiplier:1.3,recruitmentTimeMultiplier:.85,recruitmentCostMultiplier:1.1,militaryMaintenanceMultiplier:1.15,productionMultipliers:{food:.9,wood:.9,iron:.9,tools:.9},populationGrowthMultiplier:.9,satisfactionModifier:-6,purchasingPowerMultiplier:.9}},

  {id:'taxation_low',category:'taxation',name:'Tributação Baixa',description:'Menor arrecadação deixa renda disponível às famílias.',costGold:300,modifiers:{goldIncomeMultiplier:.85,populationGrowthMultiplier:1.05,satisfactionModifier:5,purchasingPowerMultiplier:1.1,migrationAttractionMultiplier:1.05}},
  {id:'taxation_normal',category:'taxation',name:'Tributação Normal',description:'Equilibra arrecadação e atividade econômica.',costGold:300,modifiers:{}},
  {id:'taxation_high',category:'taxation',name:'Tributação Alta',description:'Aumenta a receita estatal, reduzindo consumo e bem-estar.',costGold:900,modifiers:{goldIncomeMultiplier:1.2,populationGrowthMultiplier:.95,satisfactionModifier:-6,purchasingPowerMultiplier:.85,migrationAttractionMultiplier:.95}},

  {id:'governance_decentralized',category:'governance',name:'Governança Descentralizada',description:'Autonomia local favorece satisfação e circulação, com menor arrecadação central.',costGold:500,modifiers:{goldIncomeMultiplier:.95,constructionSpeedMultiplier:1.05,internalTradeMultiplier:1.05,satisfactionModifier:2,stabilityModifier:-.03}},
  {id:'governance_balanced',category:'governance',name:'Governança Balanceada',description:'Equilibra autonomia provincial e coordenação nacional.',costGold:500,modifiers:{}},
  {id:'governance_centralized',category:'governance',name:'Governança Centralizada',description:'Coordenação central melhora receita e pesquisa, mas reduz autonomia.',costGold:1400,modifiers:{goldIncomeMultiplier:1.08,researchSpeedMultiplier:1.05,constructionSpeedMultiplier:1.05,stabilityModifier:.05,satisfactionModifier:-3,internalTradeMultiplier:.95}},

  {id:'economy_civilian',category:'economy',name:'Economia Civil',description:'Prioriza consumo, alimentos e bem-estar em tempos de paz.',costGold:400,modifiers:{productionMultipliers:{food:1.05,wood:1,iron:.95,tools:1},purchasingPowerMultiplier:1.05,satisfactionModifier:2,militaryMaintenanceMultiplier:1.05}},
  {id:'economy_war_early',category:'economy',name:'Economia de Guerra Inicial',description:'Redireciona parte da economia para ferramentas, ferro e mobilização.',costGold:1200,requirements:{atWar:true},modifiers:{productionMultipliers:{food:.97,wood:1,iron:1.08,tools:1.08},constructionSpeedMultiplier:1.05,recruitmentTimeMultiplier:.95,purchasingPowerMultiplier:.95,satisfactionModifier:-2}},
  {id:'economy_war_total',category:'economy',name:'Economia de Guerra Total',description:'Mobilização industrial máxima com forte custo civil e social.',costGold:2500,requirements:{atWar:true},modifiers:{productionMultipliers:{food:.85,wood:1.05,iron:1.15,tools:1.15},constructionSpeedMultiplier:1.1,recruitmentTimeMultiplier:.85,manpowerMultiplier:1.1,militaryMaintenanceMultiplier:1.1,populationGrowthMultiplier:.9,purchasingPowerMultiplier:.8,satisfactionModifier:-8}},

  {id:'intel_disorganized',category:'intelligence',name:'Serviço de Informações Local',description:'Estrutura básica e barata, sem coordenação nacional.',costGold:0,modifiers:{}},
  {id:'intel_agency',category:'intelligence',name:'Agência de Inteligência',description:'Análise centralizada auxilia pesquisa e planejamento nacional.',costGold:1000,modifiers:{researchSpeedMultiplier:1.05,focusSpeedMultiplier:1.05,militaryMaintenanceMultiplier:1.02}},
  {id:'intel_total',category:'intelligence',name:'Diretoria Estratégica',description:'Uma rede ampla acelera pesquisa e planejamento, mas custa caro para manter.',costGold:2200,modifiers:{researchSpeedMultiplier:1.1,focusSpeedMultiplier:1.1,goldIncomeMultiplier:.95,militaryMaintenanceMultiplier:1.05,satisfactionModifier:-1}},

  {id:'agrarian_traditional',category:'agrarian',name:'Agricultura Tradicional',description:'Preserva práticas locais e custos administrativos baixos.',costGold:0,modifiers:{}},
  {id:'agrarian_incentives',category:'agrarian',name:'Incentivos Agrícolas',description:'Crédito e extensão rural elevam alimentos e atraem população.',costGold:900,modifiers:{productionMultipliers:{food:1.1},goldIncomeMultiplier:.97,migrationAttractionMultiplier:1.05}},
  {id:'agrarian_intensive',category:'agrarian',name:'Agricultura Intensiva',description:'Produção máxima de alimentos exige mais ferramentas e pressão social.',costGold:1800,modifiers:{productionMultipliers:{food:1.18,tools:.95},populationCapacityMultiplier:1.05,goldIncomeMultiplier:.94,satisfactionModifier:-2}},

  {id:'trade_provincial',category:'trade',name:'Mercados Provinciais',description:'Mercados locais operam com baixa intervenção.',costGold:0,modifiers:{}},
  {id:'trade_integrated',category:'trade',name:'Integração Comercial',description:'Administração de rotas amplia a redistribuição doméstica.',costGold:800,modifiers:{internalTradeMultiplier:1.12,goldIncomeMultiplier:1.03}},
  {id:'trade_controlled',category:'trade',name:'Comércio Controlado',description:'Reservas e controles protegem consumo, com menor poder de compra.',costGold:1300,modifiers:{internalTradeMultiplier:1.2,purchasingPowerMultiplier:.92,satisfactionModifier:-2,stabilityModifier:.02}},
] as const satisfies readonly Law[];

export const LAWS: Readonly<Record<string, Law>> = Object.fromEntries(laws.map(law => [law.id, law]));
export const LAW_CATEGORIES: readonly LawCategory[] = ['conscription','taxation','governance','economy','intelligence','agrarian','trade','militarySpending','social'];
export const LAWS_BY_CATEGORY: Readonly<Record<LawCategory, readonly string[]>> = {
  militarySpending:['military_spending_low','military_spending_normal','military_spending_high'],social:['social_restrictive','social_balanced','social_supportive'],
  conscription:['conscription_peacetime','conscription_limited','conscription_total'], taxation:['taxation_low','taxation_normal','taxation_high'], governance:['governance_decentralized','governance_balanced','governance_centralized'], economy:['economy_civilian','economy_war_early','economy_war_total'], intelligence:['intel_disorganized','intel_agency','intel_total'], agrarian:['agrarian_traditional','agrarian_incentives','agrarian_intensive'], trade:['trade_provincial','trade_integrated','trade_controlled'],
};
export const DEFAULT_LAWS: ActiveLaws = {conscription:'conscription_peacetime',taxation:'taxation_normal',governance:'governance_balanced',economy:'economy_civilian',intelligence:'intel_disorganized',agrarian:'agrarian_traditional',trade:'trade_provincial',militarySpending:'military_spending_normal',social:'social_balanced'};
