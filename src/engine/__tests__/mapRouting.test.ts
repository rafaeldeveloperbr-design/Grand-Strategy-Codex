import { describe, expect, it } from 'vitest';
import { countries, provincesData, validateMapTopology } from '../../data/map';
import { canMoveToProvince, findPath, moveArmy } from '../military/movementEngine';
import { transferProvince } from '../territoryTransfer';
import { access, army, relation, world } from './helpers/southAmericaAudit';

function validRoute(start: string, end: string, path: string[], map = provincesData) {
  expect(path.length).toBeGreaterThan(0); expect(path[path.length - 1]).toBe(end);
  expect(new Set(path).size).toBe(path.length);
  for (const id of path) {
    expect(map.find(p => p.id === start)!.neighbors).toContain(id);
    expect(map.find(p => p.id === id)!.neighbors).toContain(start);
    start = id;
  }
}

describe('South America routing audit', () => {
  it('checks the complete topology and all 3136 ordered pairs independently of SVG geometry', () => {
    expect(validateMapTopology(provincesData, countries)).toMatchObject({ valid: true, issues: [], components: [expect.any(Array)] });
    const graph = provincesData.map(p => ({ ...p, owner: 'BRA', path: '', center: { x: NaN, y: Infinity } }));
    for (const start of provincesData) for (const end of provincesData) {
      const path = findPath(start.id, end.id, graph, 'BRA', []);
      if (start.id === end.id) expect(path).toEqual([]);
      else {
        validRoute(start.id, end.id, path);
        expect(path).toEqual(findPath(start.id, end.id, provincesData, 'BRA', access('BRA')));
      }
    }
  });

  it.each([
    ['sa_ven_caracas', 'sa_arg_santa_cruz'], ['sa_col_bogota', 'sa_arg_buenos_aires'],
    ['sa_chl_santiago', 'sa_bra_brasilia'], ['sa_per_lima', 'sa_ury_montevideu'],
    ['sa_bra_brasilia', 'sa_ven_caracas'], ['sa_arg_buenos_aires', 'sa_guy_georgetown'],
    ['sa_ecu_quito', 'sa_bra_sao_paulo'], ['sa_bra_amazonas', 'sa_chl_santiago'],
  ])('routes %s to %s with only permitted provinces', (start, end) => {
    const owner = provincesData.find(p => p.id === start)!.owner, relations = access(owner);
    const route = findPath(start, end, provincesData, owner, relations);
    validRoute(start, end, route);
    for (const id of route) expect(canMoveToProvince(owner, provincesData.find(p => p.id === id)!.owner, relations)).toBe(true);
  });

  it('routes inside Brazil without foreign access and rejects nonexistent endpoints', () => {
    validRoute('sa_bra_brasilia', 'sa_bra_amazonas', findPath('sa_bra_brasilia', 'sa_bra_amazonas', provincesData, 'BRA', []));
    expect(findPath('missing', 'sa_bra_brasilia', provincesData, 'BRA', [])).toEqual([]);
    expect(findPath('sa_bra_brasilia', 'missing', provincesData, 'BRA', [])).toEqual([]);
  });

  it('cannot reach a warring Argentina from Colombia through neutral third countries', () => {
    expect(findPath('sa_col_bogota', 'sa_arg_buenos_aires', provincesData, 'COL', [relation('COL', 'ARG')])).toEqual([]);
    const relations = [relation('COL', 'ARG'), relation('COL', 'BRA', 'alliance', 80)];
    const route = findPath('sa_col_bogota', 'sa_arg_buenos_aires', provincesData, 'COL', relations);
    validRoute('sa_col_bogota', 'sa_arg_buenos_aires', route);
    expect(route.every(id => ['COL', 'BRA', 'ARG'].includes(provincesData.find(p => p.id === id)!.owner))).toBe(true);
  });

  it.each([['peace', 79, false], ['peace', 80, false], ['access', 0, true], ['alliance', 80, true], ['war', -100, true]] as const)('respects explicit V2 access for %s / opinion %s', (status, opinion, allowed) => {
    expect(!!moveArmy(army('BRA', 'sa_bra_amazonas'), 'sa_col_amazonia', provincesData, [relation('BRA', 'COL', status, opinion)])).toBe(allowed);
  });

  it('does not create access through an unrelated occupation', () => {
    const map = world();
    const occupied = transferProvince({ ...map, recruitments: [], constructions: [] }, 'sa_bra_amazonas', 'VEN');
    const relations = [relation('COL', 'BRA', 'access', 80), relation('COL', 'ARG')];
    expect(findPath('sa_col_amazonia', 'sa_arg_buenos_aires', occupied.provinces, 'COL', relations)).toEqual([]);
  });
});
