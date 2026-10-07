import { describe, expect, it } from 'vitest';
import { NATIONAL_FOCUSES } from '../../data/technology';
import { calculateTechBonuses, createInitialTechState, normalizeTechState, processDailyTechProgress, startNationalFocus } from '../technology';
import { calculateTradeBalance } from '../internalTrade';
import { calculateProduction, normalizeMarket } from '../market';
import { normalizePopulation } from '../population';
import type { Country, Province } from '../../types';

const country = { tag: 'TST', resources: { gold: 1000 } } as Country;
const province = {
  id: 'p', name: 'Teste', owner: 'TST', color: '#000', center: { x: 0, y: 0 }, path: '', development: 2, maxPopulation: 10000, stationedTroops: 0,
  population: normalizePopulation(5000), buildings: [], neighbors: [], defense: 1,
  market: normalizeMarket(undefined),
} satisfies Province;
const withFocuses = (...ids: string[]) => ({ ...createInitialTechState('TST'), completedFocuses: ids });

describe('árvore integrada de focos nacionais', () => {
  it('possui categorias tipadas, cadeias e durações balanceadas', () => {
    expect(new Set(NATIONAL_FOCUSES.map(focus => focus.category))).toEqual(new Set(['MILITARY', 'ECONOMY', 'POLITICS', 'INDUSTRY', 'DIPLOMACY', 'RESEARCH']));
    expect(NATIONAL_FOCUSES.length).toBeGreaterThanOrEqual(20);
    expect(NATIONAL_FOCUSES.every(focus => focus.durationDays >= 50 && focus.durationDays <= 140)).toBe(true);
    expect(NATIONAL_FOCUSES.every(focus => (focus.prerequisites ?? []).every(id => NATIONAL_FOCUSES.some(candidate => candidate.id === id)))).toBe(true);
  });

  it('bloqueia um foco intermediário e o libera após seu requisito', () => {
    expect(startNationalFocus(createInitialTechState('TST'), 'focus_industrial_revolution')).toBeNull();
    expect(startNationalFocus(withFocuses('focus_economic_expansion', 'focus_manufacturing_incentive'), 'focus_industrial_revolution')?.activeFocusId).toBe('focus_industrial_revolution');
  });

  it('não conclui nem aplica o mesmo foco duas vezes', () => {
    const completed = withFocuses('focus_agrarian_reform');
    expect(startNationalFocus(completed, 'focus_agrarian_reform')).toBeNull();
    expect(calculateTechBonuses(normalizeTechState({ ...completed, completedFocuses: ['focus_agrarian_reform', 'focus_agrarian_reform'] })).productionMultipliers.food).toBeCloseTo(1.1);
  });

  it('aplica agricultura, indústria, militar, política e pesquisa nos modificadores canônicos', () => {
    const bonuses = calculateTechBonuses(withFocuses(
      'focus_agrarian_reform', 'focus_industrial_revolution', 'focus_military_modernization',
      'focus_national_unity', 'focus_scientific_patronage',
    ));
    expect(bonuses.productionMultipliers.food).toBeCloseTo(1.1);
    expect(bonuses.productionMultipliers.tools).toBeCloseTo(1.1);
    expect(bonuses.combatPowerBonus.infantry).toBeCloseTo(.15);
    expect(bonuses.satisfactionModifier).toBe(2);
    expect(bonuses.researchSpeedMultiplier).toBeCloseTo(1.1);
    expect(calculateProduction(province, bonuses.productionMultipliers).food).toBeGreaterThan(calculateProduction(province).food);
  });

  it('expansão comercial libera mais excedente sem criar comércio internacional', () => {
    const market = normalizeMarket(undefined);
    market.goods.food = { ...market.goods.food, stock: 100, demand: 20 };
    const tradingProvince = { ...province, market };
    expect(calculateTradeBalance(tradingProvince, 'food', 1.1).surplus).toBeGreaterThan(calculateTradeBalance(tradingProvince, 'food').surplus);
  });

  it('normaliza saves antigos, removendo IDs inválidos e progresso órfão', () => {
    const normalized = normalizeTechState({ activeFocusId: 'removed', completedFocuses: ['focus_national_unity', 'removed', 'focus_national_unity'], focusProgressDays: 12 });
    expect(normalized.activeFocusId).toBeNull();
    expect(normalized.completedFocuses).toEqual(['focus_national_unity']);
  });

  it('conclusão diária registra uma única ocorrência', () => {
    const focus = NATIONAL_FOCUSES.find(item => item.id === 'focus_national_unity')!;
    const active = { ...startNationalFocus(createInitialTechState('TST'), focus.id)!, focusProgressDays: focus.durationDays - 1 };
    const result = processDailyTechProgress(active, country, 'medium', true);
    expect(result.techState.completedFocuses.filter(id => id === focus.id)).toHaveLength(1);
  });
});
