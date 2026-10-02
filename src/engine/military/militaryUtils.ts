import { Army, Regiment, UnitType } from '../../types';
import { UNIT_DEFINITIONS } from '../../data/units';

let armyIdCounter = 0;
export function generateArmyId(): string {
  return `army_${++armyIdCounter}`;
}

let recruitmentIdCounter = 0;
export function generateRecruitmentId(): string {
  return `rec_${++recruitmentIdCounter}`;
}

export function createRegiment(type: UnitType): Regiment {
  return {
    type,
    strength: 1000,
    morale: 100,
  };
}

export function createArmy(owner: string, name: string, location: string): Army {
  return {
    id: generateArmyId(),
    owner,
    name,
    regiments: [],
    location,
    destination: null,
    targetDestination: null,
    movementProgress: 0,
    movementSpeed: 1.0,
    position: null,
    path: [],
    targetArmyId: null,
    targetProvinceId: null,
  };
}

export function calculateArmySpeed(army: Army): number {
  if (army.regiments.length === 0) return 1.0;

  let minSpeed = Infinity;
  for (const reg of army.regiments) {
    const def = UNIT_DEFINITIONS[reg.type];
    if (def.mobility < minSpeed) {
      minSpeed = def.mobility;
    }
  }

  return minSpeed === Infinity ? 1.0 : minSpeed;
}



export function getFriendlyArmiesInProvince(
  armies: Army[],
  provinceId: string,
  ownerTag: string
): Army[] {
  return armies.filter(
    (a) => a.location === provinceId && a.owner === ownerTag && !a.destination
  );
}

export function calculateArmyOffset(
  index: number,
  total: number
): { offsetX: number; offsetY: number } {
  if (total <= 1) {
    return { offsetX: 0, offsetY: 0 };
  }

  const radius = 18 + (total > 4 ? (total - 4) * 3 : 0);
  const angleStep = (2 * Math.PI) / total;
  const angle = angleStep * index - Math.PI / 2;

  return {
    offsetX: Math.cos(angle) * radius,
    offsetY: Math.sin(angle) * radius,
  };
}