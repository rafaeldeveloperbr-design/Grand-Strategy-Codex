import type { NationalFocus } from '../../../types/technology';

// Permanent domestic support for foreign policy; these do not create treaties or claims.
export const DIPLOMATIC_FOCUSES: NationalFocus[] = [
  {id:'focus_regional_diplomacy',title:'Diplomacia Regional',description:'Uma administração diplomática estável apoia a política externa.',category:'DIPLOMACY',icon:'🌐',position:{column:10,row:0},durationDays:60,rewardEffects:[{type:'STABILITY',value:.05}]},
  {id:'focus_alliance_policy',title:'Política de Alianças',description:'A cooperação regional atrai população e fortalece a coesão interna.',category:'DIPLOMACY',icon:'🤝',position:{column:10,row:1},durationDays:80,prerequisites:['focus_regional_diplomacy'],mutuallyExclusive:['focus_regional_projection'],rewardEffects:[{type:'MIGRATION_ATTRACTION',value:.1},{type:'SATISFACTION',value:2}]},
  {id:'focus_external_guarantees',title:'Preparação para Garantias Externas',description:'Prepara defesas e reservas para sustentar compromissos externos.',category:'DIPLOMACY',icon:'🛡️',position:{column:10,row:2},durationDays:95,prerequisites:['focus_alliance_policy'],rewardEffects:[{type:'DEFENSE_BONUS',value:.1},{type:'MANPOWER',value:.05}]},
  {id:'focus_regional_projection',title:'Projeção Regional',description:'Amplia a base fiscal para sustentar uma política externa independente.',category:'DIPLOMACY',icon:'🧭',position:{column:11,row:1},durationDays:80,prerequisites:['focus_regional_diplomacy'],mutuallyExclusive:['focus_alliance_policy'],rewardEffects:[{type:'GOLD_INCOME',value:.05}]},
  {id:'focus_territorial_ambitions',title:'Ambições Territoriais',description:'Organiza reservas e recrutamento para futuras campanhas territoriais.',category:'DIPLOMACY',icon:'🗺️',position:{column:11,row:2},durationDays:100,prerequisites:['focus_regional_projection'],rewardEffects:[{type:'MANPOWER',value:.1},{type:'RECRUITMENT_TIME',value:-.05}]},
];
