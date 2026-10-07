import { describe, expect, it } from 'vitest';
import type { BuildingConstruction, BuildingType, Province } from '../../types';
import { countries, provincesData } from '../../data/map';
import { BUILDING_DEFINITIONS, getBuildingCosts, getBuildingTime, getBuildingLevel, getBuildingBonus, getMilitaryEquipmentCostMultiplier, meetsBuildingRequirement } from '../../data/buildings';
import { startBuilding, getBuildingBlockReasons, processConstructions, getConstructionTargetLevel, cancelBuilding } from '../buildings';
import { calculateProduction, createDefaultMarket, getStorageCapacity, processProvinceMarket } from '../market';
import { getPopulationCapacity } from '../population';
import { getEffectiveRecruitmentCost, queueRecruitment, processRecruitments, recoverArmy } from '../military';
import { UNIT_DEFINITIONS } from '../../data/units';
import { calculateProvinceDefense } from '../economy';
import { buildLogisticsNetworks, logisticsInfrastructureModifier } from '../logistics';
import { calculateLocalSupplyBaseCapacity } from '../military/supplyEngine';
import { calculatePoliticalGroups } from '../politics';
import { migrateBuildingConstructions, migrateLegacyBuildings } from '../saveSystem';
import { rankBuildingProjects } from '../buildings/constructionAI';
import { processAIEconomicDecisions } from '../aiEngine/aiEconomy';
import { createInitialTechState } from '../technology';
import { army } from './helpers/southAmericaAudit';

const built = (type: BuildingType, level = 1) => ({ type, level, daysRemaining: 0 });
function setup() {
  const country = structuredClone(countries[0]);
  country.resources.gold = 10000; country.resources.manpower = 10000;
  country.capitalId = 'p'; country.capital = 'p'; country.provinces = ['p'];
  const province: Province = { ...structuredClone(provincesData[0]), id: 'p', name: 'Teste', owner: country.tag, development: 5, defense: 1, neighbors: [], terrain: 'plains', buildings: [], market: createDefaultMarket(), maxPopulation: 50000,
    population: { total: 10000, employed: 6000, unemployed: 0, satisfaction: 60, growthRate: 0 } };
  for (const good of Object.values(province.market!.goods)) { good.stock = 1000; good.demand = 1; good.shortage = 0; }
  return { country, province };
}
const order = (province: Province, type: BuildingType = 'farm'): BuildingConstruction => ({ id: 'legacy', owner: province.owner, provinceId: province.id, buildingType: type, cost: 999, daysRemaining: 15, totalDays: 30, resourceCost: { wood: 9, iron: 3, tools: 2 } });

describe('Buildings V2 definitions and progression', () => {
  it('defines eleven categorized buildings with five levels and no attack effect', () => {
    expect(Object.keys(BUILDING_DEFINITIONS)).toHaveLength(11);
    expect(BUILDING_DEFINITIONS.military_arsenal.name).toBe('Arsenal Militar');
    for (const def of Object.values(BUILDING_DEFINITIONS)) {
      expect(def.maxLevel).toBe(5); expect(def.category).toBeTruthy(); expect(def.bonusPerLevel).not.toHaveProperty('attack');
      for (const good of Object.keys(def.resourceCost)) expect(['wood', 'iron', 'tools']).toContain(good);
    }
  });
  it.each(Object.keys(BUILDING_DEFINITIONS) as BuildingType[])('%s costs and times follow the preserved exponential formulas', type => {
    const def = BUILDING_DEFINITIONS[type];
    for (let level = 0; level < 5; level++) {
      const cost = getBuildingCosts(type, level);
      expect(cost.gold).toBe(Math.floor(def.baseCost * 1.5 ** level));
      expect(cost.wood).toBe(Math.ceil((def.resourceCost.wood ?? 0) * 1.5 ** level));
      expect(getBuildingTime(type, level)).toBe(Math.ceil(def.baseBuildTime * 1.25 ** level));
      for (const value of Object.values(cost)) expect(Number.isFinite(value) && value >= 0).toBe(true);
    }
    expect(getBuildingCosts(type, NaN)).toEqual(getBuildingCosts(type, 0));
    expect(getBuildingTime(type, -1)).toBe(def.baseBuildTime);
  });
  it('reads only completed bounded levels and exposes future prerequisite API', () => {
    const { province } = setup();
    province.buildings = [built('farm', 2), { ...built('farm', 5), daysRemaining: 10 }, built('military_arsenal', 99)];
    expect(getBuildingLevel(province, 'farm')).toBe(2); expect(getBuildingLevel(province, 'military_arsenal')).toBe(5);
    expect(meetsBuildingRequirement(province, 'military_arsenal', 3)).toBe(true);
    expect(getBuildingLevel(setup().province, 'military_arsenal')).toBe(0);
  });
});

