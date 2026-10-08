import type { Building, ProvinceMarket } from '../../types';
import type { TerrainType } from '../../engine/terrain';
import type { ProvinceGameplay } from './types';

/** Shared scenario defaults, unchanged from South America V1. */
export function createProvinceGameplay(
  [id, name, owner, total, development]: readonly [string, string, string, number, number],
  terrain: TerrainType,
  color: string,
): ProvinceGameplay {
  const good = (stock: number, price: number) => ({stock,price,production:0,demand:0,consumption:0,shortage:0,imported:0,exported:0});
  const market: ProvinceMarket = {
    goods: {food:good(total / 1000 * 15,1),wood:good(100,2),iron:good(60,4),tools:good(45,8)},
    purchasingPower:50,
  };
  const buildings: Building[] = [
    {type:'farm',level:total >= 24000 ? 5 : total >= 16000 ? 4 : 3,daysRemaining:0},
    {type:'lumber_mill',level:1,daysRemaining:0},
    {type:'iron_mine',level:1,daysRemaining:0},
    {type:'workshop',level:1,daysRemaining:0},
  ];
  if (development >= 6) buildings.push(
    {type:'market',level:1,daysRemaining:0},
    {type:'infrastructure',level:development >= 7 ? 2 : 1,daysRemaining:0},
  );
  return {
    id,name,owner,originalOwner:owner,color,terrain,
    population:{total,growthRate:.002,employed:Math.round(total*.5),unemployed:Math.round(total*.1),satisfaction:65},
    maxPopulation:total*2,development,buildings,defense:development >= 7 ? 4 : 2,
    unrest:0,market,
  };
}
