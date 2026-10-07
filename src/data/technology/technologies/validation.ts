import type { Technology } from '../../../types/technology';

/** Positions are unique per category; every prerequisite must occupy an earlier row. */
export function validateTechnologyTree(technologies: readonly Technology[]): string[] {
  const errors: string[] = [];
  const byId = new Map<string, Technology>();
  const positions = new Set<string>();
  for (const technology of technologies) {
    if (byId.has(technology.id)) errors.push(`Duplicate technology ID: ${technology.id}`);
    byId.set(technology.id, technology);
    const position = technology.position;
    if (!position || !Number.isInteger(position.column) || !Number.isInteger(position.row) || position.column < 0 || position.row < 0) {
      errors.push(`Invalid position: ${technology.id}`);
    } else {
      const key = `${technology.category}:${position.column}:${position.row}`;
      if (positions.has(key)) errors.push(`Duplicate position: ${technology.id}`);
      positions.add(key);
    }
  }
  for (const technology of technologies) {
    if (new Set(technology.prerequisites).size !== technology.prerequisites.length) errors.push(`Duplicate prerequisites: ${technology.id}`);
    for (const id of technology.prerequisites) {
      const prerequisite = byId.get(id);
      if (!prerequisite) errors.push(`Unknown prerequisite: ${technology.id} -> ${id}`);
      if (id === technology.id) errors.push(`Self prerequisite: ${technology.id}`);
      if (prerequisite && prerequisite.position?.row >= technology.position?.row) errors.push(`Prerequisite must precede successor: ${technology.id} -> ${id}`);
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
