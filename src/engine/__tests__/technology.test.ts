import { describe, expect, it } from 'vitest';
import type { Army, Country, Province } from '../../types';
import { TECHNOLOGIES } from '../../data/technology';
import {
  canResearchTechnology, chooseAITechnology, createInitialTechState, getTechnologyModifiers,
  migrateTechnologyState, processDailyTechProgress, startTechnologyResearch,
} from '../technology';
import { calculateProduction, createDefaultMarket, processProvinceMarket } from '../market';
import { processConstructions } from '../buildings';
import { processBattleDay, startContinuousBattle } from '../combat/continuousBattle';

const country = (gold = 5000): Country => ({ tag: 'A', name: 'A', adjective: 'A', color: '#000', colorLight: '#111', provinces: ['p'], resources: { gold, manpower: 0, maxManpower: 0, stability: 60, prestige: 0 }, economy: { goldIncome: 0, goldExpense: 0, manpowerGain: 0, manpowerExpense: 0 }, flag: '', activeLaws: { conscription: '', taxation: '', governance: '', economy: '', intelligence: '' } });
const province = (buildings: Province['buildings'] = []): Province => ({ id: 'p', name: 'P', owner: 'A', color: '#000', neighbors: [], population: { total: 10000, growthRate: 0, employed: 5000, unemployed: 1000, satisfaction: 60 }, market: createDefaultMarket(), maxPopulation: 20000, development: 8, buildings, defense: 0, center: { x: 0, y: 0 }, path: '', unrest: 0 });
const army = (id: string, owner: string): Army => ({ id, owner, name: id, regiments: [{ type: 'infantry', strength: 2000, morale: 100 }], location: 'p', destination: null, targetDestination: null, movementProgress: 0, movementSpeed: 1, position: null, path: [], inCombat: true });

