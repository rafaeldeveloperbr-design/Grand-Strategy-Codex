import { describe, it, expect } from 'vitest';
import {
  declareWar,
  makePeace,
  offerNonAggressionPact,
  improveRelations,
  processDiplomacyTick,
  getOrCreateRelation,
  DIPLOMATIC_COSTS
} from '../diplomacy';
import type { GameDate } from '../../types/date';

const date: GameDate = {
  year: 1836,
  month: 1,
  day: 1,
};

describe('DIPLOMACIA', () => {
  it('declareWar - cria guerra e coloca status war', () => {
    const result = declareWar([], [], 'BRA', 'ARG', date);

    expect(result.wars.length).toBe(1);
    expect(result.wars[0].attacker).toBe('BRA');
    expect(result.wars[0].defender).toBe('ARG');
    expect(result.relations[0].status).toBe('war');
    expect(result.relations[0].opinion).toBe(-50);
  });

  it('declareWar - não pode declarar guerra duplicada? cria segunda entrada', () => {
    const first = declareWar([], [], 'BRA', 'ARG', date);
    const second = declareWar(first.relations, first.wars, 'BRA', 'ARG', date);
    // sua lógica atual permite declarar de novo, mas opinião vai pra -100
    expect(second.relations[0].opinion).toBe(-100);
  });

  it('makePeace - remove guerra e melhora opinião +10', () => {
    const warState = declareWar([], [], 'BRA', 'ARG', date);
    const peace = makePeace(warState.relations, warState.wars, 'BRA', 'ARG');

    expect(peace.wars.length).toBe(0);
    expect(peace.relations[0].status).toBe('peace');
    expect(peace.relations[0].opinion).toBe(-40); // -50 +10
  });

  it('pacto - oferece não agressão por 365 dias', () => {
    const relations = offerNonAggressionPact([], 'BRA', 'ARG', 365);
    expect(relations[0].status).toBe('non_aggression_pact');
    expect(relations[0].pactDaysRemaining).toBe(365);
    expect(relations[0].opinion).toBe(20);
  });

  it('tick - pacto expira e vira peace', () => {
    let relations = offerNonAggressionPact([], 'BRA', 'ARG', 1);
    relations = processDiplomacyTick(relations); // 1 -> 0
    expect(relations[0].pactDaysRemaining).toBe(0);
    expect(relations[0].status).toBe('peace');
  });

  it('tick - guerra não expira sozinha', () => {
    const warState = declareWar([], [], 'BRA', 'ARG', date);
    const ticked = processDiplomacyTick(warState.relations);
    expect(ticked[0].status).toBe('war');
  });

  it('melhorar relações - aumenta opinião até 100', () => {
    let relations = improveRelations([], 'BRA', 'ARG', 10);
    expect(relations[0].opinion).toBe(10);

    relations = improveRelations(relations, 'BRA', 'ARG', 200);
    expect(relations[0].opinion).toBe(100); // capa em 100
  });

  it('getOrCreateRelation - retorna existente ou cria neutra', () => {
    const rel = getOrCreateRelation([], 'BRA', 'ARG');
    expect(rel.opinion).toBe(0);
    expect(rel.status).toBe('peace');

    const existing = getOrCreateRelation([rel], 'ARG', 'BRA'); // invertido
    expect(existing.opinion).toBe(0);
  });

  it('custos diplomáticos - definidos', () => {
    expect(DIPLOMATIC_COSTS.declare_war.opinionChange).toBe(-50);
    expect(DIPLOMATIC_COSTS.improve_relations.gold).toBe(50);
  });
});