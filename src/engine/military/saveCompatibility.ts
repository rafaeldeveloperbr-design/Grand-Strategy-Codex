import { isRecognizedUnitType } from '../../data/units';

export class MilitarySaveCompatibilityError extends Error {}
/** Validate military IDs throughout raw saves, before migrations can index catalogs. */
export function validateMilitarySave(value: unknown, path = 'save', provinceIds?: Set<string>): void {
  if (path === 'save' && value && typeof value === 'object' && !Array.isArray(value)) {
    const raw = value as Record<string, unknown>;
    const world = raw.world && typeof raw.world === 'object' ? raw.world as Record<string, unknown> : undefined;
    const provinces = raw.provinces ?? world?.provinces;
    if (Array.isArray(provinces)) provinceIds = new Set(provinces.flatMap(p => p && typeof p === 'object' && typeof p.id === 'string' ? [p.id] : []));
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((item, i) => validateMilitarySave(item, `${path}[${i}]`, provinceIds)); return; }
  for (const [key, item] of Object.entries(value)) {
    if (key === 'movementPlan' && item !== undefined) {
      const waypoints: unknown = item && typeof item === 'object' && 'waypoints' in item ? item.waypoints : undefined;
      if (!Array.isArray(waypoints) || waypoints.some(id => typeof id !== 'string' || !id.length || (provinceIds && !provinceIds.has(id)))) throw new MilitarySaveCompatibilityError(`Plano de movimento inválido em ${path}: waypoint ou província incompatível`);
    }
    if (key === 'regiments') {
      if (!Array.isArray(item)) throw new MilitarySaveCompatibilityError(`Regimentos inválidos em ${path}`);
      item.forEach((regiment: unknown, i) => {
        const type = regiment && typeof regiment === 'object' && 'type' in regiment ? regiment.type : undefined;
        if (!isRecognizedUnitType(type)) throw new MilitarySaveCompatibilityError(`Unidade militar incompatível: ${String(type)} em ${path}.regiments[${i}]`);
        if (regiment && typeof regiment === 'object') {
          for (const [field, n] of Object.entries(regiment)) {
            if (n !== undefined && ['strength', 'maxStrength', 'morale', 'organization', 'experience'].includes(field) && (typeof n !== 'number' || !Number.isFinite(n) || (field === 'maxStrength' && n <= 0))) throw new MilitarySaveCompatibilityError(`Estado militar inválido: ${field} em ${path}.regiments[${i}]`);
          }
        }
      });
    }
    if (key === 'unitType' && !isRecognizedUnitType(item)) throw new MilitarySaveCompatibilityError(`Unidade militar incompatível: ${String(item)} em ${path}`);
    if (key === 'regimentComposition' && item && typeof item === 'object') {
      for (const type of Object.keys(item)) if (!isRecognizedUnitType(type)) throw new MilitarySaveCompatibilityError(`Composição militar incompatível: ${type} em ${path}`);
    }
    validateMilitarySave(item, `${path}.${key}`, provinceIds);
  }
}