describe('Buildings V2 construction transactions', () => {
  it('pays once and exposes all resource and gold reasons without mutation', () => {
    const { province, country } = setup(); province.buildings = [built('farm')];
    const cost = getBuildingCosts('farm', 1), before = structuredClone(province);
    const result = startBuilding(province, [province], country.tag, 'farm', 10000, []);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.reason);
    expect(result.gold).toBe(10000 - cost.gold);
    for (const good of ['wood', 'iron', 'tools'] as const) expect(result.provinces[0].market!.goods[good].stock).toBe(before.market!.goods[good].stock - cost[good]);
    expect(province).toEqual(before); expect(getConstructionTargetLevel(result.constructions[0], province, result.constructions)).toBe(2);
    processConstructions(result.constructions, result.provinces); expect(result.gold).toBe(10000 - cost.gold);
    for (const good of Object.values(province.market!.goods)) good.stock = 0;
    expect(getBuildingBlockReasons(province, [province], 'workshop', 0, [])).toEqual(['gold', 'wood', 'iron', 'tools']);
  });
  it('blocks max level, queued and embedded pending construction', () => {
    const { province } = setup(); province.buildings = [built('farm', 5)];
    expect(getBuildingBlockReasons(province, [province], 'farm', 10000, [])).toContain('maximum_level');
    expect(getBuildingBlockReasons(province, [province], 'housing', 10000, [order(province)])).toContain('construction_pending');
    province.buildings = [{ ...built('farm'), daysRemaining: 1 }];
    expect(getBuildingBlockReasons(province, [province], 'housing', 10000, [])).toContain('construction_pending');
  });
  it.each(['barracks', 'infrastructure'] as const)('arsenal accepts completed %s and rejects incomplete requirements', type => {
    const { province } = setup();
    expect(startBuilding(province, [province], province.owner, 'military_arsenal', 10000, []).success).toBe(false);
    province.buildings = [{ ...built(type), daysRemaining: 1 }];
    expect(getBuildingBlockReasons(province, [province], 'military_arsenal', 10000, [])).toContain('prerequisite');
    province.buildings = [built(type)];
    expect(startBuilding(province, [province], province.owner, 'military_arsenal', 10000, []).success).toBe(true);
  });
  it('executes legacy queues serially, completes, cancels and rejects lost territory', () => {
    const { province } = setup();
    const queue = [order(province), { ...order(province, 'housing'), id: 'second' }];
    const tick = processConstructions(queue, [province]);
    expect(tick.updatedConstructions.map(c => c.daysRemaining)).toEqual([14, 15]);
    expect(processConstructions([{ ...queue[0], daysRemaining: 1 }], [province]).completedConstructions).toHaveLength(1);
    expect(processConstructions(queue, [{ ...province, owner: 'other' }]).updatedConstructions).toHaveLength(0);
    expect(cancelBuilding('legacy', queue, 0).refundedGold).toBe(499);
    expect(cancelBuilding('second', queue, 0).refundedGold).toBe(999);
    expect(startBuilding(province, [province], 'other', 'farm', 10000, []).success).toBe(false);
  });
});

