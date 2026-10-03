import type { Technology } from '../../../types/technology';
export const MILITARY_TECHNOLOGIES: Technology[] = [
 {id:'military_organization',title:'Organização Militar',description:'Estruturas eficientes aceleram o recrutamento.',category:'MILITARY',icon:'🎖️',costGold:350,durationDays:35,prerequisites:[],effects:[{type:'RECRUITMENT_TIME',value:-.10}]},
 {id:'improved_weapons',title:'Armas Melhoradas',description:'Armamento superior aumenta o poder de combate.',category:'MILITARY',icon:'⚔️',costGold:450,durationDays:45,prerequisites:['military_organization'],effects:[{type:'COMBAT_POWER',value:.10}]},
 {id:'military_logistics',title:'Logística Militar',description:'Suprimentos organizados reduzem a manutenção militar.',category:'MILITARY',icon:'📦',costGold:500,durationDays:50,prerequisites:['military_organization'],effects:[{type:'MILITARY_MAINTENANCE',value:-.10}]},
 {id:'fortifications',title:'Fortificações',description:'Projetos reforçados ampliam o bônus das fortalezas.',category:'MILITARY',icon:'🏰',costGold:550,durationDays:55,prerequisites:['improved_weapons'],effects:[{type:'FORTIFICATION_BONUS',value:.20}]},
 {id:'professional_army',title:'Exército Profissional',description:'Doutrina profissional aumenta a eficiência militar.',category:'MILITARY',icon:'🛡️',costGold:700,durationDays:65,prerequisites:['military_logistics','improved_weapons'],effects:[{type:'COMBAT_POWER',value:.10}]},
];
