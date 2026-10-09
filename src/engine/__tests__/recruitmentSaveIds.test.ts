import { expect, it, vi } from 'vitest';
import { countries, provincesData } from '../../data/map';
import type { Army } from '../../types';

it('recruitment after a fresh module load never reuses Army IDs from a restored save', async () => {
  vi.resetModules(); // A browser navigation resets the in-memory army ID counter.
  const { processRecruitments } = await import('../military/recruitmentEngine');
  const own = provincesData.filter(p => p.owner === 'BRA');
  const loaded: Army = { id: 'army_1', owner: 'BRA', name: 'Restored Army', location: own[0].id, destination: null, targetDestination: null, path: [], movementProgress: 0, movementSpeed: 1, position: null, regiments: [{ type: 'infantry', strength: 1000, morale: 100 }] };
  const result = processRecruitments([{ id: 'saved-rec', owner: 'BRA', provinceId: own[1].id, unitType: 'infantry', count: 1, daysRemaining: 1 }], [loaded], structuredClone(countries), structuredClone(provincesData));
  expect(result.armies).toHaveLength(2);
  expect(result.armies[0]).toEqual(loaded);
  expect(new Set(result.armies.map(a => a.id)).size).toBe(2);
  expect(result.armies[1].location).toBe(own[1].id);
});