describe('Buildings V2 economy and military integration', () => {
  it.each([['farm', 'food'], ['lumber_mill', 'wood'], ['iron_mine', 'iron'], ['workshop', 'tools']] as const)('%s increases real %s production', (type, good) => {
    const { province } = setup();
    expect(calculateProduction({ ...province, buildings: [built(type, 2)] })[good]).toBeGreaterThan(calculateProduction(province)[good]);
  });
  it('retains workshop inputs and warehouse/housing effects', () => {
    const { province } = setup(); province.buildings = [built('workshop')];
    // Plenty of capacity avoids truncating input stock at the storage cap.
    for (const good of Object.values(province.market!.goods)) good.stock = 10;
    const after = processProvinceMarket(province);
    expect(after.goods.wood.stock).toBeCloseTo(10 - after.goods.tools.production, 2);
    expect(after.goods.iron.stock).toBeCloseTo(10 - after.goods.tools.production * .75, 2);
    expect(getStorageCapacity({ ...province, buildings: [built('warehouse', 2)] })).toBe(getStorageCapacity(province) * 2);
    expect(getPopulationCapacity({ ...province, buildings: [built('housing', 2)] })).toBe(province.maxPopulation + 10000);
  });
  it('barracks acceleration applies once when advancing the paid training duration', () => {
    const { province, country } = setup();
    const plain = getEffectiveRecruitmentCost('infantry', { province, country });
    province.buildings = [built('barracks', 2)];
    const fortified = getEffectiveRecruitmentCost('infantry', { province, country });
    expect(fortified.days).toBe(plain.days);
    const queued = queueRecruitment('infantry', { country, province }, 'r');
    if (!queued.success) throw new Error(queued.reason);
    const tick = processRecruitments([queued.recruitment], [], [country], [province]);
    expect(tick.recruitments[0].daysRemaining).toBeCloseTo(fortified.days - 1.3);
  });
  it('arsenal discounts equipment only; preserves manpower, gold, time and unit attack', () => {
    const { province, country } = setup(), before = structuredClone(UNIT_DEFINITIONS);
    const plain = getEffectiveRecruitmentCost('infantry', { province, country });
    province.buildings = [built('military_arsenal', 5)];
    const discounted = getEffectiveRecruitmentCost('infantry', { province, country });
    expect(discounted.iron).toBeCloseTo(plain.iron * .85); expect(discounted.tools).toBeCloseTo(plain.tools * .85);
    expect(discounted.gold).toBe(plain.gold); expect(discounted.manpower).toBe(plain.manpower); expect(discounted.days).toBe(plain.days);
    expect(getMilitaryEquipmentCostMultiplier(province)).toBe(.85); expect(UNIT_DEFINITIONS).toEqual(before);
  });
  it('reinforcement saves real equipment without changing gold/manpower or granting negative recovery', () => {
    const { province, country } = setup();
    const troops = army(country.tag, province.id, 1, 'a');
    troops.regiments[0].strength = 900; troops.regiments[0].maxStrength = 1000;
    const plain = recoverArmy(troops, country, province);
    const withArsenal = recoverArmy(troops, country, { ...province, buildings: [built('military_arsenal', 5)] });
    expect(withArsenal.reinforced).toBe(plain.reinforced); expect(plain.reinforced).toBeGreaterThan(0);
    expect(withArsenal.country.resources).toEqual(plain.country.resources);
    expect(withArsenal.province.market!.goods.iron.stock).toBeGreaterThan(plain.province.market!.goods.iron.stock);
    expect(withArsenal.army.regiments[0].morale).toBeGreaterThanOrEqual(troops.regiments[0].morale);
  });
  it('fortress adds defense once; infrastructure keeps 8% logistics and local supply', () => {
    const { province } = setup();
    expect(calculateProvinceDefense({ ...province, buildings: [built('fortress', 3)] })).toBe(7);
    const improved = { ...province, buildings: [built('infrastructure', 2), built('barracks', 1)] };
    expect(logisticsInfrastructureModifier(improved)).toBeCloseTo(1.16);
    expect(calculateLocalSupplyBaseCapacity(improved) - calculateLocalSupplyBaseCapacity(province)).toBe(5);
    expect(logisticsInfrastructureModifier({ ...province, buildings: [built('infrastructure', 5)] })).toBe(1.4);
    expect(getBuildingBonus(improved, 'productivityBonus')).toBe(8);
  });
  it.each([['farm', 'landowners'], ['market', 'merchants'], ['workshop', 'workers'], ['barracks', 'military'], ['fortress', 'military'], ['infrastructure', 'reformists'], ['military_arsenal', 'workers'], ['military_arsenal', 'military']] as const)('%s increases %s political influence', (type, group) => {
    const { country, province } = setup();
    const influence = (p: Province) => calculatePoliticalGroups(country, { provinces: [p], armies: [], wars: [] }).find(g => g.id === group)!.influence;
    expect(influence({ ...province, buildings: [built(type)] })).toBeGreaterThan(influence(province));
  });
});

