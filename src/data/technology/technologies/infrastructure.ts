import type { Technology } from '../../../types/technology';
export const SOCIETY_TECHNOLOGIES: Technology[] = [
 {id:'sanitation',title:'Saneamento',description:'Saúde urbana favorece o crescimento populacional.',category:'SOCIETY',icon:'🚰',costGold:300,durationDays:30,prerequisites:[],effects:[{type:'POPULATION_GROWTH',value:.10}]},
 {id:'medicine',title:'Medicina',description:'Cuidados médicos ampliam a capacidade populacional.',category:'SOCIETY',icon:'⚕️',costGold:400,durationDays:40,prerequisites:['sanitation'],effects:[{type:'POPULATION_CAPACITY',value:.10}]},
 {id:'public_administration',title:'Administração Pública',description:'Gestão pública melhora a arrecadação.',category:'SOCIETY',icon:'🏛️',costGold:400,durationDays:40,prerequisites:[],effects:[{type:'GOLD_INCOME',value:.05}]},
 {id:'education',title:'Educação',description:'Ensino organizado acelera novas pesquisas.',category:'SOCIETY',icon:'📚',costGold:500,durationDays:50,prerequisites:['public_administration'],effects:[{type:'RESEARCH_SPEED',value:.10}]},
 {id:'urbanization',title:'Urbanização',description:'Planejamento urbano amplia ainda mais a capacidade.',category:'SOCIETY',icon:'🏙️',costGold:600,durationDays:60,prerequisites:['medicine'],effects:[{type:'POPULATION_CAPACITY',value:.10}]},
];
export const INFRASTRUCTURE_TECHNOLOGIES = SOCIETY_TECHNOLOGIES;