describe('Tecnologia produtiva', () => {
  it('avança pesquisa conforme desenvolvimento e infraestrutura', () => {
    const state = { ...createInitialTechState('A'), activeResearchId: 'agriculture_organized' };
    const result = processDailyTechProgress(state, country(), 'medium', true, [province([{ type: 'infrastructure', level: 2, daysRemaining: 0 }])]);
    expect(result.techState.researchProgressDays).toBeGreaterThan(1);
    expect(result.techState.researchSpeed).toBeGreaterThan(1);
  });

  it('conclui pesquisa e não permite pesquisá-la novamente', () => {
    const tech = TECHNOLOGIES.find(item => item.id === 'agriculture_organized')!;
    const state = { ...createInitialTechState('A'), activeResearchId: tech.id, researchProgressDays: tech.researchCost - 0.1 };
    const completed = processDailyTechProgress(state, country(), 'medium', true, [province()]).techState;
    expect(completed.completedTechnologies).toContain(tech.id);
    expect(startTechnologyResearch(completed, tech.id, country()).techState).toBeNull();
  });

  it('respeita pré-requisitos e bloqueia tecnologia indisponível', () => {
    const state = createInitialTechState('A');
    expect(canResearchTechnology(state, 'crop_rotation')).toBe(false);
    expect(startTechnologyResearch(state, 'crop_rotation', country()).techState).toBeNull();
    expect(canResearchTechnology({ ...state, completedTechnologies: ['agriculture_organized'] }, 'crop_rotation')).toBe(true);
  });

  it('bônus agrícolas e industriais aumentam produção real', () => {
    const farm = province([{ type: 'farm', level: 3, daysRemaining: 0 }]);
    const industry = province([{ type: 'iron_mine', level: 3, daysRemaining: 0 }, { type: 'workshop', level: 2, daysRemaining: 0 }]);
    const agricultural = getTechnologyModifiers({ ...createInitialTechState('A'), completedTechnologies: ['agriculture_organized', 'crop_rotation'] });
    const industrial = getTechnologyModifiers({ ...createInitialTechState('A'), completedTechnologies: ['improved_tools', 'metallurgy', 'organized_production'] });
    expect(calculateProduction(farm, agricultural).food).toBeGreaterThan(calculateProduction(farm).food);
    expect(calculateProduction(industry, industrial).iron).toBeGreaterThan(calculateProduction(industry).iron);
    expect(calculateProduction(industry, industrial).tools).toBeGreaterThan(calculateProduction(industry).tools);
  });

  it('tecnologia de armazenamento aumenta capacidade real do Warehouse', () => {
    const stored = province([{ type: 'warehouse', level: 2, daysRemaining: 0 }]);
    stored.market!.goods.food.stock = 1000;
    const modifiers = getTechnologyModifiers({ ...createInitialTechState('A'), completedTechnologies: ['civil_engineering', 'organized_storage'] });
    expect(processProvinceMarket(stored, [], modifiers).goods.food.stock).toBeGreaterThan(processProvinceMarket(stored).goods.food.stock);
  });

  it('Engenharia Civil acelera construções reais', () => {
    const project = { id: 'c', provinceId: 'p', owner: 'A', buildingType: 'farm' as const, daysRemaining: 10, totalDays: 10, cost: 1 };
    const normal = processConstructions([project], [province()]).updatedConstructions[0].daysRemaining;
    const fast = processConstructions([project], [province()], new Map([['A', 0.1]])).updatedConstructions[0].daysRemaining;
    expect(fast).toBeLessThan(normal);
  });

  it('tecnologia militar altera perdas do combate ativo', () => {
    const attacker = army('a', 'ATT'); const defender = army('d', 'DEF');
    const field = { ...province(), owner: 'DEF' };
    const battle = { ...startContinuousBattle([attacker], [defender], field, { day: 1, month: 1, year: 1 }, 'b'), daysTotal: 3 };
    const baseline = processBattleDay(battle, [attacker, defender], field, [field]);
    const attackTech = getTechnologyModifiers({ ...createInitialTechState('ATT'), completedTechnologies: ['military_training', 'military_metallurgy'] });
    const enhanced = processBattleDay(battle, [attacker, defender], field, [field], new Map([['ATT', attackTech]]));
    expect(enhanced.battle.defenderCurrentTroops).toBeLessThan(baseline.battle.defenderCurrentTroops);
  });

  it('Fortress e tecnologia defensiva reduzem perdas do defensor', () => {
    const attacker = army('a', 'ATT'); const defender = army('d', 'DEF');
    const plain = { ...province(), owner: 'DEF' };
    const fortified = { ...plain, buildings: [{ type: 'fortress' as const, level: 4, daysRemaining: 0 }] };
    const battle = { ...startContinuousBattle([attacker], [defender], plain, { day: 1, month: 1, year: 1 }, 'b'), daysTotal: 3 };
    const modifiers = getTechnologyModifiers({ ...createInitialTechState('DEF'), completedTechnologies: ['military_training', 'military_metallurgy', 'modern_fortifications'] });
    const normal = processBattleDay(battle, [attacker, defender], plain, [plain]);
    const defended = processBattleDay(battle, [attacker, defender], fortified, [fortified], new Map([['DEF', modifiers]]));
    expect(defended.battle.defenderCurrentTroops).toBeGreaterThan(normal.battle.defenderCurrentTroops);
  });

  it('combina efeitos de múltiplas tecnologias de forma aditiva', () => {
    const modifiers = getTechnologyModifiers({ ...createInitialTechState('A'), completedTechnologies: ['agriculture_organized', 'crop_rotation', 'intensive_agriculture'] });
    expect(modifiers.foodProduction).toBeCloseTo(0.3);
    expect(modifiers.infrastructureProductivity).toBeCloseTo(0.05);
  });

  it('IA escolhe tecnologia válida conforme guerra ou escassez', () => {
    expect(chooseAITechnology(createInitialTechState('A'), [province()], true)).toBe('military_training');
    const hungry = province(); hungry.market!.goods.food.shortage = 10;
    expect(chooseAITechnology(createInitialTechState('A'), [hungry], false)).toBe('agriculture_organized');
  });

  it('migra IDs antigos e preserva progresso ativo', () => {
    const migrated = migrateTechnologyState({ ...createInitialTechState('A'), completedTechnologies: ['tech_improved_weapons'], activeResearchId: 'tech_construction_techniques', researchProgressDays: 12 });
    expect(migrated.completedTechnologies).toContain('military_training');
    expect(migrated.activeResearchId).toBe('civil_engineering');
    expect(migrated.researchProgressDays).toBe(12);
  });
});
