import type { Technology } from '../../../types/technology';
export const ECONOMIC_TECHNOLOGIES: Technology[] = [
  { id:'improved_agriculture', title:'Agricultura Melhorada', description:'Métodos agrícolas elevam a oferta de alimentos.', category:'ECONOMY', icon:'🌾', costGold:300, durationDays:30, prerequisites:[], effects:[{type:'GOOD_PRODUCTION',good:'food',value:.10}] },
  { id:'advanced_sawmills', title:'Serrarias Avançadas', description:'Serrarias mecanizadas produzem mais madeira.', category:'ECONOMY', icon:'🪵', costGold:350, durationDays:35, prerequisites:[], effects:[{type:'GOOD_PRODUCTION',good:'wood',value:.10}] },
  { id:'advanced_mining', title:'Mineração Avançada', description:'Novas técnicas ampliam a extração de ferro.', category:'ECONOMY', icon:'⛏️', costGold:400, durationDays:40, prerequisites:[], effects:[{type:'GOOD_PRODUCTION',good:'iron',value:.10}] },
  { id:'standardized_tools', title:'Ferramentas Padronizadas', description:'Padrões melhoram a manufatura de ferramentas.', category:'ECONOMY', icon:'🛠️', costGold:450, durationDays:45, prerequisites:['advanced_sawmills','advanced_mining'], effects:[{type:'GOOD_PRODUCTION',good:'tools',value:.10}] },
  { id:'commercial_administration', title:'Administração Comercial', description:'Coordenação comercial melhora toda a produção.', category:'ECONOMY', icon:'📈', costGold:550, durationDays:50, prerequisites:['improved_agriculture'], effects:[{type:'PRODUCTION_EFFICIENCY',value:.05}] },
];
