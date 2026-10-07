import type { NationalFocus } from '../../../types/technology';

/** Returns all structural errors without mutating definitions or saved state. */
export function validateFocusTree(focuses: readonly NationalFocus[]): string[] {
  const errors: string[] = [];
  const byId = new Map<string, NationalFocus>();
  const positions = new Set<string>();
  for (const focus of focuses) {
    if (byId.has(focus.id)) errors.push(`Duplicate focus ID: ${focus.id}`);
    byId.set(focus.id, focus);
    const position = focus.position;
    if (!position || !Number.isInteger(position.column) || !Number.isInteger(position.row) || position.column < 0 || position.row < 0) {
      errors.push(`Invalid position: ${focus.id}`);
    } else {
      const key = `${position.column}:${position.row}`;
      if (positions.has(key)) errors.push(`Duplicate position: ${focus.id}`);
      positions.add(key);
    }
  }
  for (const focus of focuses) {
    for (const field of ['prerequisites', 'mutuallyExclusive'] as const) {
      const ids = focus[field] ?? [];
      if (new Set(ids).size !== ids.length) errors.push(`Duplicate ${field}: ${focus.id}`);
      for (const id of ids) {
        if (!byId.has(id)) errors.push(`Unknown ${field}: ${focus.id} -> ${id}`);
        if (id === focus.id) errors.push(`Self ${field}: ${focus.id}`);
      }
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) { errors.push(`Prerequisite cycle: ${id}`); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const prerequisite of byId.get(id)?.prerequisites ?? []) if (byId.has(prerequisite)) visit(prerequisite);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of byId.keys()) visit(id);
  return errors;
}
