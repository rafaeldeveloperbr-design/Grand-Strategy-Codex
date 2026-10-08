import type { Country } from '../../../../types';
import { DEFAULT_LAWS } from '../../../../constants/laws';
import { definitions } from './definitions';

// Strategic gameplay starts, not historical budgets/census figures.
const countryDefinitions: readonly [tag:string,name:string,adjective:string,color:string,colorLight:string,capitalId:string,flag:string][] = [
  ["AUS", "Austrália", "Australiana", "#925e72", "#b88498", "oc_aus_new_south_wales", "🇦🇺"],
  ["NZL", "Nova Zelândia", "Neozelandesa", "#a77d51", "#cda377", "oc_nzl_north_island", "🇳🇿"],
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
