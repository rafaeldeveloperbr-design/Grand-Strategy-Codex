import type { Country } from '../../../../types';
import { DEFAULT_LAWS } from '../../../../constants/laws';
import { definitions } from './definitions';

// Strategic gameplay starts, not historical budgets/census figures.
const countryDefinitions: readonly [tag:string,name:string,adjective:string,color:string,colorLight:string,capitalId:string,flag:string][] = [
  ['CAN','Canadá','Canadense','#a34e55','#c7737b','na_can_ontario','🇨🇦'],
  ['USA','Estados Unidos','Estadunidense','#527da8','#7ba2cb','na_usa_washington','🇺🇸'],
  ['MEX','México','Mexicana','#438e73','#6daf95','na_mex_central_mexico','🇲🇽'],
  ['GTM','Guatemala','Guatemalteca','#679bba','#91bdd4','na_gtm_guatemala','🇬🇹'],
  ['BLZ','Belize','Belizenha','#746dab','#9990cc','na_blz_belize','🇧🇿'],
  ['HND','Honduras','Hondurenha','#4da6ae','#80c3c9','na_hnd_honduras','🇭🇳'],
  ['SLV','El Salvador','Salvadorenha','#7e91b5','#a5b5d1','na_slv_el_salvador','🇸🇻'],
  ['NIC','Nicarágua','Nicaraguense','#6489c2','#90ade0','na_nic_nicaragua','🇳🇮'],
  ['CRI','Costa Rica','Costarriquenha','#b47765','#d6a18e','na_cri_costa_rica','🇨🇷'],
  ['PAN','Panamá','Panamenha','#b09a50','#d2bc74','na_pan_panama','🇵🇦'],
  ['CUB','Cuba','Cubana','#bb5f63','#de888b','na_cub_cuba','🇨🇺'],
  ['HTI','Haiti','Haitiana','#8a67a6','#af8bc8','na_hti_haiti','🇭🇹'],
  ['DOM','República Dominicana','Dominicana','#c2874e','#dfaf77','na_dom_dominican_republic','🇩🇴'],
  ['JAM','Jamaica','Jamaicana','#789349','#a2b971','na_jam_jamaica','🇯🇲'],
];

export const countries: Country[] = countryDefinitions.map(([tag,name,adjective,color,colorLight,capitalId,flag]) => {
  const holdings = definitions.filter(d => d[2] === tag);
  const population = holdings.reduce((sum,d) => sum+d[3],0);
  const development = holdings.reduce((sum,d) => sum+d[4],0);
  const manpower = Math.round(population*.09);
  return {
    tag,name,adjective,color,colorLight,capitalId,flag,provinces:holdings.map(d=>d[0]),
    resources:{gold:Math.round(1200+development*85),manpower,maxManpower:manpower*3,stability:80,prestige:40+Math.min(20,holdings.length)},
    economy:{goldIncome:0,goldExpense:0,manpowerGain:0,manpowerExpense:0},
    activeLaws:{...DEFAULT_LAWS},
  };
});