describe('Buildings V2 migration and deterministic AI', () => {
  it('AI recruitment preserves the construction resources already paid during the same decision', () => {
    const { country, province } = setup();
    province.market!.goods.food.stock = 0; province.market!.goods.food.demand = 100; province.market!.goods.food.shortage = 100;
    province.population.severeFoodShortageDays = 3;
    const technology = createInitialTechState(country.tag);
    technology.activeResearchId = 'improved_weapons'; technology.activeFocusId = 'focus_military_modernization';
    const result = processAIEconomicDecisions(country, [province], technology, [], [], '1/1/1444', true);
    expect(result.buildingConstructions[0]?.buildingType).toBe('farm'); expect(result.recruitments).toHaveLength(1);
    const paid = result.recruitments[0].paidCost!;
    const construction = result.buildingConstructions[0].resourceCost!;
    expect(result.provinces[0].market!.goods.wood.stock).toBeCloseTo(1000 - (construction.wood ?? 0));
    expect(result.provinces[0].market!.goods.tools.stock).toBeCloseTo(1000 - (construction.tools ?? 0) - paid.tools);
    expect(result.provinces[0].market!.goods.iron.stock).toBeCloseTo(1000 - (construction.iron ?? 0) - paid.iron);
  });
  it('migrates all aliases, preserves levels and embedded progress without hiding completed buildings', () => {
    const raw = ['lumber', 'ironMine', 'fortification', 'temple', 'port', 'university'].map(type => ({ type, level: 3, daysRemaining: 0 }));
    const migrated = migrateLegacyBuildings(raw as Province['buildings']);
    expect(migrated.map(b => b.type)).toEqual(['lumber_mill', 'iron_mine', 'fortress', 'housing', 'market', 'infrastructure']);
    expect(migrated.every(b => b.level === 3)).toBe(true);
    const embedded = migrateLegacyBuildings([built('farm', 2), { ...built('farm', 3), daysRemaining: 9 }]);
    expect(embedded).toHaveLength(2); expect(getBuildingLevel({ ...setup().province, buildings: embedded }, 'farm')).toBe(2);
  });
  it('migrates queued aliases without changing paid costs, remaining days or serial order', () => {
    const { province } = setup(), item = order(province);
    const migrated = migrateBuildingConstructions([{ ...item, buildingType: 'university' } as unknown as BuildingConstruction, { ...item, id: 'arsenal', buildingType: 'military_arsenal' }]);
    expect(migrated[0]).toEqual({ ...item, buildingType: 'infrastructure' }); expect(migrated[1].buildingType).toBe('military_arsenal');
  });
  it.each([['food', 'farm'], ['wood', 'lumber_mill'], ['iron', 'iron_mine'], ['tools', 'workshop']] as const)('AI prioritizes %s shortage across all provinces', (good, type) => {
    const { province, country } = setup();
    for (const g of Object.values(province.market!.goods)) g.stock = 50;
    province.market!.goods[good].stock = 0; province.market!.goods[good].demand = 10; province.market!.goods[good].shortage = 10;
    const safe = { ...structuredClone(province), id: 'first', market: createDefaultMarket() };
    safe.neighbors = [province.id]; province.neighbors = [safe.id];
    for (const g of Object.values(safe.market.goods)) g.stock = 50;
    const projects = rankBuildingProjects(country, [safe, province], [], [], false);
    expect(projects[0].type).toBe(type); expect(projects[0].province.id).toBe('p');
    expect(rankBuildingProjects(country, [province, safe], [], [], false)).toEqual(projects);
  });
  it('AI improves a connected weak network and selects arsenal during military activity', () => {
    const { province, country } = setup(); for (const g of Object.values(province.market!.goods)) g.stock = 50;
    province.terrain = 'mountains';
    const network = buildLogisticsNetworks({ countries: [country], provinces: [province], relations: [] });
    expect(rankBuildingProjects(country, [province], [], [], false, 1, network)[0]?.type).toBe('infrastructure');
    province.buildings = [built('barracks')];
    expect(rankBuildingProjects(country, [province], [], [], true)[0]?.type).toBe('military_arsenal');
  });
  it('AI does not build blindly, below treasury reserve, at max level or while a project is pending', () => {
    const { province, country } = setup(); for (const g of Object.values(province.market!.goods)) g.stock = 50;
    expect(rankBuildingProjects(country, [province], [], [], false)).toEqual([]);
    province.market!.goods.food.stock = 0; province.market!.goods.food.demand = 100;
    expect(rankBuildingProjects({ ...country, resources: { ...country.resources, gold: 300 } }, [province], [], [], false)).toEqual([]);
    expect(rankBuildingProjects(country, [province], [order(province)], [], false)).toEqual([]);
    province.buildings = [built('farm', 5)]; expect(rankBuildingProjects(country, [province], [], [], false)).toEqual([]);
  });
});
