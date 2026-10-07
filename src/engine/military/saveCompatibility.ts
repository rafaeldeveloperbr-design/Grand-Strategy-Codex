import { isRecognizedUnitType } from '../../data/units';

export class MilitarySaveCompatibilityError extends Error {}
/** Validate military IDs throughout raw saves, before migrations can index catalogs. */
export function validateMilitarySave(value: unknown, path = 'save'): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((item, i) => validateMilitarySave(item, `${path}[${i}]`)); return; }
  for (const [key, item] of Object.entries(value)) {
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
    validateMilitarySave(item, `${path}.${key}`);
  }
}
