import { militaryWorld } from './militaryWorld';
import { createInitialTechState } from '../../technology';
import { createAITickProfiler } from '../../performance/aiTickProfiler';
import type { processAiTick } from '../../../hooks/gameLoop/aiTick';

export function activationTickParams(playerCountryTag = 'USA', scenario: 'peace' | 'wars' = 'peace'): Parameters<typeof processAiTick>[0] {
  const world = militaryWorld(scenario);
  return { ...world, playerCountryTag, profiler: createAITickProfiler(true),
    recruitments: [], buildingConstructions: [],
    currentBotTechStates: new Map(world.countries.filter(c => c.tag !== playerCountryTag).map(c => [c.tag, createInitialTechState(c.tag)])),
    aiDifficultyRef: { current: 'medium' }, ceilingLogRef: { current: new Set() },
    snapshot: { date: world.date }, allCountries: world.countries,
    addAILog: () => {}, formatGameDate: () => '1444-11-11',
  };
}
